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

const DEFAULT_SERVICE_NAMES = {
  clinic: "General Consultation",
  saloon: "Salon Appointment",
  "beauty-parlour": "Beauty Service",
  "diagnostic-centre": "Diagnostic Test",
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
  if (value instanceof ObjectId) return value.toString();
  if (typeof value === "object") {
    if (typeof value.toHexString === "function") return value.toHexString();
    if (typeof value.$oid === "string") return value.$oid;
    return normalizeId(
      value._id ?? value.id ?? value.teamMemberId ?? value.employeeId ?? ""
    );
  }
  return String(value).trim();
}

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function getBusinessIds(business) {
  return [
    normalizeId(business?.id),
    normalizeId(business?._id),
  ].filter(Boolean);
}

function getAssignedBusinessIds(member) {
  const ids = [
    member?.clinicId,
    member?.storeId,
    member?.businessId,
    member?.assignedClinicId,
    member?.assignedStoreId,
    member?.assignedBusinessId,
    member?.clinic?._id,
    member?.clinic?.id,
    member?.store?._id,
    member?.store?.id,
    member?.business?._id,
    member?.business?.id,
  ];

  const arrayFields = [
    member?.clinicIds,
    member?.storeIds,
    member?.businessIds,
    member?.assignedClinics,
    member?.assignedStores,
    member?.assignedBusinesses,
  ];

  for (const list of arrayFields) {
    if (Array.isArray(list)) {
      ids.push(...list.map(normalizeId));
    }
  }

  return [...new Set(ids.map(normalizeId).filter(Boolean))];
}

function getBusinessName(business) {
  return (
    business?.name ||
    business?.clinicName ||
    business?.storeName ||
    business?.businessName ||
    ""
  );
}

function getProviderName(provider) {
  return (
    provider?.fullName ||
    provider?.name ||
    provider?.doctorName ||
    provider?.staffName ||
    ""
  );
}

function parseTime(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i.exec(
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

function normalizePriority(paymentOrder) {
  const priority = String(paymentOrder?.priority || "normal")
    .trim()
    .toLowerCase();

  const isEmergency =
    paymentOrder?.isEmergency === true || priority === "emergency";

  if (isEmergency) return "emergency";
  if (priority === "elderly") return "elderly";

  return "normal";
}

function sortQueue(items) {
  return [...items].sort((a, b) => {
    const difference = priorityRank(a.priority) - priorityRank(b.priority);
    if (difference !== 0) return difference;

    const sequenceA = Number(a.sequence) || Number.MAX_SAFE_INTEGER;
    const sequenceB = Number(b.sequence) || Number.MAX_SAFE_INTEGER;

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

function getConfiguredSlot(provider, dateString, selectedSlot) {
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

  const dayKey =
    dayNames[new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay()];

  const scheduleDay = getScheduleDay(provider?.schedule, dayKey);

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

async function findBusiness(collection, businessId) {
  const conditions = [{ id: businessId }, { _id: businessId }];

  if (ObjectId.isValid(businessId)) {
    conditions.push({ _id: new ObjectId(businessId) });
  }

  return collection.findOne({ $or: conditions });
}

async function findProvider(team, providerId, category) {
  if (!ObjectId.isValid(providerId)) return null;

  const isClinic = category === "clinic";

  return team.findOne({
    _id: new ObjectId(providerId),
    isActive: { $ne: false },
    $or: [
      { category },
      ...(isClinic ? [{ category: { $exists: false } }] : []),
    ],
  });
}

function getCreatedBy(paymentOrder) {
  const creator = paymentOrder?.createdBy || {};

  return {
    id: normalizeId(creator.id || paymentOrder?.userId),
    role: String(creator.role || "patient").trim().toLowerCase(),
    name: String(creator.name || "").trim(),
    email: normalizeEmail(creator.email || paymentOrder?.userEmail),
  };
}

async function savePaymentRecord(
  paymentRecords,
  {
    paymentId,
    orderId,
    bookingReference,
    userId,
    userEmail,
    createdBy,
    businessId,
    providerId,
    isClinic,
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
        createdBy: createdBy || {
          id: userId,
          role: "patient",
          name: "",
          email: userEmail,
        },
        businessId,
        providerId,
        ...(isClinic
          ? { clinicId: businessId, doctorId: providerId }
          : { storeId: businessId, staffId: providerId }),
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

/*
 * Emergency notification helper.
 * Calls /api/notifications/send only when invoked for an emergency booking.
 */
async function sendEmergencyNotification(
  request,
  { providerId, doctorId, patientName, arrivalTime, bookingReference }
) {
  try {
    const targetId = providerId || doctorId;

    if (!targetId || !bookingReference) {
      return {
        success: false,
        pushSent: 0,
        saved: 0,
        reason: "Missing provider ID or booking reference",
      };
    }

    const arrivalMessage =
      arrivalTime !== null &&
      arrivalTime !== undefined &&
      String(arrivalTime).trim() !== ""
        ? `within ${arrivalTime} minutes`
        : "as soon as possible";

    const message =
      `Emergency patient ${patientName} will arrive ` +
      `${arrivalMessage}. Please prepare for the patient's arrival.`;

    const notificationUrl = new URL("/api/notifications/send", request.url);
    const cookie = request.headers.get("cookie");

    const response = await fetch(notificationUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      cache: "no-store",
      body: JSON.stringify({
        doctorId: targetId,
        providerId: targetId,
        title: "Emergency Patient Arrival",
        message,
        url: "/doctor/dashboard",
        dedupeKey: `emergency-${bookingReference}`,
      }),
    });

    const result = await response.json().catch(() => ({}));

    return {
      success: response.ok && result.success === true,
      pushSent: Number(result.pushSent || 0),
      saved: Number(result.saved || 0),
      result,
    };
  } catch (error) {
    console.error("Emergency notification error:", error);

    return {
      success: false,
      pushSent: 0,
      saved: 0,
      error: error.message || "Notification request failed",
    };
  }
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
    const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

    if (!keyId || !keySecret || !authSecret || !process.env.MONGODB) {
      return jsonResponse(
        {
          success: false,
          message: "Payment verification is not configured.",
        },
        500
      );
    }

    // 1. Authenticate the account that initiated payment.
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

    // 5. Validate ownership using the account that created the order.
    const createdBy = getCreatedBy(paymentOrder);
    const ownerId = createdBy.id;
    const ownerEmail = createdBy.email;

    const belongsById =
      Boolean(tokenUserId) && Boolean(ownerId) && tokenUserId === ownerId;

    const belongsByEmail =
      Boolean(tokenEmail) && Boolean(ownerEmail) && tokenEmail === ownerEmail;

    if (!belongsById && !belongsByEmail) {
      return jsonResponse(
        {
          success: false,
          message: "This order belongs to another user.",
        },
        403
      );
    }

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
          message: "Payment is not captured or does not match the order.",
        },
        400
      );
    }

    const category = String(paymentOrder.category || "clinic")
      .trim()
      .toLowerCase();

    if (!Object.hasOwn(CATEGORY_COLLECTIONS, category)) {
      return jsonResponse(
        {
          success: false,
          message: "Unsupported booking category.",
        },
        400
      );
    }

    const isClinic = category === "clinic";
    const collectionName = CATEGORY_COLLECTIONS[category];
    const now = new Date();

    // 7. Read saved customer/patient and appointment details.
    const customer = paymentOrder.customer || paymentOrder.patient || {};
    const appointment = paymentOrder.appointment || {};
    const slot = appointment.slot || {};

    const customerName = String(
      customer.name ||
        paymentOrder.customerName ||
        paymentOrder.patientName ||
        ""
    ).trim();

    const customerPhone = String(
      customer.phone ||
        paymentOrder.customerPhone ||
        paymentOrder.patientPhone ||
        paymentOrder.phone ||
        ""
    ).trim();

    const customerType = String(
      customer.type ||
        paymentOrder.bookingFor ||
        paymentOrder.patientType ||
        "self"
    ).trim();

    const customerAge = customer.age ?? paymentOrder.age ?? null;

    const customerGender = String(
      customer.gender || paymentOrder.gender || ""
    ).trim();

    const priority = normalizePriority(paymentOrder);
    const isEmergency = priority === "emergency";

    const bookingType = String(
      paymentOrder.bookingType || "appointment"
    ).trim();

    const arrivalTime =
      appointment.arrivalTime ?? paymentOrder.arrivalTime ?? null;

    // 8. Idempotency: do not create a duplicate booking.
    const existingBooking = await bookings.findOne({
      $or: [
        { bookingReference },
        { razorpayOrderId: orderId },
        { paymentId },
      ],
    });

    if (existingBooking) {
      const existingOwnerId = normalizeId(existingBooking.userId);
      const existingOwnerEmail = normalizeEmail(existingBooking.userEmail);

      const sameOwner =
        (ownerId && existingOwnerId === ownerId) ||
        (ownerEmail && existingOwnerEmail === ownerEmail);

      if (!sameOwner) {
        return jsonResponse(
          {
            success: false,
            message: "The existing booking belongs to another user.",
          },
          403
        );
      }

      const existingBusinessId = normalizeId(
        existingBooking.businessId ||
          existingBooking.clinicId ||
          existingBooking.storeId
      );
      const existingProviderId = normalizeId(
        existingBooking.providerId ||
          existingBooking.doctorId ||
          existingBooking.staffId
      );

      await savePaymentRecord(paymentRecords, {
        paymentId,
        orderId,
        bookingReference: existingBooking.bookingReference,
        userId: ownerId,
        userEmail: ownerEmail,
        createdBy,
        businessId: existingBusinessId,
        providerId: existingProviderId,
        isClinic,
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

      let notificationResult = null;

      if (isEmergency && ACTIVE_STATUSES.includes(existingBooking.status)) {
        notificationResult = await sendEmergencyNotification(request, {
          providerId: existingProviderId,
          doctorId: existingProviderId,
          patientName:
            existingBooking.customerName ||
            existingBooking.patientName ||
            existingBooking.patient?.name ||
            customerName,
          arrivalTime: existingBooking.arrivalTime ?? arrivalTime,
          bookingReference:
            existingBooking.bookingReference || bookingReference,
        });
      }

      return jsonResponse({
        success: true,
        alreadyProcessed: true,
        notificationSent:
          notificationResult?.success === true &&
          notificationResult?.pushSent > 0,
        notificationResult,
        booking: existingBooking,
      });
    }

    // 9. Acquire a verification lock for this payment order.
    const staleLockBefore = new Date(Date.now() - 2 * 60 * 1000);

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
      const retryBooking = await bookings.findOne({
        $or: [
          { bookingReference },
          { razorpayOrderId: orderId },
          { paymentId },
        ],
      });

      if (
        retryBooking &&
        ((ownerId && normalizeId(retryBooking.userId) === ownerId) ||
          (ownerEmail && normalizeEmail(retryBooking.userEmail) === ownerEmail))
      ) {
        let notificationResult = null;

        if (isEmergency && ACTIVE_STATUSES.includes(retryBooking.status)) {
          const retryProviderId = normalizeId(
            retryBooking.providerId ||
              retryBooking.doctorId ||
              retryBooking.staffId
          );

          notificationResult = await sendEmergencyNotification(request, {
            providerId: retryProviderId,
            doctorId: retryProviderId,
            patientName:
              retryBooking.customerName ||
              retryBooking.patientName ||
              retryBooking.patient?.name ||
              customerName,
            arrivalTime: retryBooking.arrivalTime ?? arrivalTime,
            bookingReference:
              retryBooking.bookingReference || bookingReference,
          });
        }

        return jsonResponse({
          success: true,
          alreadyProcessed: true,
          notificationSent:
            notificationResult?.success === true &&
            notificationResult?.pushSent > 0,
          notificationResult,
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

    // 10. Validate saved appointment details.
    const businessId = normalizeId(
      paymentOrder.businessId ||
        paymentOrder.clinicId ||
        paymentOrder.storeId
    );
    const providerId = normalizeId(
      paymentOrder.providerId ||
        paymentOrder.doctorId ||
        paymentOrder.staffId
    );

    if (
      !businessId ||
      !ObjectId.isValid(providerId) ||
      !isValidDateString(appointment.date) ||
      !slot.open ||
      !slot.close ||
      !customerName
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

    // 11. Find the business (clinic / salon / parlour / diagnostic).
    const businesses = db.collection(collectionName);
    const business = await findBusiness(businesses, businessId);

    if (!business) {
      await releaseLock();

      return jsonResponse(
        {
          success: false,
          message: "Business not found.",
        },
        404
      );
    }

    const businessIds = getBusinessIds(business);

    // 12. Validate provider membership in the business.
    const rawProviderList = [
      ...(Array.isArray(business.doctors) ? business.doctors : []),
      ...(Array.isArray(business.staff) ? business.staff : []),
      ...(Array.isArray(business.team) ? business.team : []),
      ...(Array.isArray(business.members) ? business.members : []),
    ];

    const linkedProviderIds = rawProviderList
      .map(normalizeId)
      .filter(Boolean);

    if (
      linkedProviderIds.length > 0 &&
      !linkedProviderIds.includes(providerId)
    ) {
      await releaseLock();

      return jsonResponse(
        {
          success: false,
          message: "This specialist is not assigned to the selected business.",
        },
        404
      );
    }

    // 13. Fetch provider by MongoDB ObjectId.
    const provider = await findProvider(team, providerId, category);

    if (!provider) {
      await releaseLock();

      return jsonResponse(
        {
          success: false,
          message: "Specialist not found or inactive.",
        },
        404
      );
    }

    const providerAssignedIds = getAssignedBusinessIds(provider);

    if (
      providerAssignedIds.length > 0 &&
      !providerAssignedIds.some((id) => businessIds.includes(id))
    ) {
      await releaseLock();

      return jsonResponse(
        {
          success: false,
          message: "Specialist is not assigned to this business.",
        },
        409
      );
    }

    // 14. Validate the slot against the provider's current schedule.
    const configuredSlot = getConfiguredSlot(provider, appointment.date, slot);

    if (!configuredSlot) {
      console.error("Verification slot mismatch:", {
        providerId,
        category,
        appointmentDate: appointment.date,
        requestedSlot: slot,
        savedSchedule: provider.schedule,
      });

      await releaseLock();

      return jsonResponse(
        {
          success: false,
          message: "The selected appointment slot is no longer available.",
        },
        409
      );
    }

    const rawDuration = Number(
      provider.duration ??
        provider.checkupDuration ??
        provider.serviceDuration ??
        provider.slotDuration ??
        (isClinic ? NaN : 15)
    );

    if (!Number.isFinite(rawDuration) || rawDuration <= 0) {
      await releaseLock();

      return jsonResponse(
        {
          success: false,
          message: "A valid consultation or service duration is not configured.",
        },
        409
      );
    }

    // 15. Load the active queue for this exact slot.
    const queueFilter = {
      $and: [
        {
          $or: [
            { businessId: { $in: businessIds } },
            { clinicId: { $in: businessIds } },
            { storeId: { $in: businessIds } },
          ],
        },
        {
          $or: [
            { providerId },
            { doctorId: providerId },
            { staffId: providerId },
          ],
        },
        { date: appointment.date },
        { "slot.open": configuredSlot.open },
        { "slot.close": configuredSlot.close },
        { status: { $in: ACTIVE_STATUSES } },
      ],
    };

    const queue = sortQueue(await bookings.find(queueFilter).toArray());
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
        createdBy,
        businessId,
        providerId,
        isClinic,
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
          message: "This appointment slot is full.",
          paymentStatus: "captured",
          bookingStatus: "capacity_conflict",
        },
        409
      );
    }

    // 16. Generate the next queue token.
    const sequence =
      Math.max(0, ...queue.map((item) => Number(item.sequence) || 0)) + 1;

    const bookingNow = new Date();
    const resolvedBusinessName = getBusinessName(business);
    const resolvedProviderName = getProviderName(provider);

    const customerData = {
      name: customerName,
      phone: customerPhone,
      type: customerType,
      age: customerAge,
      gender: customerGender,
    };

    // 17. Create booking.
    const booking = {
      bookingReference,

      token: `A${String(sequence).padStart(3, "0")}`,
      sequence,

      userId: ownerId,
      userEmail: ownerEmail,

      createdBy,

      businessId,
      businessName: resolvedBusinessName,
      ...(isClinic
        ? {
            clinicId: businessId,
            clinicName: resolvedBusinessName,
          }
        : {
            storeId: businessId,
            storeName: resolvedBusinessName,
            clinicId: businessId,
            clinicName: resolvedBusinessName,
          }),

      address: business.address || "",

      category,
      collection: collectionName,

      providerId,
      providerName: resolvedProviderName,
      ...(isClinic
        ? {
            doctorId: providerId,
            doctorName: resolvedProviderName,
          }
        : {
            staffId: providerId,
            staffName: resolvedProviderName,
            doctorId: providerId,
            doctorName: resolvedProviderName,
          }),

      duration: rawDuration,

      serviceName:
        paymentOrder.serviceName ||
        DEFAULT_SERVICE_NAMES[category] ||
        "Appointment",
      date: appointment.date,
      time: appointment.time || configuredSlot.open,

      slot: {
        open: configuredSlot.open,
        close: configuredSlot.close,
        ...(configuredSlot.checkupStartTime
          ? { checkupStartTime: configuredSlot.checkupStartTime }
          : slot.checkupStartTime
            ? { checkupStartTime: slot.checkupStartTime }
            : {}),
      },

      customer: customerData,
      patient: customerData,

      customerName,
      customerPhone,
      customerAge,
      customerGender,

      patientName: customerName,
      patientPhone: customerPhone,
      patientAge: customerAge,
      patientGender: customerGender,

      priority,
      isEmergency,
      bookingType,
      arrivalTime,

      status: "waiting",
      paymentStatus: "paid",

      razorpayOrderId: orderId,
      paymentId,
      amount: payment.amount,
      currency: payment.currency,

      createdAt: bookingNow,
      updatedAt: bookingNow,
    };

    // 18. Insert booking.
    const bookingInsert = await bookings.insertOne(booking);

    const savedBooking = {
      ...booking,
      _id: bookingInsert.insertedId,
    };

    // 19. Record captured payment.
    await savePaymentRecord(paymentRecords, {
      paymentId,
      orderId,
      bookingReference,
      userId: ownerId,
      userEmail: ownerEmail,
      createdBy,
      businessId,
      providerId,
      isClinic,
      category,
      collection: collectionName,
      amount: payment.amount,
      currency: payment.currency,
      bookingStatus: "booked",
      now: bookingNow,
    });

    // 20. Mark order as paid.
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

    // 21. Send notification only for emergency bookings.
    let notificationResult = null;

    if (isEmergency) {
      notificationResult = await sendEmergencyNotification(request, {
        providerId,
        doctorId: providerId,
        patientName: customerName,
        arrivalTime,
        bookingReference,
      });
    }

    // 22. Release verification lock.
    lockAcquired = false;

    return jsonResponse({
      success: true,
      message: "Payment verified and booking confirmed.",
      notificationSent:
        notificationResult?.success === true &&
        notificationResult?.pushSent > 0,
      notificationResult,
      booking: savedBooking,
    });
  } catch (error) {
    console.error("Payment verification error:", error?.message || error);

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
        console.error("Failed to reset verification lock:", resetError);
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