import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

export const runtime = "nodejs";
export const revalidate = 0;

function getDoctorId(value) {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (value && typeof value === "object") {
    return String(value.id || value._id || "");
  }

  return "";
}

function getBusinessId(clinic) {
  return String(clinic.id || clinic._id || "");
}

// Always calculate the date in India Standard Time.
function getIndiaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

// Normalize stored holiday dates and automatically expire past dates.
function getActiveHolidayDates(holidayDates, today = getIndiaDateKey()) {
  if (!Array.isArray(holidayDates)) {
    return [];
  }

  return [
    ...new Set(
      holidayDates.filter(
        (date) =>
          typeof date === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(date) &&
          date >= today &&
          isValidCalendarDate(date)
      )
    ),
  ].sort();
}

function isValidCalendarDate(date) {
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function getBookingDate(booking) {
  if (typeof booking.date === "string") {
    return booking.date;
  }

  if (booking.date instanceof Date) {
    return booking.date.toISOString().slice(0, 10);
  }

  return "";
}

function getPatient(booking) {
  return {
    name:
      booking.patient?.name ||
      booking.patientName ||
      booking.name ||
      "",
    type:
      booking.patient?.type ||
      booking.priority ||
      "normal",
  };
}

function getSlot(booking) {
  const slot = booking.slot || {};

  return {
    ...slot,
    open: slot.open || booking.slotOpen || "",
    close: slot.close || booking.slotClose || "",
  };
}

function serializeBooking(booking) {
  return {
    ...booking,
    _id: String(booking._id),
    doctorId:
      booking.doctorId != null
        ? String(booking.doctorId)
        : "",
    clinicId:
      booking.clinicId != null
        ? String(booking.clinicId)
        : "",
    bookingReference: booking.bookingReference || "",
    token: booking.token || "",
    sequence: booking.sequence ?? null,
    date: getBookingDate(booking),
    status: booking.status || "waiting",
    priority: booking.priority || "normal",
    createdAt: booking.createdAt
      ? new Date(booking.createdAt).toISOString()
      : null,
    patient: getPatient(booking),
    slot: getSlot(booking),
  };
}

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

export async function GET(request, { params }) {
  try {
    const { id } = await params;

    if (!id || typeof id !== "string") {
      return json(
        {
          success: false,
          message: "Clinic ID is required",
        },
        400
      );
    }

    const { searchParams } = new URL(request.url);
    const doctorQueryParam = searchParams.get("doctor");

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    const clinicsCollection = db.collection("clinics");
    const teamCollection = db.collection("team");
    const bookingsCollection = db.collection("bookings");

    // 1. Find the clinic.
    const clinicQuery = [{ id }, { _id: id }];

    if (ObjectId.isValid(id) && /^[a-f\d]{24}$/i.test(id)) {
      clinicQuery.push({ _id: new ObjectId(id) });
    }

    const clinic = await clinicsCollection.findOne({
      $or: clinicQuery,
    },
   {
    projection: {
      password: 0,
      ownerId: 0,
    }
  });

    if (!clinic) {
      return json(
        {
          success: false,
          message: "Clinic not found",
        },
        404
      );
    }

    if (clinic.category && clinic.category !== "clinic") {
      return json(
        {
          success: false,
          message: "This business is not a clinic",
        },
        404
      );
    }

    const clinicId = getBusinessId(clinic);
    const today = getIndiaDateKey();

    // 2. Extract doctor MongoDB IDs from clinic.doctors.
    let doctorIds = [
      ...new Set(
        (Array.isArray(clinic.doctors) ? clinic.doctors : [])
          .map(getDoctorId)
          .filter(
            (doctorId) =>
              /^[a-f\d]{24}$/i.test(doctorId) &&
              ObjectId.isValid(doctorId)
          )
      ),
    ];

    // Optionally return one selected doctor.
    if (doctorQueryParam) {
      const targetDoctorId = doctorQueryParam.trim();

      doctorIds = doctorIds.filter(
        (doctorId) => doctorId === targetDoctorId
      );
    }

    const doctorObjectIds = doctorIds.map(
      (doctorId) => new ObjectId(doctorId)
    );

    // 3. Fetch doctor profiles, including holidayDates.
    const doctors = doctorObjectIds.length
      ? await teamCollection
          .find({
            _id: { $in: doctorObjectIds },
            role: {
              $in: ["doctor", "Doctor", "DOCTOR"],
            },
            category: "clinic",
            isActive: { $ne: false },
          })
          .toArray()
      : [];

    const doctorsById = new Map(
      doctors.map((doctor) => [
        String(doctor._id),
        doctor,
      ])
    );

    // 4. Fetch bookings for this clinic and these doctors.
    const bookingQuery = {
      clinicId,
      doctorId: { $in: doctorIds },
    };

    const bookings = doctorIds.length
      ? await bookingsCollection
          .find(bookingQuery)
          .sort({ createdAt: -1 })
          .toArray()
      : [];

    // 5. Group bookings by clinic and doctor.
    const bookingsByDoctor = new Map();

    for (const booking of bookings) {
      const bookingClinicId = String(booking.clinicId ?? "");
      const bookingDoctorId = String(booking.doctorId ?? "");

      if (
        bookingClinicId !== clinicId ||
        !bookingDoctorId
      ) {
        continue;
      }

      const key = `${bookingClinicId}::${bookingDoctorId}`;

      if (!bookingsByDoctor.has(key)) {
        bookingsByDoctor.set(key, []);
      }

      bookingsByDoctor.get(key).push(
        serializeBooking(booking)
      );
    }

    // 6. Populate doctor references and expose active holiday dates.
    const doctorRefs = Array.isArray(clinic.doctors)
      ? clinic.doctors
      : [];

    const populatedDoctors = doctorRefs
      .map(getDoctorId)
      .filter(
        (doctorId) =>
          !doctorQueryParam ||
          doctorId === doctorQueryParam.trim()
      )
      .map((doctorId) => {
        const doctor = doctorsById.get(doctorId);

        if (!doctor) {
          return null;
        }

        const mongoDoctorId = String(doctor._id);
        const key = `${clinicId}::${mongoDoctorId}`;

        const holidayDates = getActiveHolidayDates(
          doctor.holidayDates,
          today
        );

        return {
          ...doctor,
          _id: mongoDoctorId,
          id: mongoDoctorId,
          name: doctor.fullName || doctor.name || "",
          specialization:
            doctor.specialization ||
            doctor.speciality ||
            "",
          duration:
            doctor.duration ??
            doctor.checkupDuration ??
            20,
          capacity: doctor.capacity ?? 12,
          schedule: doctor.schedule || {},

          // Only today and future holiday dates are returned.
          holidayDates,

          // Convenient flag for today's clinic/doctor status UI.
          isOnHolidayToday: holidayDates.includes(today),

          bookings: bookingsByDoctor.get(key) || [],
        };
      })
      .filter(Boolean);

    // 7. Return the clinic.
    const updatedClinic = {
      ...clinic,
      _id: clinicId,
      doctors: populatedDoctors,
    };

    return json({
      success: true,
      clinic: updatedClinic,
      today,
    });
  } catch (error) {
    console.error("GET /api/clinics/[id] error:", error);

    return json(
      {
        success: false,
        message: "Failed to fetch clinic",
      },
      500
    );
  }
}