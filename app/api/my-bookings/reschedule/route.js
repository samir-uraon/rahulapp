
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";

import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const runtime = "nodejs";

const TIME_ZONE = "Asia/Kolkata";

const EXCLUDED_STATUSES = [
  "cancelled",
  "canceled",
  "failed",
  "refunded",
  "rejected",
  "skipped",
  "no-show",
  "noshow",
];

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function getIndiaToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type) =>
    parts.find((part) => part.type === type)?.value;

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function getWeekday(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);

  return new Date(year, month - 1, day).toLocaleDateString(
    "en-US",
    { weekday: "long" }
  );
}

function getSlotTime(slot) {
  return String(
    slot?.checkupStartTime ||
    slot?.open ||
    slot?.start ||
    ""
  ).trim();
}

function getSlotOpen(slot) {
  return String(slot?.open || slot?.start || "").trim();
}

function getSlotClose(slot) {
  return String(slot?.close || slot?.end || "").trim();
}

function isExcluded(booking) {
  return EXCLUDED_STATUSES.includes(normalize(booking.status));
}

function getBookingSlot(booking) {
  return booking.slot || {};
}

function isSameSlot(booking, slot) {
  const existing = getBookingSlot(booking);

  return (
    getSlotOpen(existing) === getSlotOpen(slot) &&
    getSlotClose(existing) === getSlotClose(slot)
  );
}

function getDoctorIds(id) {
  const ids = [String(id)];

  if (ObjectId.isValid(String(id))) {
    ids.push(new ObjectId(String(id)));
  }

  return ids;
}

function isHoliday(doctor, dateKey) {
  const holidays = [
    ...(Array.isArray(doctor.holidays) ? doctor.holidays : []),
    ...(Array.isArray(doctor.holidayDates)
      ? doctor.holidayDates
      : []),
  ];

  return holidays.some((item) => {
    const date =
      typeof item === "string"
        ? item
        : item?.date || item?.holidayDate;

    return String(date || "").slice(0, 10) === dateKey;
  });
}

function getScheduleSlot(doctor, weekday, requestedSlot) {
  const day = doctor.schedule?.[weekday];

  if (!day?.active || !Array.isArray(day.slots)) {
    return null;
  }

  return (
    day.slots.find((slot) => {
      if (slot.active === false) return false;

      return (
        getSlotOpen(slot) === getSlotOpen(requestedSlot) &&
        getSlotClose(slot) === getSlotClose(requestedSlot)
      );
    }) || null
  );
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return json(
        { success: false, message: "Authentication required." },
        401
      );
    }

    const userId = String(session.user.id || "");
    const userEmail = normalize(session.user.email);

    const body = await request.json().catch(() => ({}));

    const { bookingId, newDate, newSlot } = body;

    if (!bookingId || !newDate || !newSlot) {
      return json(
        {
          success: false,
          message: "bookingId, newDate and newSlot are required.",
        },
        400
      );
    }

    if (!ObjectId.isValid(String(bookingId))) {
      return json(
        { success: false, message: "Invalid booking ID." },
        400
      );
    }

    if (!isValidDate(newDate)) {
      return json(
        { success: false, message: "Invalid appointment date." },
        400
      );
    }

    if (newDate < getIndiaToday()) {
      return json(
        {
          success: false,
          message: "Cannot reschedule to a past date.",
        },
        400
      );
    }

    const open = getSlotOpen(newSlot);
    const close = getSlotClose(newSlot);
    const checkupStartTime = getSlotTime(newSlot);

    if (!open || !close || !checkupStartTime) {
      return json(
        { success: false, message: "Invalid slot information." },
        400
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB || "rahul");

    const bookings = db.collection("bookings");
    const team = db.collection("team");

    // Find the existing patient booking.
    const bookingQuery = {
      _id: new ObjectId(bookingId),
      $or: [
        { userId },
        ...(userEmail
          ? [{ userEmail: session.user.email }]
          : []),
      ],
    };

    const booking = await bookings.findOne(bookingQuery);

    if (!booking) {
      return json(
        {
          success: false,
          message: "Booking not found or access denied.",
        },
        404
      );
    }

    if (isExcluded(booking)) {
      return json(
        {
          success: false,
          message: "This booking cannot be rescheduled.",
        },
        400
      );
    }

    if (!["waiting", "confirmed", "pending"].includes(
      normalize(booking.status)
    )) {
      return json(
        {
          success: false,
          message: "This booking is not eligible for rescheduling.",
        },
        400
      );
    }

    const doctorId = String(booking.doctorId || "");

    if (!doctorId) {
      return json(
        { success: false, message: "Doctor information missing." },
        400
      );
    }

    // Get the same doctor.
    const doctor = await team.findOne({
      _id: { $in: getDoctorIds(doctorId) },
    });

    if (!doctor) {
      return json(
        { success: false, message: "Doctor not found." },
        404
      );
    }

    if (isHoliday(doctor, newDate)) {
      return json(
        {
          success: false,
          message: "Doctor is on holiday on this date.",
        },
        400
      );
    }

    // Validate selected slot against the doctor's weekly schedule.
    const weekday = getWeekday(newDate);

    const scheduleSlot = getScheduleSlot(
      doctor,
      weekday,
      newSlot
    );

    if (!scheduleSlot) {
      return json(
        {
          success: false,
          message: "Selected slot is not available in the doctor's schedule.",
        },
        400
      );
    }

    // Read the actual configured capacity.
    const capacity = Number(
      scheduleSlot.capacity ??
      newSlot.capacity ??
      doctor.capacity ??
      0
    );

    if (!Number.isFinite(capacity) || capacity <= 0) {
      return json(
        {
          success: false,
          message: "Invalid slot capacity.",
        },
        400
      );
    }

    // Count bookings belonging to the same doctor,
    // same date and same slot.
    const doctorIds = getDoctorIds(doctorId);

    const existingBookings = await bookings.find({
      _id: { $ne: booking._id },
      doctorId: { $in: doctorIds },
      date: newDate,
      status: { $nin: EXCLUDED_STATUSES },
    }).toArray();

    const bookedCount = existingBookings.filter((item) =>
      isSameSlot(item, scheduleSlot)
    ).length;

    if (bookedCount >= capacity) {
      return json(
        {
          success: false,
          message: "This slot is full. Please choose another slot.",
          capacity,
          booked: bookedCount,
          remaining: 0,
        },
        409
      );
    }

    // If the selected date and slot are already assigned,
    // do not unnecessarily modify the booking.
    if (
      booking.date === newDate &&
      isSameSlot(booking, scheduleSlot)
    ) {
      return json(
        {
          success: false,
          message: "You have already selected this appointment slot.",
        },
        400
      );
    }

    const now = new Date();

    const updatedSlot = {
      open,
      close,
      checkupStartTime,
    };

    // Update only the existing booking.
    // Payment, patient, clinic, and booking reference remain unchanged.
    const result = await bookings.updateOne(
      {
        _id: booking._id,
        userId: booking.userId,
        status: booking.status,
        date: booking.date,
        updatedAt: booking.updatedAt,
      },
      {
        $set: {
          date: newDate,
          time: checkupStartTime,
          slot: updatedSlot,
          status: "waiting",
          updatedAt: now,
          rescheduledAt: now,
        },
      }
    );

    if (result.modifiedCount !== 1) {
      return json(
        {
          success: false,
          message: "Booking was modified. Refresh and try again.",
        },
        409
      );
    }

    const updatedBooking = await bookings.findOne({
      _id: booking._id,
    });

    return json({
      success: true,
      message: "Appointment successfully rescheduled.",
      booking: updatedBooking,
      availability: {
        capacity,
        booked: bookedCount + 1,
        remaining: Math.max(0, capacity - bookedCount - 1),
      },
    });
  } catch (error) {
    console.error("Reschedule API error:", error);

    return json(
      {
        success: false,
        message: "Failed to reschedule appointment.",
      },
      500
    );
  }
}
