import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

const CANCELLABLE_STATUSES = [
  "waiting",
  "confirmed",
  "booked",
  "pending",
];

const BLOCKED_STATUSES = [
  "cancelled",
  "completed",
  "serving",
  "in-progress",
  "skipped",
  "refunded",
  "failed",
  "rejected",
  "cancellation-processing",
];

// --------------------------------------------------
// COMMON HELPERS
// --------------------------------------------------

function jsonError(message, status = 400) {
  return NextResponse.json(
    { success: false, message },
    { status }
  );
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeStatus(status) {
  return String(status || "waiting")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-")
    .replaceAll(" ", "-");
}

function getCreatedAt(booking) {
  if (!booking?.createdAt) return null;

  const date =
    booking.createdAt instanceof Date
      ? booking.createdAt
      : new Date(booking.createdAt);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getCancellationInfo(createdAt, cancelledAt, cancelledBy = "patient") {
  const isDoctorCancellation =
    cancelledBy === "doctor" || cancelledBy === "staff";

  const elapsedMs =
    cancelledAt.getTime() - createdAt.getTime();

  if (elapsedMs < 0) {
    throw new Error(
      "Booking creation time is later than cancellation time."
    );
  }

  const elapsedMinutes = Math.floor(elapsedMs / 60000);

  // Doctor/staff cancellation ALWAYS bypasses 2-hour check and gets full refund
  const cancelledWithinTwoHours =
    isDoctorCancellation || elapsedMs <= TWO_HOURS_MS;

  return {
    cancelledWithinTwoHours,
    elapsedMinutes,
    cancellationWindow: isDoctorCancellation
      ? "doctor-cancellation"
      : cancelledWithinTwoHours
      ? "within-2-hours"
      : "after-2-hours",
    refundEligible: cancelledWithinTwoHours,
  };
}

function isCancellable(status) {
  const normalized = normalizeStatus(status);

  return (
    CANCELLABLE_STATUSES.includes(normalized) &&
    !BLOCKED_STATUSES.includes(normalized)
  );
}

// --------------------------------------------------
// AUTHENTICATION / BOOKING OWNERSHIP
// --------------------------------------------------

function buildUserQuery(token) {
  const clauses = [];

  const ids = [
    String(token.id || "").trim(),
    String(token.sub || "").trim(),
  ].filter(Boolean);

  for (const id of new Set(ids)) {
    clauses.push(
      { userId: id },
      { user: id }
    );

    if (ObjectId.isValid(id) && id.length === 24) {
      const objectId = new ObjectId(id);

      clauses.push(
        { userId: objectId },
        { user: objectId }
      );
    }
  }

  const email = String(token.email || "")
    .trim()
    .toLowerCase();

  if (email) {
    const regex = {
      $regex: `^${escapeRegex(email)}$`,
      $options: "i",
    };

    clauses.push(
      { email: regex },
      { userEmail: regex },
      { userId: email },
      { user: email }
    );
  }

  return clauses;
}

function getIdentifierQuery(identifier) {
  const values = [identifier];

  if (
    ObjectId.isValid(identifier) &&
    identifier.length === 24
  ) {
    values.push(new ObjectId(identifier));
  }

  return [
    { _id: { $in: values } },
    { id: { $in: values } },
    { bookingId: { $in: values } },
    { bookingReference: { $in: values } },
  ];
}

function getRazorpayPaymentId(booking) {
  return (
    booking?.razorpayPaymentId ||
    booking?.paymentId ||
    booking?.payment?.razorpayPaymentId ||
    booking?.payment?.paymentId ||
    booking?.razorpay?.paymentId ||
    null
  );
}

// --------------------------------------------------
// RAZORPAY
// --------------------------------------------------

function getRazorpayCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error(
      "Razorpay credentials are not configured."
    );
  }

  return {
    authorization:
      "Basic " +
      Buffer.from(`${keyId}:${keySecret}`).toString("base64"),
  };
}

async function initiateRazorpayRefund(booking, now, reason = "Cancelled by patient") {
  const paymentId = getRazorpayPaymentId(booking);

  const bookingPaymentStatus = String(
    booking.paymentStatus ||
    booking.payment?.status ||
    ""
  ).toLowerCase();

  const paidStatuses = [
    "paid",
    "captured",
    "success",
    "successful",
  ];

  // No payment means no refund is required.
  if (
    !paymentId &&
    !paidStatuses.includes(bookingPaymentStatus)
  ) {
    return {
      refundStatus: "not-applicable",
      refundId: null,
      refundAmount: null,
      paymentStatus: bookingPaymentStatus || "unpaid",
    };
  }

  if (!paymentId) {
    throw new Error(
      "Payment was successful, but the Razorpay payment ID is missing. Please contact support."
    );
  }

  const credentials = getRazorpayCredentials();

  // Verify payment with Razorpay.
  const paymentResponse = await fetch(
    `https://api.razorpay.com/v1/payments/${encodeURIComponent(
      paymentId
    )}`,
    {
      method: "GET",
      headers: {
        Authorization: credentials.authorization,
      },
      cache: "no-store",
    }
  );

  const paymentData = await paymentResponse.json();

  if (!paymentResponse.ok) {
    console.error(
      "Razorpay payment verification failed:",
      paymentData
    );

    throw new Error(
      paymentData.error?.description ||
      "Unable to verify your payment with Razorpay."
    );
  }

  // Only captured payments can be refunded.
  if (paymentData.status !== "captured") {
    return {
      refundStatus: "not-applicable",
      refundId: null,
      refundAmount: null,
      paymentStatus: paymentData.status,
    };
  }

  // Initiate full refund.
  const refundResponse = await fetch(
    `https://api.razorpay.com/v1/payments/${encodeURIComponent(
      paymentId
    )}/refund`,
    {
      method: "POST",
      headers: {
        Authorization: credentials.authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        notes: {
          reason: reason,
          bookingReference: String(
            booking.bookingReference ||
            booking.bookingId ||
            booking._id ||
            ""
          ),
          requestedAt: now.toISOString(),
        },
      }),
      cache: "no-store",
    }
  );

  const refundData = await refundResponse.json();

  if (!refundResponse.ok) {
    console.error(
      "Razorpay refund failed:",
      refundData
    );

    throw new Error(
      refundData.error?.description ||
      "Unable to initiate refund. Please contact support if the issue continues."
    );
  }

  if (!refundData.id) {
    throw new Error(
      "Razorpay did not return a refund ID. Please verify the refund in your Razorpay dashboard."
    );
  }

  return {
    refundStatus: refundData.status || "pending",
    refundId: refundData.id,

    refundAmount:
      typeof refundData.amount === "number"
        ? refundData.amount
        : paymentData.amount,

    paymentStatus: paymentData.status,
    refundInitiatedAt: now,
    refundExpectedDays: "3-4 working days",
  };
}

// --------------------------------------------------
// REFUND RECORDS
// --------------------------------------------------

function createRefundRecord({ booking, refund, now, cancellationReason }) {
  const paymentId = getRazorpayPaymentId(booking);

  const appointmentDate =
    booking.bookingDate ||
    booking.appointmentDate ||
    booking.date ||
    booking.appointment?.date ||
    null;

  const appointmentTime =
    booking.bookingTime ||
    booking.time ||
    booking.appointmentTime ||
    booking.appointment?.time ||
    null;

  return {
    refundId: refund.refundId,
    refundStatus: refund.refundStatus,
    refundAmount: refund.refundAmount,
    currency: "INR",

    refundInitiatedAt:
      refund.refundInitiatedAt || now,

    refundExpectedDays:
      refund.refundExpectedDays || null,

    userId: String(
      booking.userId || booking.user || ""
    ),

    userName:
      booking.userName ||
      booking.patient?.name ||
      booking.patientName ||
      null,

    userEmail:
      booking.userEmail ||
      booking.email ||
      null,

    userPhone:
      booking.phone ||
      booking.patient?.phone ||
      null,

    bookingId: String(
      booking._id ||
      booking.bookingId ||
      ""
    ),

    bookingReference:
      booking.bookingReference || null,

    clinicId:
      booking.clinicId ||
      booking.clinic?._id ||
      null,

    clinicName:
      booking.clinicName ||
      booking.clinic?.name ||
      null,

    doctorId:
      booking.doctorId ||
      booking.doctor?._id ||
      null,

    doctorName:
      booking.doctorName ||
      booking.doctor?.name ||
      null,

    patient:
      booking.patient || {
        name: booking.patientName || null,
        phone: booking.phone || null,
      },

    appointment: {
      date: appointmentDate,
      time: appointmentTime,
      slot:
        booking.slot ||
        booking.selectedSlot ||
        null,
    },

    paymentId,
    razorpayPaymentId: paymentId,

    razorpayOrderId:
      booking.razorpayOrderId ||
      booking.orderId ||
      booking.payment?.orderId ||
      null,

    originalPaymentAmount:
      booking.amount ??
      booking.payment?.amount ??
      null,

    paymentStatus: "refunded",
    cancellationReason,
    createdAt: now,
    updatedAt: now,
  };
}

async function persistRefundRecords({
  db,
  booking,
  refund,
  now,
  cancellationReason,
}) {
  if (
    refund.refundStatus === "not-applicable" ||
    !refund.refundId
  ) {
    return;
  }

  const refundsCollection = db.collection("refunds");
  const paymentRecordCollection =
    db.collection("paymentRecord");

  const refundRecord = createRefundRecord({
    booking,
    refund,
    now,
    cancellationReason,
  });

  const { createdAt, ...refundFields } = refundRecord;

  await refundsCollection.updateOne(
    { refundId: refund.refundId },
    {
      $set: {
        ...refundFields,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt,
      },
    },
    { upsert: true }
  );

  const paymentId = getRazorpayPaymentId(booking);
  const paymentConditions = [];

  if (paymentId) {
    paymentConditions.push(
      { paymentId },
      { razorpayPaymentId: paymentId }
    );
  }

  if (booking.bookingReference) {
    paymentConditions.push({
      bookingReference: booking.bookingReference,
    });
  }

  if (paymentConditions.length) {
    await paymentRecordCollection.updateMany(
      {
        $or: paymentConditions,
      },
      {
        $set: {
          paymentStatus: "refunded",
          status: "refunded",
          refundStatus: refund.refundStatus,
          refundId: refund.refundId,
          refundAmount: refund.refundAmount,
          refundInitiatedAt:
            refund.refundInitiatedAt || now,
          refundExpectedDays:
            refund.refundExpectedDays || null,
          updatedAt: now,
        },
      }
    );
  }
}

// --------------------------------------------------
// SUCCESS RESPONSE
// --------------------------------------------------

function successResponse(
  bookingId,
  refund,
  cancellationInfo,
  now
) {
  const hasRefund = Boolean(refund.refundId);

  let message;

  if (hasRefund) {
    message =
      "Booking cancelled and refund initiated successfully.";
  } else if (
    !cancellationInfo.cancelledWithinTwoHours
  ) {
    message =
      "Booking cancelled successfully. It was cancelled after 2 hours, so no refund is applicable.";
  } else {
    message =
      "Booking cancelled successfully. No refund was applicable.";
  }

  return NextResponse.json({
    success: true,
    message,
    bookingId,
    status: "cancelled",
    cancelledAt: now,

    cancelledWithinTwoHours:
      cancellationInfo.cancelledWithinTwoHours,

    elapsedMinutes:
      cancellationInfo.elapsedMinutes,

    cancellationWindow:
      cancellationInfo.cancellationWindow,

    refundEligible:
      cancellationInfo.refundEligible,

    refundStatus: refund.refundStatus,
    refundId: refund.refundId,
    refundAmount: refund.refundAmount,

    refundInitiatedAt:
      refund.refundInitiatedAt || null,

    refundExpectedDays:
      refund.refundExpectedDays || null,

    paymentStatus: refund.paymentStatus,
  });
}

// --------------------------------------------------
// CANCEL BOOKING
// --------------------------------------------------

async function cancelDedicatedBooking({
  db,
  bookings,
  booking,
  ownerClauses,
  cancelledBy,
  cancellationReason,
  now,
}) {
  const status = normalizeStatus(booking.status);

  if (
    BLOCKED_STATUSES.includes(status) ||
    !isCancellable(status)
  ) {
    return jsonError(
      "This booking can no longer be cancelled.",
      409
    );
  }

  const createdAt = getCreatedAt(booking);

  if (!createdAt) {
    return jsonError(
      "Booking creation time is missing or invalid.",
      409
    );
  }

  let cancellationInfo;

  try {
    cancellationInfo = getCancellationInfo(
      createdAt,
      now,
      cancelledBy
    );
  } catch (error) {
    return jsonError(error.message, 409);
  }

  const bookingId = String(
    booking._id ||
    booking.bookingId ||
    booking.bookingReference
  );

  const claim = await bookings.updateOne(
    {
      _id: booking._id,
      $and: [
        { $or: ownerClauses },
        { status: booking.status },
        { createdAt: booking.createdAt },
      ],
    },
    {
      $set: {
        status: "cancellation-processing",
        cancellationProcessingAt: now,
      },
    }
  );

  if (claim.modifiedCount !== 1) {
    return jsonError(
      "This booking is already being processed or has changed. Please refresh.",
      409
    );
  }

  let refund = null;

  try {
    if (cancellationInfo.cancelledWithinTwoHours) {
      refund = await initiateRazorpayRefund(
        booking,
        now,
        cancellationReason
      );
    } else {
      refund = {
        refundStatus: "not-eligible",
        refundId: null,
        refundAmount: null,
        paymentStatus:
          booking.paymentStatus ||
          booking.payment?.status ||
          "unknown",
      };
    }

    await persistRefundRecords({
      db,
      booking,
      refund,
      now,
      cancellationReason,
    });

    const result = await bookings.updateOne(
      {
        _id: booking._id,
        status: "cancellation-processing",
      },
      {
        $set: {
          status: "cancelled",
          cancelledBy,
          cancellationReason,
          cancelledAt: now,
          updatedAt: now,

          cancelledWithinTwoHours:
            cancellationInfo.cancelledWithinTwoHours,

          elapsedMinutes:
            cancellationInfo.elapsedMinutes,

          cancellationWindow:
            cancellationInfo.cancellationWindow,

          refundEligible:
            cancellationInfo.refundEligible,

          paymentStatus:
            refund.refundStatus === "completed" || refund.refundStatus === "initiated" || refund.refundId
              ? "refunded"
              : refund.paymentStatus,
          refundStatus: refund.refundStatus,
          refundId: refund.refundId,
          refundAmount: refund.refundAmount,

          refundInitiatedAt:
            refund.refundInitiatedAt || null,

          refundExpectedDays:
            refund.refundExpectedDays || null,
        },

        $unset: {
          cancellationProcessingAt: "",
        },
      }
    );

    if (result.modifiedCount !== 1) {
      console.error(
        "Refund initiated but booking finalization failed:",
        bookingId,
        refund.refundId
      );

      return jsonError(
        "Refund was initiated, but booking status could not be updated. Please contact support with booking reference " +
          bookingId,
        500
      );
    }

    return successResponse(
      bookingId,
      refund,
      cancellationInfo,
      now
    );
  } catch (error) {
    if (!refund?.refundId) {
      await bookings.updateOne(
        {
          _id: booking._id,
          status: "cancellation-processing",
        },
        {
          $set: {
            status: booking.status,
          },
          $unset: {
            cancellationProcessingAt: "",
          },
        }
      );
    }

    throw error;
  }
}

// --------------------------------------------------
// POST /api/my-bookings/cancel
// --------------------------------------------------

export async function POST(request) {
  try {
    const secret =
      process.env.AUTH_SECRET ||
      process.env.NEXTAUTH_SECRET;

    if (!secret) {
      return jsonError(
        "Authentication configuration is missing.",
        500
      );
    }

    const token = await getToken({
      req: request,
      secret,
    });

    if (!token) {
      return jsonError(
        "Please log in to cancel your booking.",
        401
      );
    }

    if (!process.env.MONGODB) {
      return jsonError(
        "Database configuration is missing.",
        500
      );
    }

    const body = await request.json().catch(() => ({}));

    const bookingId = String(
      body.bookingId ||
      body.id ||
      body._id ||
      ""
    ).trim();

    if (!bookingId || bookingId.length > 200) {
      return jsonError(
        "A valid booking ID is required.",
        400
      );
    }

    const cancelledBy = String(body.cancelledBy || "patient")
      .trim()
      .toLowerCase();

    const cancellationReason = String(
      body.cancellationReason ||
        (cancelledBy === "doctor" ? "Cancelled by doctor" : "Cancelled by patient")
    ).trim();

    const ownerClauses = buildUserQuery(token);

    if (!ownerClauses.length) {
      return jsonError(
        "Unable to identify your account.",
        400
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);
    const bookings = db.collection("bookings");
    const now = new Date();

    const booking = await bookings.findOne({
      $and: [
        { $or: ownerClauses },
        { $or: getIdentifierQuery(bookingId) },
      ],
    });

    if (!booking) {
      return jsonError(
        "Booking not found in the bookings collection, or you do not have permission to cancel it.",
        404
      );
    }

    return await cancelDedicatedBooking({
      db,
      bookings,
      booking,
      ownerClauses,
      cancelledBy,
      cancellationReason,
      now,
    });
  } catch (error) {
    console.error(
      "POST /api/my-bookings/cancel error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Failed to cancel booking.",
      },
      { status: 500 }
    );
  }
}