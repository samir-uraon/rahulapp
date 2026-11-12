
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

export const runtime = "nodejs";
export const revalidate = 0;

const TIME_ZONE = "Asia/Kolkata";

function getDoctorId(value) {
  if (value == null) return "";

  if (value instanceof ObjectId) {
    return value.toString();
  }

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return String(value);
  }

  if (typeof value === "object") {
    if (value._id instanceof ObjectId) {
      return value._id.toString();
    }

    return String(value.id || value._id || "");
  }

  return "";
}

function getBusinessId(clinic) {
  return getDoctorId(clinic._id || clinic.id);
}

function getIndiaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function safeISOString(value) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isFinite(date.getTime())
    ? date.toISOString()
    : null;
}

function getBookingDate(booking) {
  if (typeof booking.date === "string") {
    return booking.date;
  }

  if (booking.date instanceof Date) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(booking.date);
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

function isWaitingEmergencyBooking(booking) {
  const status = String(booking.status || "")
    .trim()
    .toLowerCase();

  const priority = String(
    booking.priority ||
    booking.patient?.type ||
    ""
  )
    .trim()
    .toLowerCase();

  const isWaiting = [
    "waiting",
    "confirmed",
  ].includes(status);

  return isWaiting && priority === "emergency";
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
    doctorId: getDoctorId(booking.doctorId),
    clinicId: getDoctorId(booking.clinicId),
    bookingReference: booking.bookingReference || "",
    token: booking.token || "",
    sequence: booking.sequence ?? null,
    date: getBookingDate(booking),
    status: booking.status || "waiting",
    priority: booking.priority || "normal",
    createdAt: safeISOString(booking.createdAt),
    patient: getPatient(booking),
    slot: getSlot(booking),
  };
}

function serializeSession(session) {
  return {
    ...session,
    _id: String(session._id),
    doctorId: getDoctorId(session.doctorId),
    sessionId: session.sessionId || "",
    sessionLabel: session.sessionLabel || "",
    date: session.date || "",
    slotOpen: session.slotOpen || "",
    slotClose: session.slotClose || "",
    status: session.status || "",
    cancel: session.cancel === true,
    startedAt: safeISOString(session.startedAt),
    expiresAt: safeISOString(session.expiresAt),
    closedAt: safeISOString(session.closedAt),
    updatedAt: safeISOString(session.updatedAt),
  };
}

// Determine the actual state of an individual session slot.
function getSessionState(session) {
  if (!session) {
    return {
      isSessionActive: false,
      isSessionClosed: false,
      sessionState: "not-started",
    };
  }

  const status = String(
    session.status || ""
  ).toLowerCase();

  const closedStatuses = [
    "closed",
    "completed",
    "cancelled",
    "canceled",
    "rejected",
  ];

  if (
    session.cancel === true ||
    session.closedAt ||
    closedStatuses.includes(status)
  ) {
    return {
      isSessionActive: false,
      isSessionClosed: true,
      sessionState: "closed",
    };
  }

  if (
    status === "expired" ||
    status === "active" &&
      session.expiresAt &&
      new Date(session.expiresAt).getTime() <= Date.now()
  ) {
    return {
      isSessionActive: false,
      isSessionClosed: true,
      sessionState: "expired",
    };
  }

  if (status === "active") {
    return {
      isSessionActive: true,
      isSessionClosed: false,
      sessionState: "active",
    };
  }

  return {
    isSessionActive: false,
    isSessionClosed: false,
    sessionState: status || "not-started",
  };
}

function getSessionKey(doctorId, sessionId) {
  return `${doctorId}::${sessionId}`;
}

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    if (!process.env.MONGODB) {
      throw new Error("MONGODB environment variable is missing");
    }

    const clinicsCollection = db.collection("clinics");
    const teamCollection = db.collection("team");
    const bookingsCollection = db.collection("bookings");
    const sessionsCollection = db.collection("teamSessions");

    const today = getIndiaDate();

    // 1. Fetch clinics.
    const clinics = await clinicsCollection
      .find(
        {},
        {
          projection: {
            password: 0,
            ownerId: 0,
          },
        }
      )
      .toArray();

    // 2. Collect doctor IDs from clinic references.
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

    const validDoctorIds = doctorIds.filter(
      (id) => /^[a-f\d]{24}$/i.test(id)
    );

    const doctorObjectIds = validDoctorIds.map(
      (id) => new ObjectId(id)
    );

    // 3. Fetch doctor profiles.
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

    // 4. Fetch ALL today's sessions.
    // Do not filter by active status because closed sessions
    // must also be available to the frontend.
    const sessions = validDoctorIds.length
      ? await sessionsCollection
          .find({
            doctorId: {
              $in: [
                ...validDoctorIds,
                ...doctorObjectIds,
              ],
            },
            date: today,
          })
          .sort({
            updatedAt: -1,
            startedAt: -1,
            _id: -1,
          })
          .toArray()
      : [];

    // 5. Keep the latest document for each doctor + slot.
    const sessionsByDoctorAndSlot = new Map();

    for (const session of sessions) {
      const doctorId = getDoctorId(session.doctorId);
      const sessionId = String(session.sessionId || "");

      if (!doctorId || !sessionId) continue;

      const key = getSessionKey(doctorId, sessionId);

      // Because the documents are sorted newest first,
      // the first document for each slot is the latest.
      if (!sessionsByDoctorAndSlot.has(key)) {
        sessionsByDoctorAndSlot.set(key, {
          ...serializeSession(session),
          ...getSessionState(session),
        });
      }
    }

    // 6. Fetch bookings.
    const bookings = await bookingsCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    const bookingsByDoctor = new Map();

    for (const booking of bookings) {
      const clinicId = getDoctorId(booking.clinicId);
      const doctorId = getDoctorId(booking.doctorId);

      if (!clinicId || !doctorId) continue;

      const key = `${clinicId}::${doctorId}`;

      if (!bookingsByDoctor.has(key)) {
        bookingsByDoctor.set(key, []);
      }

      bookingsByDoctor.get(key).push(
        serializeBooking(booking)
      );
    }

    // 7. Populate clinics with doctors, bookings and sessions.
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
            const bookingKey =
              `${clinicId}::${mongoDoctorId}`;

            // Get all today's sessions for this doctor.
            const doctorSessions = Array.from(
              sessionsByDoctorAndSlot.values()
            ).filter(
              (session) =>
                session.doctorId === mongoDoctorId
            );

            const hasActiveSession = doctorSessions.some(
              (session) => session.isSessionActive
            );

            const hasClosedSession = doctorSessions.some(
              (session) => session.isSessionClosed
            );

            const allSessionsClosed =
              doctorSessions.length > 0 &&
              doctorSessions.every(
                (session) => session.isSessionClosed
              );

            // Most recently updated slot.
            const latestSession = [...doctorSessions].sort(
              (a, b) =>
                new Date(b.updatedAt || b.startedAt || 0) -
                new Date(a.updatedAt || a.startedAt || 0)
            )[0] || null;

          const doctorBookings =
  bookingsByDoctor.get(bookingKey) || [];

const hasEmergencyBooking = doctorBookings.some(
  isWaitingEmergencyBooking
);

return {
  ...doctor,

  _id: mongoDoctorId,
  id: mongoDoctorId,

  name:
    doctor.fullName ||
    doctor.name ||
    "",

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

  bookings: doctorBookings,

  // Emergency queue indicator.
  isEmergency: hasEmergencyBooking,

  // All slots and their individual states.
  sessions: doctorSessions,

  activeSession:
    doctorSessions.find(
      (session) => session.isSessionActive
    ) || null,

  latestSession,

  isSessionActive: hasActiveSession,

  isSessionClosed: allSessionsClosed,

  hasClosedSession,

  sessionState: hasActiveSession
    ? "active"
    : allSessionsClosed
      ? "closed"
      : latestSession?.sessionState ||
        "not-started",
};
          })
          .filter(Boolean);

        return {
          ...clinic,
          _id: clinicId,
          doctors: populatedDoctors,
        };
      });

    console.log(updatedClinics[1].doctors);
      

    return NextResponse.json(
      {
        success: true,
        date: today,
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
    console.error("GET /api/clinics error:", {
      message: error?.message,
      stack: error?.stack,
    });

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch clinics",
        error:
          process.env.NODE_ENV === "development"
            ? error?.message || "Unknown server error"
            : undefined,
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
