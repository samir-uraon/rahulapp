
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

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    const clinicsCollection = db.collection("clinics");
    const teamCollection = db.collection("team");
    const bookingsCollection = db.collection("bookings");

    // 1. Fetch clinics.
    const clinics = await clinicsCollection
      .find({},{ 
    projection: {
      password: 0,
      ownerId: 0,
    }})
      .toArray();

    // 2. Collect MongoDB doctor IDs from clinics.doctors.
    const doctorIds = [
      ...new Set(
        clinics
          .filter(
            (clinic) =>
              !clinic.category ||
              clinic.category === "clinic"
          )
          .flatMap((clinic) =>
            Array.isArray(clinic.doctors)
              ? clinic.doctors.map(getDoctorId)
              : []
          )
          .filter(Boolean)
      ),
    ];

    // Only MongoDB ObjectId values are accepted as doctor IDs.
    const validDoctorIds = doctorIds.filter(
      (id) =>
        /^[a-f\d]{24}$/i.test(id) &&
        ObjectId.isValid(id)
    );

    const doctorObjectIds = validDoctorIds.map(
      (id) => new ObjectId(id)
    );

    // 3. Fetch doctor profiles from team using team._id.
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

    // Index doctors by their MongoDB _id.
    const doctorsById = new Map(
      doctors.map((doctor) => [
        String(doctor._id),
        doctor,
      ])
    );

    // 4. Fetch bookings from the separate bookings collection.
    const bookings = await bookingsCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    // Normalize the booking clinic ID and doctor MongoDB ID.
    const bookingsByDoctor = new Map();

    for (const booking of bookings) {
      const clinicId = String(booking.clinicId ?? "");
      const doctorId = String(booking.doctorId ?? "");

      if (!clinicId || !doctorId) continue;

      const key = `${clinicId}::${doctorId}`;

      if (!bookingsByDoctor.has(key)) {
        bookingsByDoctor.set(key, []);
      }

      bookingsByDoctor.get(key).push(
        serializeBooking(booking)
      );
    }

    // 5. Populate each clinic with its doctor profiles and bookings.
    const updatedClinics = clinics
      .filter(
        (clinic) =>
          !clinic.category ||
          clinic.category === "clinic"
      )
      .map((clinic) => {
        const clinicId = getBusinessId(clinic);

        const doctorRefs = Array.isArray(clinic.doctors)
          ? clinic.doctors
          : [];

        const populatedDoctors = doctorRefs
          .map(getDoctorId)
          .map((doctorId) => {
            const doctor = doctorsById.get(doctorId);

            if (!doctor) return null;

            const mongoDoctorId = String(doctor._id);
            const key = `${clinicId}::${mongoDoctorId}`;

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
              bookings: bookingsByDoctor.get(key) || [],
          
            };
          })
          .filter(Boolean);

        return {
          ...clinic,
          _id: clinicId,
          doctors: populatedDoctors,
        };
      });



      
    return NextResponse.json(
      {
        success: true,
        clinics: updatedClinics,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("GET /api/clinics error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch clinics",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
