
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import clientPromise from "@/lib/mongodb";
import Razorpay from "razorpay";
import { createHmac, timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ACTIVE_STATUSES = ["waiting", "serving", "in-progress"];

function parseTime(value) {
  if (!value || typeof value !== "string") return null;

  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);

  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();

  if (minute > 59 || hour > 23) return null;

  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    hour %= 12;
    if (meridiem === "PM") hour += 12;
  }

  if (hour > 23) return null;

  return hour * 60 + minute;
}

function makeIndiaDate(dateString, minutes) {
  const [year, month, day] = dateString.split("-").map(Number);

  return new Date(
    Date.UTC(year, month - 1, day, 0, minutes, 0) -
      330 * 60 * 1000
  );
}

function getIndiaDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function getIndiaMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const hour = Number(
    parts.find((part) => part.type === "hour")?.value
  );
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value
  );

  return hour * 60 + minute;
}

function priorityRank(priority) {
  const value = String(priority || "normal").toLowerCase();

  if (value === "emergency") return 0;
  if (value === "elderly") return 1;

  return 2;
}

function sortQueue(items) {
  return [...items].sort((a, b) => {
    const priorityDifference =
      priorityRank(a.priority) - priorityRank(b.priority);

    if (priorityDifference !== 0) return priorityDifference;

    const sequenceA = Number(a.sequence) || Number.MAX_SAFE_INTEGER;
    const sequenceB = Number(b.sequence) || Number.MAX_SAFE_INTEGER;

    if (sequenceA !== sequenceB) return sequenceA - sequenceB;

    return (
      new Date(a.createdAt || 0).getTime() -
      new Date(b.createdAt || 0).getTime()
    );
  });
}

function getConfiguredSlot(doctor, dateString, selectedSlot) {
  const [year, month, day] = dateString.split("-").map(Number);

  const dayNames = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];

  // Use UTC noon to determine the appointment weekday consistently.
  const dayKey = dayNames[
    new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay()
  ];

  const scheduleDay = doctor?.schedule?.[dayKey];

  if (scheduleDay?.active === false) return null;

  const slots = scheduleDay?.slots || [];

  return (
    slots.find(
      (item) =>
        item.open === selectedSlot?.open &&
        item.close === selectedSlot?.close
    ) || null
  );
}

function getQueueStartTime(doctor, date, slot) {
  const configuredSlot = getConfiguredSlot(doctor, date, slot);

  return (
    parseTime(configuredSlot?.checkupStartTime) ??
    parseTime(slot?.checkupStartTime) ??
    parseTime(slot?.open)
  );
}

/**
 * For today's appointment:
 * effective start = max(
 *   slot start,
 *   configured checkup start,
 *   current India time,
 *   earliest existing booking time
 * )
 *
 * For a future appointment:
 * effective start = max(slot start, configured checkup start)
 */
function getEffectiveQueueStart({
  appointmentDate,
  slot,
  configuredStartMinutes,
  queue,
  now,
}) {
  const slotStartMinutes = parseTime(slot?.open);

  const starts = [
    slotStartMinutes,
    configuredStartMinutes,
  ].filter((value) => value !== null && value !== undefined);

  let effectiveStartMinutes = Math.max(...starts);

  if (appointmentDate !== getIndiaDateString(now)) {
    return effectiveStartMinutes;
  }

  effectiveStartMinutes = Math.max(
    effectiveStartMinutes,
    getIndiaMinutes(now)
  );

  const earliestBooking = [...queue]
    .filter((item) => item.createdAt)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() -
        new Date(b.createdAt).getTime()
    )[0];

  if (earliestBooking) {
    const createdAt = new Date(earliestBooking.createdAt);

    if (
      !Number.isNaN(createdAt.getTime()) &&
      getIndiaDateString(createdAt) === appointmentDate
    ) {
      effectiveStartMinutes = Math.max(
        effectiveStartMinutes,
        getIndiaMinutes(createdAt)
      );
    }
  }

  return effectiveStartMinutes;
}

function jsonResponse(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request) {
  let db;
  let lockedOrderId = null;
  let lockAcquired = false;

  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const authSecret =
      process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

    if (
      !keyId ||
      !keySecret ||
      !authSecret ||
      !process.env.MONGODB
    ) {
      return jsonResponse(
        {
          success: false,
          message: "Payment verification is not configured.",
        },
        500
      );
    }

    const token = await getToken({
      req: request,
      secret: authSecret,
    });

    if (!token) {
      return jsonResponse(
        {
          success: false,
          message: "Please login first.",
        },
        401
      );
    }

    const userId = String(token.id || token.sub || "");
    const userEmail = String(token.email || "").trim().toLowerCase();

    if (!userId && !userEmail) {
      return jsonResponse(
        {
          success: false,
          message: "User session is incomplete.",
        },
        401
      );
    }

    const body = await request.json();

    const orderId = body.razorpay_order_id;
    const paymentId = body.razorpay_payment_id;
    const signature = body.razorpay_signature;

    if (
      typeof orderId !== "string" ||
      typeof paymentId !== "string" ||
      typeof signature !== "string" ||
      !orderId.trim() ||
      !paymentId.trim() ||
      !/^[a-f0-9]{64}$/i.test(signature)
    ) {
      return jsonResponse(
        {
          success: false,
          message: "Invalid payment verification details.",
        },
        400
      );
    }

    const expectedSignature = createHmac("sha256", keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest();

    const receivedSignature = Buffer.from(signature, "hex");

    if (
      expectedSignature.length !== receivedSignature.length ||
      !timingSafeEqual(expectedSignature, receivedSignature)
    ) {
      return jsonResponse(
        {
          success: false,
          message: "Invalid payment signature.",
        },
        400
      );
    }

    const client = await clientPromise;
    db = client.db(process.env.MONGODB);

    const orders = db.collection("paymentOrders");
    const bookingsCollection = db.collection("bookings");
    const clinics = db.collection("clinics");
    const paymentRecords = db.collection("paymentRecord");

    let paymentOrder = await orders.findOne({
      razorpayOrderId: orderId,
    });

    if (!paymentOrder) {
      return jsonResponse(
        {
          success: false,
          message:
            "Payment order not found. Ensure the create-order API saves orders in paymentOrders.",
        },
        404
      );
    }

    const belongsToUser =
      Boolean(userId) &&
      String(paymentOrder.userId || "") === userId;

    const emailMatches =
      Boolean(userEmail) &&
      String(paymentOrder.userEmail || "").trim().toLowerCase() ===
        userEmail;

    if (!belongsToUser && !emailMatches) {
      return jsonResponse(
        {
          success: false,
          message: "This order belongs to another user.",
        },
        403
      );
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const payment = await razorpay.payments.fetch(paymentId);

    if (
      payment.order_id !== orderId ||
      payment.status !== "captured" ||
      Number(payment.amount) !== Number(paymentOrder.amount) ||
      payment.currency !== paymentOrder.currency
    ) {
      return jsonResponse(
        {
          success: false,
          message: "Payment is not captured or does not match the order.",
        },
        400
      );
    }

    const bookingReference = String(paymentOrder.reference || "");

    if (!bookingReference) {
      return jsonResponse(
        {
          success: false,
          message: "Booking reference is missing.",
        },
        409
      );
    }

    const ownerId = String(paymentOrder.userId || userId);
    const ownerEmail = String(
      paymentOrder.userEmail || userEmail
    ).trim().toLowerCase();

    // Idempotency check: do not create the same booking twice.
    const existingBooking = await bookingsCollection.findOne({
      $or: [
        { bookingReference },
        { razorpayOrderId: orderId },
        { paymentId },
      ],
    });

    if (existingBooking) {
      const sameOwner =
        String(existingBooking.userId || "") === ownerId ||
        Boolean(ownerEmail) &&
          String(existingBooking.userEmail || "")
            .trim()
            .toLowerCase() === ownerEmail;

      if (!sameOwner) {
        return jsonResponse(
          {
            success: false,
            message: "The existing booking belongs to another user.",
          },
          403
        );
      }

      const now = new Date();

      await paymentRecords.updateOne(
        { paymentId },
        {
          $set: {
            paymentId,
            orderId,
            bookingReference: existingBooking.bookingReference,
            userId: ownerId,
            userEmail: ownerEmail,
            clinicId: existingBooking.clinicId,
            doctorId: existingBooking.doctorId,
            amount: payment.amount,
            currency: payment.currency,
            status: "captured",
            bookingStatus: "booked",
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true }
      );

      await orders.updateOne(
        { _id: paymentOrder._id },
        {
          $set: {
            status: "paid",
            paymentStatus: "captured",
            bookingStatus: "booked",
            razorpayPaymentId: paymentId,
            bookingReference: existingBooking.bookingReference,
            paidAt: paymentOrder.paidAt || now,
            updatedAt: now,
          },
        }
      );

      return jsonResponse({
        success: true,
        alreadyProcessed: true,
        booking: existingBooking,
      });
    }

    // Acquire an order-level verification lock.
    const now = new Date();
    const staleLockBefore = new Date(now.getTime() - 2 * 60 * 1000);

    const lockResult = await orders.updateOne(
      {
        _id: paymentOrder._id,
        $or: [
          { status: { $in: ["pending", "created"] } },
          {
            status: "verifying",
            verificationStartedAt: { $lt: staleLockBefore },
          },
          {
            status: "verifying",
            verificationStartedAt: { $exists: false },
          },
        ],
      },
      {
        $set: {
          status: "verifying",
          verificationStartedAt: now,
          updatedAt: now,
        },
      }
    );

    if (lockResult.modifiedCount !== 1) {
      const retryBooking = await bookingsCollection.findOne({
        $or: [
          { bookingReference },
          { razorpayOrderId: orderId },
          { paymentId },
        ],
      });

      if (retryBooking) {
        return jsonResponse({
          success: true,
          alreadyProcessed: true,
          booking: retryBooking,
        });
      }

      return jsonResponse(
        {
          success: false,
          message:
            "This payment is already being processed or cannot be confirmed. Please retry shortly.",
        },
        409
      );
    }

    lockedOrderId = paymentOrder._id;
    lockAcquired = true;

    const clinicId = String(paymentOrder.clinicId || "");
    const doctorId = String(paymentOrder.doctorId || "");
    const patient = paymentOrder.patient || {};
    const appointment = paymentOrder.appointment || {};
    const slot = appointment.slot || {};

    if (
      !clinicId ||
      !doctorId ||
      !appointment.date ||
      !slot.open ||
      !slot.close ||
      !String(patient.name || "").trim()
    ) {
      return jsonResponse(
        {
          success: false,
          message: "Booking information is incomplete.",
        },
        409
      );
    }

    const clinic = await clinics.findOne({
      id: clinicId,
      doctors: {
        $elemMatch: { id: doctorId },
      },
    });

    const doctor = clinic?.doctors?.find(
      (item) => String(item.id) === doctorId
    );

    if (!clinic || !doctor) {
      return jsonResponse(
        {
          success: false,
          message: "Clinic or doctor not found.",
        },
        404
      );
    }

    const configuredSlot = getConfiguredSlot(
      doctor,
      appointment.date,
      slot
    );

    if (!configuredSlot) {
      return jsonResponse(
        {
          success: false,
          message: "The selected appointment slot is no longer available.",
        },
        409
      );
    }

    const duration = Math.max(1, Number(doctor.duration) || 30);

    const configuredStartMinutes = getQueueStartTime(
      doctor,
      appointment.date,
      slot
    );

    if (configuredStartMinutes === null) {
      return jsonResponse(
        {
          success: false,
          message: "Could not determine the doctor's checkup start time.",
        },
        409
      );
    }

    // Only bookings stored in the bookings collection determine the queue.
    const sameQueue = await bookingsCollection
      .find({
        clinicId,
        doctorId,
        date: appointment.date,
        "slot.open": slot.open,
        "slot.close": slot.close,
        status: { $in: ACTIVE_STATUSES },
      })
      .toArray();

    const queue = sortQueue(sameQueue);

    const capacity = Number(configuredSlot.capacity);

    if (
      Number.isFinite(capacity) &&
      capacity > 0 &&
      queue.length >= capacity
    ) {
      // The payment is already captured, so do not pretend it was refunded.
      await paymentRecords.updateOne(
        { paymentId },
        {
          $set: {
            paymentId,
            orderId,
            bookingReference,
            userId: ownerId,
            userEmail: ownerEmail,
            clinicId,
            doctorId,
            amount: payment.amount,
            currency: payment.currency,
            status: "captured",
            bookingStatus: "capacity_conflict",
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );

      await orders.updateOne(
        { _id: paymentOrder._id },
        {
          $set: {
            status: "paid",
            paymentStatus: "captured",
            bookingStatus: "capacity_conflict",
            razorpayPaymentId: paymentId,
            updatedAt: new Date(),
          },
          $unset: {
            verificationStartedAt: "",
          },
        }
      );

      lockAcquired = false;

      return jsonResponse(
        {
          success: false,
          paymentCaptured: true,
          message:
            "Payment was captured, but this slot has reached capacity. Please contact support for a refund or another slot.",
        },
        409
      );
    }

    const sequence =
      Math.max(
        0,
        ...queue.map((item) => Number(item.sequence) || 0)
      ) + 1;

    const effectiveStartMinutes = getEffectiveQueueStart({
      appointmentDate: appointment.date,
      slot,
      configuredStartMinutes,
      queue,
      now: new Date(),
    });

    // Existing queue members each occupy one consultation duration.
    const expectedTurnAt = makeIndiaDate(
      appointment.date,
      effectiveStartMinutes + queue.length * duration
    );

    const bookingNow = new Date();

    const booking = {
  bookingReference,
  token: `A${String(sequence).padStart(3, "0")}`,
  sequence,

  userId: ownerId,
  userEmail: ownerEmail,

  clinicId,
  clinicName: clinic.name || clinic.clinicName || "",
  address: clinic.address || "",

  doctorId,
  doctorName: doctor.name || doctor.doctorName || "",
  duration,

  serviceName: "Consultation",
  date: appointment.date,
  slot,

  patient: {
    name: String(patient.name).trim(),
    type: patient.type || "self",
    age: patient.age ?? null,
    gender: patient.gender || "",
  },

  priority:
    patient.type === "elderly" ? "elderly" : "normal",

  status: "waiting",
  paymentStatus: "paid",

  razorpayOrderId: orderId,
  paymentId,
  amount: payment.amount,
  currency: payment.currency,

  createdAt: bookingNow,
};

const bookingInsert = await bookingsCollection.insertOne(booking);

const savedBooking = {
  ...booking,
  _id: bookingInsert.insertedId,
};



  

    await paymentRecords.updateOne(
      { paymentId },
      {
        $set: {
          paymentId,
          orderId,
          bookingReference,
          userId: ownerId,
          userEmail: ownerEmail,
          clinicId,
          doctorId,
          amount: payment.amount,
          currency: payment.currency,
          status: "captured",
          bookingStatus: "booked",
          updatedAt: bookingNow,
        },
        $setOnInsert: {
          createdAt: bookingNow,
        },
      },
      { upsert: true }
    );

    await orders.updateOne(
      { _id: paymentOrder._id },
      {
        $set: {
          status: "paid",
          paymentStatus: "captured",
          bookingStatus: "booked",
          razorpayPaymentId: paymentId,
          bookingReference,
          paidAt: bookingNow,
          updatedAt: bookingNow,
        },
        $unset: {
          verificationStartedAt: "",
        },
      }
    );

    lockAcquired = false;

    return jsonResponse({
      success: true,
      message: "Payment verified and booking confirmed.",
      booking: savedBooking,
    });
  } catch (error) {
    console.error("Payment verification error:", error);

    if (db && lockedOrderId && lockAcquired) {
      try {
        await db.collection("paymentOrders").updateOne(
          {
            _id: lockedOrderId,
            status: "verifying",
          },
          {
            $set: {
              status: "pending",
              updatedAt: new Date(),
            },
            $unset: {
              verificationStartedAt: "",
            },
          }
        );
      } catch (resetError) {
        console.error(
          "Failed to reset payment verification lock:",
          resetError
        );
      }
    }

    return jsonResponse(
      {
        success: false,
        message: "Unable to verify payment or save the booking.",
      },
      500
    );
  }
}
