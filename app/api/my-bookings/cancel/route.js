
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CANCELLATION_DELAY_MS = 2 * 60 * 60 * 1000;

const CANCELLABLE_STATUSES = [
  "waiting",
  "confirmed",
  "booked",
  "pending",
];

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildUserQuery(token) {
  const clauses = [];

  const tokenId = String(token.id || token.sub || "").trim();
  const subject = String(token.sub || "").trim();
  const email = String(token.email || "").trim().toLowerCase();

  for (const id of new Set([tokenId, subject].filter(Boolean))) {
    clauses.push({ userId: id }, { user: id });

    if (ObjectId.isValid(id) && id.length === 24) {
      const objectId = new ObjectId(id);

      clauses.push(
        { userId: objectId },
        { user: objectId }
      );
    }
  }

  if (email) {
    const emailRegex = {
      $regex: `^${escapeRegex(email)}$`,
      $options: "i",
    };

    clauses.push(
      { email: emailRegex },
      { userEmail: emailRegex },
      { userId: email },
      { user: email }
    );
  }

  return clauses;
}

function getIdentifierQuery(identifier) {
  const values = [identifier];

  if (ObjectId.isValid(identifier) && identifier.length === 24) {
    values.push(new ObjectId(identifier));
  }

  return [
    { _id: { $in: values } },
    { bookingId: { $in: values } },
    { bookingReference: { $in: values } },
  ];
}

function normalizeStatus(status) {
  return String(status || "waiting")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-")
    .replaceAll(" ", "-");
}

function getCreatedAt(booking) {
  const value = booking?.createdAt;

  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function jsonError(message, status) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    { status }
  );
}

function getCancellationTime(createdAt) {
  return new Date(createdAt.getTime() + CANCELLATION_DELAY_MS);
}

function getRemainingMinutes(createdAt, now) {
  const remainingMs =
    CANCELLATION_DELAY_MS - (now.getTime() - createdAt.getTime());

  return Math.max(0, Math.ceil(remainingMs / 60000));
}

function cancellationNotAvailableResponse(createdAt, now) {
  const remainingMinutes = getRemainingMinutes(createdAt, now);

  return NextResponse.json(
    {
      success: false,
      message: `Cancellation will be available after 2 hours from booking creation. Please try again in about ${remainingMinutes} minute(s).`,
      availableAt: getCancellationTime(createdAt),
    },
    { status: 403 }
  );
}

function isCancellable(status) {
  return CANCELLABLE_STATUSES.includes(normalizeStatus(status));
}

function isCancellationPeriodOver(createdAt, now) {
  return now.getTime() - createdAt.getTime() >= CANCELLATION_DELAY_MS;
}

function getEmbeddedBookingIdentifier(booking) {
  return (
    booking?._id ??
    booking?.id ??
    booking?.bookingId ??
    booking?.bookingReference
  );
}

function getEmbeddedIdentifierValues(identifier) {
  const stringId = String(identifier);
  const values = [stringId];

  if (ObjectId.isValid(stringId) && stringId.length === 24) {
    values.push(new ObjectId(stringId));
  }

  return values;
}

function successResponse(bookingId) {
  return NextResponse.json({
    success: true,
    message: "Booking cancelled successfully.",
    bookingId,
    status: "cancelled",
  });
}

export async function POST(request) {
  try {
    // Authentication configuration
    const secret =
      process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

    if (!secret) {
      return jsonError(
        "Authentication configuration is missing.",
        500
      );
    }

    // Verify login
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

    // Database configuration
    if (!process.env.MONGODB) {
      return jsonError(
        "Database configuration is missing.",
        500
      );
    }

    // Validate request
    const body = await request.json().catch(() => ({}));

    const bookingId = String(
      body.bookingId || body.id || ""
    ).trim();

    if (!bookingId || bookingId.length > 200) {
      return jsonError(
        "A valid booking ID is required.",
        400
      );
    }

    // Identify the authenticated user
    const ownerClauses = buildUserQuery(token);

    if (!ownerClauses.length) {
      return jsonError(
        "Unable to identify your account.",
        400
      );
    }

    const now = new Date();

    const cancellationCutoff = new Date(
      now.getTime() - CANCELLATION_DELAY_MS
    );

    const identifierClauses = getIdentifierQuery(bookingId);

    // Connect database
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    const bookings = db.collection("bookings");
    const users = db.collection("users");

    // --------------------------------------------------
    // 1. Check dedicated bookings collection
    // --------------------------------------------------

    const bookingQuery = {
      $and: [
        { $or: ownerClauses },
        { $or: identifierClauses },
      ],
    };

    const booking = await bookings.findOne(bookingQuery);

    if (booking) {
      const status = normalizeStatus(booking.status);

      if (!isCancellable(status)) {
        return jsonError(
          "This booking can no longer be cancelled because its status has changed.",
          409
        );
      }

      const createdAt = getCreatedAt(booking);

      if (!createdAt) {
        return jsonError(
          "This booking does not have a valid creation time, so it cannot be cancelled online.",
          409
        );
      }

      // Enforce the 2-hour cancellation restriction
      if (!isCancellationPeriodOver(createdAt, now)) {
        return cancellationNotAvailableResponse(
          createdAt,
          now
        );
      }

      // Atomic update:
      // Ensure the booking still belongs to the user,
      // still has its original status, and is old enough.
      const updateResult = await bookings.updateOne(
        {
          _id: booking._id,

          $and: [
            { $or: ownerClauses },

            // Match the exact original status to prevent
            // overwriting a concurrent status change.
            { status: booking.status },

            { createdAt: { $lte: cancellationCutoff } },
          ],
        },
        {
          $set: {
            status: "cancelled",
            cancelledAt: now,
            updatedAt: now,
            cancellationReason: "Cancelled by patient",
          },
        }
      );

      if (updateResult.modifiedCount !== 1) {
        return jsonError(
          "The booking could not be cancelled. It may have changed; please refresh and try again.",
          409
        );
      }

      return successResponse(bookingId);
    }

    // --------------------------------------------------
    // 2. Fallback for legacy users.bookings records
    // --------------------------------------------------

    const user = await users.findOne({
      $or: ownerClauses,
    });

    if (user && Array.isArray(user.bookings)) {
      const matchesIdentifier = (item) => {
        const ids = [
          item?._id,
          item?.id,
          item?.bookingId,
          item?.bookingReference,
        ]
          .filter(
            (value) =>
              value !== null && value !== undefined
          )
          .map(String);

        return ids.includes(bookingId);
      };

      const embeddedBooking = user.bookings.find(
        matchesIdentifier
      );

      if (embeddedBooking) {
        const status = normalizeStatus(
          embeddedBooking.status
        );

        if (!isCancellable(status)) {
          return jsonError(
            "This booking can no longer be cancelled because its status has changed.",
            409
          );
        }

        const createdAt = getCreatedAt(embeddedBooking);

        if (!createdAt) {
          return jsonError(
            "This booking does not have a valid creation time, so it cannot be cancelled online.",
            409
          );
        }

        // Enforce the same 2-hour restriction
        if (!isCancellationPeriodOver(createdAt, now)) {
          return cancellationNotAvailableResponse(
            createdAt,
            now
          );
        }

        const embeddedId =
          getEmbeddedBookingIdentifier(embeddedBooking);

        if (
          embeddedId === null ||
          embeddedId === undefined
        ) {
          return jsonError(
            "The booking does not have a valid identifier.",
            409
          );
        }

        const embeddedValues =
          getEmbeddedIdentifierValues(embeddedId);

        // Atomic embedded booking update
        const updateResult = await users.updateOne(
          {
            _id: user._id,

            bookings: {
              $elemMatch: {
                $and: [
                  {
                    $or: [
                      { _id: { $in: embeddedValues } },
                      { id: { $in: embeddedValues } },
                      { bookingId: { $in: embeddedValues } },
                      {
                        bookingReference: {
                          $in: embeddedValues,
                        },
                      },
                    ],
                  },

                  // Match the original status
                  { status: embeddedBooking.status },

                  { createdAt: { $lte: cancellationCutoff } },
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
                "Cancelled by patient",
            },
          }
        );

        if (updateResult.modifiedCount !== 1) {
          return jsonError(
            "The booking could not be cancelled. It may have changed; please refresh and try again.",
            409
          );
        }

        return successResponse(bookingId);
      }
    }

    // --------------------------------------------------
    // 3. Booking not found
    // --------------------------------------------------

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
        message: "Failed to cancel booking.",

        error:
          process.env.NODE_ENV === "development"
            ? error?.message || String(error)
            : undefined,
      },
      { status: 500 }
    );
  }
}
