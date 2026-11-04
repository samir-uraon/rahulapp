
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

const CANCELLATION_REASON = "Cancelled by patient";

// --------------------------------------------------
// COMMON HELPERS
// --------------------------------------------------

function jsonError(message, status = 400) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    { status }
  );
}

function escapeRegex(value) {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
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

function isCancellable(status) {
  return CANCELLABLE_STATUSES.includes(
    normalizeStatus(status)
  );
}

function isWithinCancellationPeriod(createdAt, now) {
  const elapsed =
    now.getTime() - createdAt.getTime();

  return (
    elapsed >= 0 &&
    elapsed <= TWO_HOURS_MS
  );
}

// --------------------------------------------------
// AUTHENTICATION
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

function buildUserDocumentQuery(token) {
  const clauses = [];

  const ids = [
    String(token.id || "").trim(),
    String(token.sub || "").trim(),
  ].filter(Boolean);

  for (const id of new Set(ids)) {
    clauses.push({ _id: id });

    if (ObjectId.isValid(id) && id.length === 24) {
      clauses.push({
        _id: new ObjectId(id),
      });
    }
  }

  const email = String(token.email || "")
    .trim()
    .toLowerCase();

  if (email) {
    clauses.push({
      email: {
        $regex: `^${escapeRegex(email)}$`,
        $options: "i",
      },
    });
  }

  return clauses;
}

// --------------------------------------------------
// BOOKING IDENTIFIERS
// --------------------------------------------------

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

function getBookingIdentifiers(booking) {
  return [
    booking?._id,
    booking?.id,
    booking?.bookingId,
    booking?.bookingReference,
  ]
    .filter(Boolean)
    .map(String);
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
      Buffer.from(
        `${keyId}:${keySecret}`
      ).toString("base64"),
  };
}

async function initiateRazorpayRefund(booking, now) {
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

  // No successful payment: no refund required.
  if (
    !paymentId &&
    !paidStatuses.includes(bookingPaymentStatus)
  ) {
    return {
      refundStatus: "not-applicable",
      refundId: null,
      refundAmount: null,
      paymentStatus:
        bookingPaymentStatus || "unpaid",
    };
  }

  if (!paymentId) {
    throw new Error(
      "Payment was successful, but the Razorpay payment ID is missing. Please contact support."
    );
  }

  const credentials = getRazorpayCredentials();

  // Verify payment directly with Razorpay.
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

  // Full refund: no amount means the full captured amount.
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
          reason: CANCELLATION_REASON,
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

    // Razorpay amounts are in paise.
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
// REFUND RECORD CREATION
// --------------------------------------------------

function createRefundRecord({
  booking,
  user,
  refund,
  now,
}) {
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

    // Amount is stored in paise.
    refundAmount: refund.refundAmount,
    currency: "INR",

    refundInitiatedAt:
      refund.refundInitiatedAt || now,

    refundExpectedDays:
      refund.refundExpectedDays || null,

    // User details
    userId: String(
      user?._id ||
      booking.userId ||
      booking.user ||
      ""
    ),

    userName:
      user?.name ||
      booking.userName ||
      booking.patient?.name ||
      booking.patientName ||
      null,

    userEmail:
      user?.email ||
      booking.userEmail ||
      booking.email ||
      null,

    userPhone:
      user?.phone ||
      user?.mobile ||
      booking.phone ||
      booking.patient?.phone ||
      null,

    // Booking details
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
        name:
          booking.patientName ||
          user?.name ||
          null,
        phone:
          booking.phone ||
          user?.phone ||
          null,
      },

    appointment: {
      date: appointmentDate,
      time: appointmentTime,
      slot:
        booking.slot ||
        booking.selectedSlot ||
        null,
    },

    // Payment details
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

    cancellationReason: CANCELLATION_REASON,

    createdAt: now,
    updatedAt: now,
  };
}

// --------------------------------------------------
// UPDATE USERS EMBEDDED BOOKING
// --------------------------------------------------

async function updateEmbeddedBooking({
  users,
  user,
  booking,
  refund,
  now,
}) {
  if (!user?._id) return;

  const identifiers = getBookingIdentifiers(booking);

  if (!identifiers.length) return;

  const identifierClauses = [];

  for (const identifier of identifiers) {
    const values = [identifier];

    if (
      ObjectId.isValid(identifier) &&
      identifier.length === 24
    ) {
      values.push(new ObjectId(identifier));
    }

    identifierClauses.push(
      { _id: { $in: values } },
      { id: { $in: values } },
      { bookingId: { $in: values } },
      { bookingReference: { $in: values } }
    );
  }

  await users.updateOne(
    {
      _id: user._id,
      bookings: {
        $elemMatch: {
          $or: identifierClauses,
        },
      },
    },
    {
      $set: {
        "bookings.$.status": "cancelled",
        "bookings.$.cancelledAt": now,
        "bookings.$.updatedAt": now,
        "bookings.$.cancellationReason":
          CANCELLATION_REASON,

        "bookings.$.paymentStatus":
          refund.paymentStatus,

        "bookings.$.refundStatus":
          refund.refundStatus,

        "bookings.$.refundId":
          refund.refundId,

        "bookings.$.refundAmount":
          refund.refundAmount,

        "bookings.$.refundInitiatedAt":
          refund.refundInitiatedAt || null,

        "bookings.$.refundExpectedDays":
          refund.refundExpectedDays || null,
      },
    }
  );
}

// --------------------------------------------------
// SAVE REFUND IN ALL COLLECTIONS
// --------------------------------------------------

async function persistRefundRecords({
  db,
  booking,
  user,
  refund,
  now,
}) {
  // Do not create refund history for unpaid bookings.
  if (
    refund.refundStatus === "not-applicable" ||
    !refund.refundId
  ) {
    return;
  }

  const refundsCollection =
    db.collection("refunds");

  const paymentRecordCollection =
    db.collection("paymentRecord");

  const usersCollection =
    db.collection("users");

  const refundRecord = createRefundRecord({
    booking,
    user,
    refund,
    now,
  });

  // 1. REFUNDS COLLECTION
  // One document per Razorpay refund ID.
  const { createdAt, ...refundFields } = refundRecord;

  await refundsCollection.updateOne(
    {
      refundId: refund.refundId,
    },
    {
      $set: {
        ...refundFields,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt,
      },
    },
    {
      upsert: true,
    }
  );

  // 2. PAYMENT RECORD COLLECTION
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

  // 3. USERS COLLECTION
  if (user?._id) {
    await usersCollection.updateOne(
      {
        _id: user._id,
      },
      {
        $addToSet: {
          refunds: refundRecord,
        },
      }
    );

    // Update matching embedded booking, if it exists.
    await updateEmbeddedBooking({
      users: usersCollection,
      user,
      booking,
      refund,
      now,
    });
  }
}

// --------------------------------------------------
// SUCCESS RESPONSE
// --------------------------------------------------

function successResponse(bookingId, refund) {
  const hasRefund =
    refund.refundStatus !== "not-applicable";

  return NextResponse.json({
    success: true,

    message: hasRefund
      ? "Booking cancelled and refund initiated successfully."
      : "Booking cancelled successfully. No refund was applicable.",

    bookingId,
    status: "cancelled",
    cancelledAt: new Date(),

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
// DEDICATED BOOKINGS COLLECTION CANCELLATION
// --------------------------------------------------

async function cancelDedicatedBooking({
  db,
  bookings,
  booking,
  ownerClauses,
  user,
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

  if (!isWithinCancellationPeriod(createdAt, now)) {
    return NextResponse.json(
      {
        success: false,
        message:
          "The 2-hour cancellation period has expired. Cancellation and refund are no longer available.",
      },
      { status: 403 }
    );
  }

  const bookingId = String(
    booking._id ||
    booking.bookingId ||
    booking.bookingReference
  );

  // Atomically claim the booking.
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
    // Initiate refund through Razorpay.
    refund = await initiateRazorpayRefund(
      booking,
      now
    );

    // Save refund details in refunds, paymentRecord and users.
    await persistRefundRecords({
      db,
      booking,
      user,
      refund,
      now,
    });

    // Finalize original booking.
    const result = await bookings.updateOne(
      {
        _id: booking._id,
        status: "cancellation-processing",
      },
      {
        $set: {
          status: "cancelled",
          cancelledAt: now,
          updatedAt: now,
          cancellationReason: CANCELLATION_REASON,

          paymentStatus: refund.paymentStatus,

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

    return successResponse(bookingId, refund);
  } catch (error) {
    // If Razorpay has already returned a refund ID,
    // DO NOT restore the original status.
    // This prevents a second refund attempt.
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
// LEGACY USERS.BOOKINGS CANCELLATION
// --------------------------------------------------

async function cancelEmbeddedBooking({
  db,
  users,
  user,
  embeddedBooking,
  bookingId,
  now,
}) {
  const status = normalizeStatus(
    embeddedBooking.status
  );

  if (
    BLOCKED_STATUSES.includes(status) ||
    !isCancellable(status)
  ) {
    return jsonError(
      "This booking can no longer be cancelled.",
      409
    );
  }

  const createdAt = getCreatedAt(embeddedBooking);

  if (!createdAt) {
    return jsonError(
      "Booking creation time is missing or invalid.",
      409
    );
  }

  if (!isWithinCancellationPeriod(createdAt, now)) {
    return NextResponse.json(
      {
        success: false,
        message:
          "The 2-hour cancellation period has expired. Cancellation and refund are no longer available.",
      },
      { status: 403 }
    );
  }

  const identifierClauses =
    getIdentifierQuery(bookingId);

  const elementMatch = {
    $and: [
      { $or: identifierClauses },
      { status: embeddedBooking.status },
      { createdAt: embeddedBooking.createdAt },
    ],
  };

  // Claim the embedded booking.
  const claim = await users.updateOne(
    {
      _id: user._id,
      bookings: {
        $elemMatch: elementMatch,
      },
    },
    {
      $set: {
        "bookings.$.status":
          "cancellation-processing",

        "bookings.$.cancellationProcessingAt": now,
      },
    }
  );

  if (claim.modifiedCount !== 1) {
    return jsonError(
      "This booking is already being processed or has changed.",
      409
    );
  }

  let refund = null;

  try {
    refund = await initiateRazorpayRefund(
      embeddedBooking,
      now
    );

    // Save the refund in the other collections too.
    await persistRefundRecords({
      db,
      booking: embeddedBooking,
      user,
      refund,
      now,
    });

    // Finalize embedded booking.
    const result = await users.updateOne(
      {
        _id: user._id,
        bookings: {
          $elemMatch: {
            $and: [
              { $or: identifierClauses },
              { status: "cancellation-processing" },
            ],
          },
        },
      },
      {
        $set: {
          "bookings.$.status": "cancelled",
          "bookings.$.cancelledAt": now,
          "bookings.$.updatedAt": now,

          "bookings.$.cancellationReason":
            CANCELLATION_REASON,

          "bookings.$.paymentStatus":
            refund.paymentStatus,

          "bookings.$.refundStatus":
            refund.refundStatus,

          "bookings.$.refundId":
            refund.refundId,

          "bookings.$.refundAmount":
            refund.refundAmount,

          "bookings.$.refundInitiatedAt":
            refund.refundInitiatedAt || null,

          "bookings.$.refundExpectedDays":
            refund.refundExpectedDays || null,
        },
        $unset: {
          "bookings.$.cancellationProcessingAt": "",
        },
      }
    );

    if (result.modifiedCount !== 1) {
      console.error(
        "Embedded booking finalization failed:",
        bookingId,
        refund.refundId
      );

      return jsonError(
        "Refund was initiated, but booking status could not be updated. Please contact support.",
        500
      );
    }

    return successResponse(bookingId, refund);
  } catch (error) {
    if (!refund?.refundId) {
      await users.updateOne(
        {
          _id: user._id,
          bookings: {
            $elemMatch: {
              $and: [
                { $or: identifierClauses },
                { status: "cancellation-processing" },
              ],
            },
          },
        },
        {
          $set: {
            "bookings.$.status":
              embeddedBooking.status,
          },
          $unset: {
            "bookings.$.cancellationProcessingAt": "",
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

    const ownerClauses = buildUserQuery(token);

    const userDocumentClauses =
      buildUserDocumentQuery(token);

    if (
      !ownerClauses.length ||
      !userDocumentClauses.length
    ) {
      return jsonError(
        "Unable to identify your account.",
        400
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    const bookings = db.collection("bookings");
    const users = db.collection("users");

    const now = new Date();

    // Find the logged-in user's document.
    const user = await users.findOne({
      $or: userDocumentClauses,
    });

    // ------------------------------------------------
    // FIRST: CHECK DEDICATED BOOKINGS COLLECTION
    // ------------------------------------------------

    const booking = await bookings.findOne({
      $and: [
        { $or: ownerClauses },
        { $or: getIdentifierQuery(bookingId) },
      ],
    });

    if (booking) {
      return await cancelDedicatedBooking({
        db,
        bookings,
        booking,
        ownerClauses,
        user,
        now,
      });
    }

    // ------------------------------------------------
    // SECOND: CHECK USERS.BOOKINGS
    // ------------------------------------------------

    if (user && Array.isArray(user.bookings)) {
      const embeddedBooking = user.bookings.find(
        (item) => {
          if (
            !item ||
            typeof item !== "object" ||
            Array.isArray(item)
          ) {
            return false;
          }

          return getBookingIdentifiers(item).includes(
            bookingId
          );
        }
      );

      if (embeddedBooking) {
        return await cancelEmbeddedBooking({
          db,
          users,
          user,
          embeddedBooking,
          bookingId,
          now,
        });
      }
    }

    return jsonError(
      "Booking not found or you do not have permission to cancel it.",
      404
    );
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
