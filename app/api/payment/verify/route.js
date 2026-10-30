
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import clientPromise from "@/lib/mongodb";
import Razorpay from "razorpay";
import { createHmac, timingSafeEqual } from "crypto";
import { ObjectId } from "mongodb";

export const runtime = "nodejs";
export const revalidate = 0;

const ACTIVE_STATUSES = ["waiting", "serving", "in-progress"];

const CATEGORY_COLLECTIONS = {
  clinic: "clinics",
  saloon: "saloons",
  "beauty-parlour": "parlour",
  "diagnostic-centre": "diagnostic",
};

function jsonResponse(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

function normalizeId(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function getDoctorId(value) {
  if (typeof value === "string") return value.trim();

  if (value instanceof ObjectId) return value.toString();

  if (value && typeof value === "object") {
    return normalizeId(value._id ?? value.id ?? "");
  }

  return "";
}

function getClinicIds(clinic) {
  return [
    normalizeId(clinic?.id),
    normalizeId(clinic?._id),
  ].filter(Boolean);
}

function getClinicName(clinic) {
  return clinic?.name || clinic?.clinicName || "";
}

function getDoctorName(doctor) {
  return (
    doctor?.fullName ||
    doctor?.name ||
    doctor?.doctorName ||
    ""
  );
}

function parseTime(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const match =
    /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i.exec(
      String(value).trim()
    );

  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();

  if (minute > 59) return null;

  if (meridiem) {
    if (hour < 1 || hour > 12) return null;

    hour %= 12;

    if (meridiem === "PM") {
      hour += 12;
    }
  } else if (hour > 23) {
    return null;
  }

  return hour * 60 + minute;
}

function getIndiaDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function isValidDateString(value) {
  if (typeof value !== "string") return false;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) return false;

  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];

  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function priorityRank(priority) {
  const value = String(priority || "normal").toLowerCase();

  if (value === "emergency") return 0;
  if (value === "elderly") return 1;

  return 2;
}

function sortQueue(items) {
  return [...items].sort((a, b) => {
    const difference =
      priorityRank(a.priority) - priorityRank(b.priority);

    if (difference !== 0) return difference;

    const sequenceA =
      Number(a.sequence) || Number.MAX_SAFE_INTEGER;

    const sequenceB =
      Number(b.sequence) || Number.MAX_SAFE_INTEGER;

    if (sequenceA !== sequenceB) {
      return sequenceA - sequenceB;
    }

    return (
      new Date(a.createdAt || 0).getTime() -
      new Date(b.createdAt || 0).getTime()
    );
  });
}

function getScheduleDay(schedule, dayKey) {
  if (!schedule || typeof schedule !== "object") return null;

  const matchingKey = Object.keys(schedule).find(
    (key) => key.toLowerCase() === dayKey.toLowerCase()
  );

  return matchingKey ? schedule[matchingKey] : null;
}

function getConfiguredSlot(doctor, dateString, selectedSlot) {
  if (!isValidDateString(dateString) || !selectedSlot) {
    return null;
  }

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

  const dayKey = dayNames[
    new Date(
      Date.UTC(year, month - 1, day, 12)
    ).getUTCDay()
  ];

  const scheduleDay = getScheduleDay(
    doctor?.schedule,
    dayKey
  );

  if (!scheduleDay || scheduleDay.active !== true) {
    return null;
  }

  if (!Array.isArray(scheduleDay.slots)) {
    return null;
  }

  const requestedOpen = parseTime(selectedSlot.open);
  const requestedClose = parseTime(selectedSlot.close);

  if (requestedOpen === null || requestedClose === null) {
    return null;
  }

  return (
    scheduleDay.slots.find(
      (item) =>
        parseTime(item?.open) === requestedOpen &&
        parseTime(item?.close) === requestedClose
    ) || null
  );
}

async function findClinic(collection, clinicId) {
  const conditions = [
    { id: clinicId },
    { _id: clinicId },
  ];

  if (ObjectId.isValid(clinicId)) {
    conditions.push({
      _id: new ObjectId(clinicId),
    });
  }

  return collection.findOne({
    $or: conditions,
  });
}

async function findDoctor(team, doctorId) {
  if (!ObjectId.isValid(doctorId)) return null;

  return team.findOne({
    _id: new ObjectId(doctorId),
    role: "doctor",
    category: "clinic",
    isActive: { $ne: false },
  });
}

async function savePaymentRecord(
  paymentRecords,
  {
    paymentId,
    orderId,
    bookingReference,
    userId,
    userEmail,
    clinicId,
    doctorId,
    category,
    collection,
    amount,
    currency,
    bookingStatus,
    now,
  }
) {
  await paymentRecords.updateOne(
    { paymentId },
    {
      $set: {
        paymentId,
        orderId,
        bookingReference,
        userId,
        userEmail,
        clinicId,
        doctorId,
        category,
        collection,
        amount,
        currency,
        status: "captured",
        bookingStatus,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true }
  );
}

export async function POST(request) {
  let db = null;
  let lockedOrderId = null;
  let lockAcquired = false;

  const releaseLock = async () => {
    if (!db || !lockedOrderId || !lockAcquired) return;

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

    lockAcquired = false;
  };

  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const authSecret =
      process.env.AUTH_SECRET ||
      process.env.NEXTAUTH_SECRET;

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

    // 1. Authenticate the user.
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

    const tokenUserId = normalizeId(token.id || token.sub);
    const tokenEmail = normalizeEmail(token.email);

    if (!tokenUserId && !tokenEmail) {
      return jsonResponse(
        {
          success: false,
          message: "User session is incomplete.",
        },
        401
      );
    }

    // 2. Validate the verification request.
    let body;

    try {
      body = await request.json();
    } catch {
      return jsonResponse(
        {
          success: false,
          message: "Invalid request body.",
        },
        400
      );
    }

    const orderId = body?.razorpay_order_id;
    const paymentId = body?.razorpay_payment_id;
    const signature = body?.razorpay_signature;

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

    // 3. Verify the Razorpay signature.
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

    // 4. Connect to MongoDB.
    const client = await clientPromise;
    db = client.db(process.env.MONGODB);

    const orders = db.collection("paymentOrders");
    const bookings = db.collection("bookings");
    const team = db.collection("team");
    const paymentRecords = db.collection("paymentRecord");

    const paymentOrder = await orders.findOne({
      razorpayOrderId: orderId,
    });

    if (!paymentOrder) {
      return jsonResponse(
        {
          success: false,
          message: "Payment order not found.",
        },
        404
      );
    }

    // 5. Verify order ownership.
    const belongsById =
      Boolean(tokenUserId) &&
      normalizeId(paymentOrder.userId) === tokenUserId;

    const belongsByEmail =
      Boolean(tokenEmail) &&
      normalizeEmail(paymentOrder.userEmail) === tokenEmail;

    if (!belongsById && !belongsByEmail) {
      return jsonResponse(
        {
          success: false,
          message: "This order belongs to another user.",
        },
        403
      );
    }

    const ownerId = normalizeId(paymentOrder.userId);
    const ownerEmail = normalizeEmail(paymentOrder.userEmail);
    const bookingReference = normalizeId(paymentOrder.reference);

    if (!bookingReference) {
      return jsonResponse(
        {
          success: false,
          message: "Booking reference is missing.",
        },
        409
      );
    }

    // 6. Verify payment status directly with Razorpay.
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
          message:
            "Payment is not captured or does not match the order.",
        },
        400
      );
    }

    const category = String(
      paymentOrder.category || "clinic"
    ).trim().toLowerCase();

    const collectionName =
      CATEGORY_COLLECTIONS[category] || "clinics";

    // This endpoint currently processes clinic doctor bookings.
    if (category !== "clinic" || collectionName !== "clinics") {
      return jsonResponse(
        {
          success: false,
          message:
            "This verification endpoint only supports clinic bookings.",
        },
        400
      );
    }

    const now = new Date();

    // 7. Idempotency: do not create a duplicate booking.
    const existingBooking = await bookings.findOne({
      $or: [
        { bookingReference },
        { razorpayOrderId: orderId },
        { paymentId },
      ],
    });

    if (existingBooking) {
      const existingOwnerId = normalizeId(existingBooking.userId);
      const existingOwnerEmail = normalizeEmail(
        existingBooking.userEmail
      );

      const sameOwner =
        (ownerId && existingOwnerId === ownerId) ||
        (ownerEmail && existingOwnerEmail === ownerEmail);

      if (!sameOwner) {
        return jsonResponse(
          {
            success: false,
            message:
              "The existing booking belongs to another user.",
          },
          403
        );
      }

      await savePaymentRecord(paymentRecords, {
        paymentId,
        orderId,
        bookingReference: existingBooking.bookingReference,
        userId: ownerId,
        userEmail: ownerEmail,
        clinicId: existingBooking.clinicId,
        doctorId: existingBooking.doctorId,
        category,
        collection: collectionName,
        amount: payment.amount,
        currency: payment.currency,
        bookingStatus: existingBooking.status || "booked",
        now,
      });

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
          $unset: {
            verificationStartedAt: "",
          },
        }
      );

      return jsonResponse({
        success: true,
        alreadyProcessed: true,
        booking: existingBooking,
      });
    }

    // 8. Acquire a verification lock for this payment order.
    const staleLockBefore = new Date(
      Date.now() - 2 * 60 * 1000
    );

    const lockResult = await orders.updateOne(
      {
        _id: paymentOrder._id,
        $or: [
          { status: { $in: ["pending", "created"] } },
          {
            status: "verifying",
            verificationStartedAt: {
              $lt: staleLockBefore,
            },
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
      const retryBooking = await bookings.findOne({
        $or: [
          { bookingReference },
          { razorpayOrderId: orderId },
          { paymentId },
        ],
      });

      if (
        retryBooking &&
        normalizeId(retryBooking.userId) === ownerId
      ) {
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
            "This payment is already being processed. Please retry shortly.",
        },
        409
      );
    }

    lockedOrderId = paymentOrder._id;
    lockAcquired = true;

    // 9. Read the saved appointment data.
    const clinicId = normalizeId(paymentOrder.clinicId);
    const doctorId = normalizeId(paymentOrder.doctorId);
    const patient = paymentOrder.patient || {};
    const appointment = paymentOrder.appointment || {};
    const slot = appointment.slot || {};

    if (
      !clinicId ||
      !ObjectId.isValid(doctorId) ||
      !isValidDateString(appointment.date) ||
      !slot.open ||
      !slot.close ||
      !String(patient.name || "").trim()
    ) {
      await releaseLock();

      return jsonResponse(
        {
          success: false,
          message: "Booking information is incomplete.",
        },
        409
      );
    }

    // 10. Find the clinic.
    const clinics = db.collection(collectionName);
    const clinic = await findClinic(clinics, clinicId);

    if (!clinic) {
      await releaseLock();

      return jsonResponse(
        {
          success: false,
          message: "Clinic not found.",
        },
        404
      );
    }

    // 11. Validate doctor membership in the clinic.
    const clinicDoctorIds = Array.isArray(clinic.doctors)
      ? clinic.doctors.map(getDoctorId)
      : [];

    if (!clinicDoctorIds.includes(doctorId)) {
      await releaseLock();

      return jsonResponse(
        {
          success: false,
          message:
            "This doctor is not assigned to the selected clinic.",
        },
        404
      );
    }

    // 12. Fetch doctor by MongoDB ObjectId.
    const doctor = await findDoctor(team, doctorId);

    if (!doctor) {
      await releaseLock();

      return jsonResponse(
        {
          success: false,
          message: "Doctor not found or inactive.",
        },
        404
      );
    }

    const doctorClinicId = normalizeId(doctor.clinicId);

    if (
      doctorClinicId &&
      !getClinicIds(clinic).includes(doctorClinicId)
    ) {
      await releaseLock();

      return jsonResponse(
        {
          success: false,
          message: "Doctor is not assigned to this clinic.",
        },
        409
      );
    }

    // 13. Validate the slot against the doctor's current schedule.
    const configuredSlot = getConfiguredSlot(
      doctor,
      appointment.date,
      slot
    );

    if (!configuredSlot) {
      console.error("Verification slot mismatch:", {
        doctorId,
        appointmentDate: appointment.date,
        requestedSlot: slot,
        savedSchedule: doctor.schedule,
      });

      await releaseLock();

      return jsonResponse(
        {
          success: false,
          message:
            "The selected appointment slot is no longer available.",
        },
        409
      );
    }

    const duration = Number(
      doctor.duration ?? doctor.checkupDuration
    );

    if (!Number.isFinite(duration) || duration <= 0) {
      await releaseLock();

      return jsonResponse(
        {
          success: false,
          message:
            "A valid consultation duration is not configured.",
        },
        409
      );
    }

    // 14. Load the active queue for this exact slot.
    const queueFilter = {
      clinicId,
      doctorId,
      date: appointment.date,
      "slot.open": configuredSlot.open,
      "slot.close": configuredSlot.close,
      status: { $in: ACTIVE_STATUSES },
    };

    const queue = sortQueue(
      await bookings.find(queueFilter).toArray()
    );

    const capacity = Number(configuredSlot.capacity);

    if (
      Number.isFinite(capacity) &&
      capacity > 0 &&
      queue.length >= capacity
    ) {
      const conflictTime = new Date();

      await savePaymentRecord(paymentRecords, {
        paymentId,
        orderId,
        bookingReference,
        userId: ownerId,
        userEmail: ownerEmail,
        clinicId,
        doctorId,
        category,
        collection: collectionName,
        amount: payment.amount,
        currency: payment.currency,
        bookingStatus: "capacity_conflict",
        now: conflictTime,
      });

      await orders.updateOne(
        { _id: paymentOrder._id },
        {
          $set: {
            status: "paid",
            paymentStatus: "captured",
            bookingStatus: "capacity_conflict",
            razorpayPaymentId: paymentId,
            category,
            collection: collectionName,
            updatedAt: conflictTime,
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
            "Payment was captured, but the slot has reached capacity. Please contact support for a refund or another appointment.",
        },
        409
      );
    }

    // 15. Generate the next queue token.
    const sequence =
      Math.max(
        0,
        ...queue.map((item) => Number(item.sequence) || 0)
      ) + 1;

    const bookingNow = new Date();

    // IMPORTANT: expectedTurnAt is intentionally not calculated or stored.
    const booking = {
      bookingReference,

      token: `A${String(sequence).padStart(3, "0")}`,
      sequence,

      userId: ownerId,
      userEmail: ownerEmail,

      clinicId,
      clinicName: getClinicName(clinic),
      address: clinic.address || "",

      category,
      collection: collectionName,

      doctorId,
      doctorName: getDoctorName(doctor),
      duration,

      serviceName: "Consultation",
      date: appointment.date,
      time: appointment.time || configuredSlot.open,

      slot: {
        open: configuredSlot.open,
        close: configuredSlot.close,
        ...(configuredSlot.checkupStartTime
          ? {
              checkupStartTime:
                configuredSlot.checkupStartTime,
            }
          : slot.checkupStartTime
            ? {
                checkupStartTime: slot.checkupStartTime,
              }
            : {}),
      },

      patient: {
        name: String(patient.name).trim(),
        phone: String(patient.phone || "").trim(),
        type: patient.type || "self",
        age: patient.age ?? null,
        gender: patient.gender || "",
      },

      priority:
        String(patient.type || "").toLowerCase() === "elderly"
          ? "elderly"
          : "normal",

      status: "waiting",
      paymentStatus: "paid",

      razorpayOrderId: orderId,
      paymentId,
      amount: payment.amount,
      currency: payment.currency,

      createdAt: bookingNow,
      updatedAt: bookingNow,
    };

    // 16. Insert the booking.
    const bookingInsert = await bookings.insertOne(booking);

    const savedBooking = {
      ...booking,
      _id: bookingInsert.insertedId,
    };

    // 17. Record the captured payment.
    await savePaymentRecord(paymentRecords, {
      paymentId,
      orderId,
      bookingReference,
      userId: ownerId,
      userEmail: ownerEmail,
      clinicId,
      doctorId,
      category,
      collection: collectionName,
      amount: payment.amount,
      currency: payment.currency,
      bookingStatus: "booked",
      now: bookingNow,
    });

    // 18. Mark the order as paid.
    await orders.updateOne(
      { _id: paymentOrder._id },
      {
        $set: {
          status: "paid",
          paymentStatus: "captured",
          bookingStatus: "booked",
          razorpayPaymentId: paymentId,
          bookingReference,
          category,
          collection: collectionName,
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
    console.error(
      "Payment verification error:",
      error?.message || error
    );

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

        lockAcquired = false;
      } catch (resetError) {
        console.error(
          "Failed to reset verification lock:",
          resetError
        );
      }
    }

    return jsonResponse(
      {
        success: false,
        message:
          "Unable to verify payment or save the booking. If your payment was captured, retry verification or contact support.",
      },
      500
    );
  }
}
