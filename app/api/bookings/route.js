import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";

import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const runtime = "nodejs";

const VALID_CATEGORIES = new Set([
  "clinic",
  "saloon",
  "beauty-parlour",
  "diagnostic-centre",
]);

const EXCLUDED_STATUSES = new Set([
  "cancelled",
  "canceled",
  "no-show",
  "noshow",
  "rejected",
]);

const EXCLUDED_PAYMENTS = new Set([
  "failed",
  "unpaid",
  "refunded",
  "pending",
  "created",
  "processing",
]);

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

function normalizeId(value) {
  if (value === undefined || value === null) return "";

  if (typeof value === "object") {
    value = value._id ?? value.id ?? "";
  }

  return String(value).trim();
}

function normalizeDate(value) {
  if (!value) return "";

  // Date-only strings must not be shifted by timezone conversion.
  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return value;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const part = (name) =>
    parts.find((item) => item.type === name)?.value;

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function getBookingDate(booking) {
  return normalizeDate(
    booking.date ??
      booking.appointmentDate ??
      booking.bookingDate
  );
}

function getBookingSlot(booking) {
  const slot = booking.slot || {};

  return {
    open:
      slot.open ??
      booking.slotOpen ??
      booking.time ??
      booking.appointmentTime ??
      "",
    close: slot.close ?? booking.slotClose ?? "",
  };
}

function isCountable(booking) {
  const status = String(booking.status || "").toLowerCase();
  const paymentStatus = String(
    booking.paymentStatus || ""
  ).toLowerCase();

  if (EXCLUDED_STATUSES.has(status)) return false;

  if (EXCLUDED_PAYMENTS.has(paymentStatus)) return false;

  return true;
}

function matchesId(value, expected) {
  const actualId = normalizeId(value);

  return actualId !== "" && actualId === String(expected);
}

function matchesClinic(booking, clinicId) {
  return [
    booking.clinicId,
    booking.businessId,
    booking.clinic?.id,
    booking.clinic?._id,
  ].some((value) => matchesId(value, clinicId));
}

function matchesDoctor(booking, doctorId) {
  return [
    booking.doctorId,
    booking.doctor?.id,
    booking.doctor?._id,
  ].some((value) => matchesId(value, doctorId));
}

function idQuery(keys, value) {
  const alternatives = [];

  for (const key of keys) {
    alternatives.push({ [key]: String(value) });

    // Support actual ObjectId fields when the supplied ID is one.
    if (ObjectId.isValid(String(value))) {
      alternatives.push({
        [key]: new ObjectId(String(value)),
      });
    }
  }

  return alternatives;
}

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return json(
        {
          success: false,
          message: "Please log in to check appointment availability.",
        },
        401
      );
    }

    const { searchParams } = new URL(request.url);

    const clinicId = searchParams.get("clinicId")?.trim();
    const doctorId = searchParams.get("doctorId")?.trim();
    const date = searchParams.get("date")?.trim();
    const category = (
      searchParams.get("category") || "clinic"
    )
      .trim()
      .toLowerCase();

    if (!clinicId || !doctorId || !date) {
      return json(
        {
          success: false,
          message:
            "clinicId, doctorId, and date are required.",
        },
        400
      );
    }

    if (!VALID_CATEGORIES.has(category)) {
      return json(
        {
          success: false,
          message: "Invalid business category.",
        },
        400
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json(
        {
          success: false,
          message: "Date must use YYYY-MM-DD format.",
        },
        400
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    // 1. Check doctor's holiday status before looking up bookings
    const teamCollection = db.collection("team");
    const doctorFilter = [];

    if (ObjectId.isValid(doctorId)) {
      doctorFilter.push({ _id: new ObjectId(doctorId) });
    }
    doctorFilter.push({ _id: doctorId }, { id: doctorId });

    const doctor = await teamCollection.findOne({
      $or: doctorFilter,
    });

    const isHoliday =
      Array.isArray(doctor?.holidayDates) &&
      doctor.holidayDates.includes(date);

    if (isHoliday) {
      return json({
        success: true,
        date,
        clinicId,
        doctorId,
        category,
        isHoliday: true,
        isAvailable: false,
        bookings: [],
        count: 0,
        message: "The doctor is on holiday on the selected date.",
      });
    }

    // 2. Query bookings collection
    const bookingsCollection = db.collection("bookings");

    const clinicKeys = [
      "clinicId",
      "businessId",
      "clinic.id",
      "clinic._id",
    ];

    const doctorKeys = [
      "doctorId",
      "doctor.id",
      "doctor._id",
    ];

    const query = {
      $and: [
        { $or: idQuery(clinicKeys, clinicId) },
        { $or: idQuery(doctorKeys, doctorId) },
      ],
    };

    // Category is optional in legacy booking records. When present,
    // it must match the requested category.
    query.$and.push({
      $or: [
        { category },
        { category: { $exists: false } },
        { category: null },
      ],
    });

    const records = await bookingsCollection
      .find(query, {
        projection: {
          _id: 1,
          clinicId: 1,
          businessId: 1,
          "clinic.id": 1,
          "clinic._id": 1,
          doctorId: 1,
          "doctor.id": 1,
          "doctor._id": 1,
          date: 1,
          appointmentDate: 1,
          bookingDate: 1,
          time: 1,
          appointmentTime: 1,
          slot: 1,
          slotOpen: 1,
          slotClose: 1,
          status: 1,
          paymentStatus: 1,
          category: 1,
        },
      })
      .toArray();

    const matchingBookings = records
      .filter((booking) => {
        return (
          matchesClinic(booking, clinicId) &&
          matchesDoctor(booking, doctorId) &&
          getBookingDate(booking) === date &&
          isCountable(booking)
        );
      })
      .map((booking) => {
        const slot = getBookingSlot(booking);

        // Return only availability-related fields. Never expose
        // patient names, email addresses, or phone numbers.
        return {
          id: String(booking._id),
          clinicId,
          doctorId,
          date,
          slot: {
            open: slot.open,
            close: slot.close,
          },
          status: booking.status || "",
          paymentStatus: booking.paymentStatus || "",
        };
      });

    return json({
      success: true,
      date,
      clinicId,
      doctorId,
      category,
      isHoliday: false,
      isAvailable: true,
      bookings: matchingBookings,
      count: matchingBookings.length,
    });
  } catch (error) {
    console.error("GET /api/bookings error:", error);

    return json(
      {
        success: false,
        message: "Unable to retrieve appointment bookings.",
      },
      500
    );
  }
}