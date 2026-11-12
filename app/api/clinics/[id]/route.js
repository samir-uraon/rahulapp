
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

export const runtime = "nodejs";
export const revalidate = 0;

const TIME_ZONE = "Asia/Kolkata";

// ---------------------------------------------
// ID HELPERS
// ---------------------------------------------

function getDoctorId(value) {
  if (value == null) return "";

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return String(value);
  }

  // Handle MongoDB ObjectId directly.
  if (typeof value.toHexString === "function") {
    return value.toHexString();
  }

  if (typeof value === "object") {
    const id = value.id || value._id;

    if (id == null) return "";

    if (typeof id.toHexString === "function") {
      return id.toHexString();
    }

    return String(id);
  }

  return "";
}

function getBusinessId(clinic) {
  return getDoctorId(clinic.id || clinic._id);
}

function toObjectId(value) {
  const id = String(value || "");

  return /^[a-f\d]{24}$/i.test(id) && ObjectId.isValid(id)
    ? new ObjectId(id)
    : null;
}

// ---------------------------------------------
// DATE HELPERS
// ---------------------------------------------

function getIndiaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
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

function getActiveHolidayDates(
  holidayDates,
  today = getIndiaDateKey()
) {
  if (!Array.isArray(holidayDates)) return [];

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

function getBookingDate(booking) {
  if (typeof booking.date === "string") {
    return booking.date;
  }

  if (booking.date instanceof Date) {
    return getIndiaDateKey(booking.date);
  }

  return "";
}

function serializeDate(value) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString();
}

// ---------------------------------------------
// BOOKING HELPERS
// ---------------------------------------------

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

  return (
    ["waiting", "confirmed"].includes(status) &&
    priority === "emergency"
  );
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
    createdAt: serializeDate(booking.createdAt),
    patient: getPatient(booking),
    slot: getSlot(booking),
  };
}

// ---------------------------------------------
// SESSION HELPERS
// ---------------------------------------------

function getSessionSlotId(session) {
  if (session.sessionId) {
    return String(session.sessionId).trim();
  }

  const open = session.slotOpen || "";
  const close = session.slotClose || "";

  if (open && close) {
    return `${open}-${close}`;
  }

  return "";
}

function getSessionGroupKey(session) {
  const doctorId = getDoctorId(session.doctorId);
  const sessionId = getSessionSlotId(session);
  const date = session.date || "";

  if (!doctorId || !sessionId || !date) return "";

  return `${doctorId}::${sessionId}::${date}`;
}

function serializeSession(session) {
  return {
    ...session,
    _id: String(session._id),
    doctorId: getDoctorId(session.doctorId),
    sessionId: getSessionSlotId(session),
    sessionLabel:
      session.sessionLabel ||
      getSessionSlotId(session),
    date: session.date || "",
    slotOpen: session.slotOpen || "",
    slotClose: session.slotClose || "",
    status: session.status || "",
    cancel: session.cancel === true,
    startedAt: serializeDate(session.startedAt),
    expiresAt: serializeDate(session.expiresAt),
    closedAt: serializeDate(session.closedAt),
    updatedAt: serializeDate(session.updatedAt),
  };
}

function getSessionState(session) {
  if (!session) {
    return {
      isSessionActive: false,
      isSessionClosed: false,
      sessionState: "not-started",
    };
  }

  const status = String(session.status || "").toLowerCase();

  const closedStatuses = [
    "closed",
    "completed",
    "cancelled",
    "canceled",
    "expired",
    "rejected",
  ];

  if (
    session.cancel === true ||
    Boolean(session.closedAt) ||
    closedStatuses.includes(status)
  ) {
    return {
      isSessionActive: false,
      isSessionClosed: true,
      sessionState:
        status === "expired" ? "expired" : "closed",
    };
  }

  if (status === "active") {
    const expiresAt = session.expiresAt
      ? new Date(session.expiresAt).getTime()
      : null;

    if (
      expiresAt !== null &&
      Number.isFinite(expiresAt) &&
      expiresAt <= Date.now()
    ) {
      return {
        isSessionActive: false,
        isSessionClosed: true,
        sessionState: "expired",
      };
    }

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

function getSessionSortTime(session) {
  const updatedAt = session.updatedAt
    ? new Date(session.updatedAt).getTime()
    : 0;

  const startedAt = session.startedAt
    ? new Date(session.startedAt).getTime()
    : 0;

  return Math.max(
    Number.isFinite(updatedAt) ? updatedAt : 0,
    Number.isFinite(startedAt) ? startedAt : 0
  );
}

// ---------------------------------------------
// RESPONSE HELPER
// ---------------------------------------------

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

// ---------------------------------------------
// GET CLINIC DETAILS
// ---------------------------------------------

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
    const doctorQueryParam = searchParams.get("doctor")?.trim() || "";

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    const clinicsCollection = db.collection("clinics");
    const teamCollection = db.collection("team");
    const bookingsCollection = db.collection("bookings");
    const sessionsCollection = db.collection("teamSessions");

    // 1. Find clinic.
    const clinicQuery = [
      { id },
      { _id: id },
    ];

    const clinicObjectId = toObjectId(id);

    if (clinicObjectId) {
      clinicQuery.push({ _id: clinicObjectId });
    }

    const clinic = await clinicsCollection.findOne(
      {
        $or: clinicQuery,
      },
      {
        projection: {
          password: 0,
          ownerId: 0,
        },
      }
    );

    if (!clinic) {
      return json(
        {
          success: false,
          message: "Clinic not found",
        },
        404
      );
    }

    if (
      clinic.category &&
      String(clinic.category).toLowerCase() !== "clinic"
    ) {
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

    // 2. Extract doctor IDs from clinic.
    let doctorIds = [
      ...new Set(
        (Array.isArray(clinic.doctors) ? clinic.doctors : [])
          .map(getDoctorId)
          .filter((doctorId) => toObjectId(doctorId))
      ),
    ];

    // Optionally return one selected doctor.
    if (doctorQueryParam) {
      doctorIds = doctorIds.filter(
        (doctorId) => doctorId === doctorQueryParam
      );
    }

    const doctorObjectIds = doctorIds
      .map(toObjectId)
      .filter(Boolean);

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
        getDoctorId(doctor._id),
        doctor,
      ])
    );

    // 4. Fetch ALL sessions for today's date.
    // Do not filter by active/closed status.
    const sessions = doctorIds.length
      ? await sessionsCollection
          .find({
            doctorId: {
              $in: [
                ...doctorIds,
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

    // 5. Keep the latest session PER DOCTOR AND PER SLOT.
    // A doctor may have multiple sessions on the same day.
    const sessionsByDoctorAndSlot = new Map();

    for (const session of sessions) {
      const groupKey = getSessionGroupKey(session);

      if (!groupKey) continue;

      const existing = sessionsByDoctorAndSlot.get(groupKey);

      if (
        !existing ||
        getSessionSortTime(session) > getSessionSortTime(existing)
      ) {
        sessionsByDoctorAndSlot.set(groupKey, session);
      }
    }

    // Build session arrays for each doctor.
    const sessionsByDoctor = new Map();

    for (const session of sessionsByDoctorAndSlot.values()) {
      const doctorId = getDoctorId(session.doctorId);

      if (!sessionsByDoctor.has(doctorId)) {
        sessionsByDoctor.set(doctorId, []);
      }

      const serializedSession = serializeSession(session);

      sessionsByDoctor.get(doctorId).push({
        ...serializedSession,
        ...getSessionState(session),
      });
    }

    // Sort each doctor's sessions by slot opening time when possible.
    for (const doctorSessions of sessionsByDoctor.values()) {
      doctorSessions.sort((a, b) => {
        const aTime = a.slotOpen || "";
        const bTime = b.slotOpen || "";

        return aTime.localeCompare(bTime);
      });
    }

    // Latest session overall for compatibility with older frontend code.
    const latestSessionByDoctor = new Map();

    for (const doctorSessions of sessionsByDoctor.values()) {
      for (const session of doctorSessions) {
        const existing = latestSessionByDoctor.get(session.doctorId);

        if (
          !existing ||
          getSessionSortTime(session) > getSessionSortTime(existing)
        ) {
          latestSessionByDoctor.set(session.doctorId, session);
        }
      }
    }

    // 6. Fetch bookings for this clinic and selected doctors.
    const clinicObjectIdForBookings = toObjectId(clinicId);

    const bookingClinicIds = [
      clinicId,
      ...(clinicObjectIdForBookings
        ? [clinicObjectIdForBookings]
        : []),
    ];

    const bookingDoctorIds = [
      ...doctorIds,
      ...doctorObjectIds,
    ];

    const bookings = doctorIds.length
      ? await bookingsCollection
          .find({
            clinicId: { $in: bookingClinicIds },
            doctorId: { $in: bookingDoctorIds },
          })
          .sort({ createdAt: -1 })
          .toArray()
      : [];

    // 7. Group bookings by clinic and doctor.
    const bookingsByDoctor = new Map();

    for (const booking of bookings) {
      const bookingClinicId = getDoctorId(booking.clinicId);
      const bookingDoctorId = getDoctorId(booking.doctorId);

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

    // 8. Populate doctors with bookings, holidays and per-slot sessions.
    const doctorRefs = Array.isArray(clinic.doctors)
      ? clinic.doctors
      : [];

    const populatedDoctors = doctorRefs
      .map(getDoctorId)
      .filter(
        (doctorId) =>
          !doctorQueryParam ||
          doctorId === doctorQueryParam
      )
      .map((doctorId) => {
        const doctor = doctorsById.get(doctorId);

        if (!doctor) return null;

        const mongoDoctorId = getDoctorId(doctor._id);
        const key = `${clinicId}::${mongoDoctorId}`;

        const holidayDates = getActiveHolidayDates(
          doctor.holidayDates,
          today
        );

        const doctorSessions =
          sessionsByDoctor.get(mongoDoctorId) || [];

        const latestSession =
          latestSessionByDoctor.get(mongoDoctorId) || null;

        const activeSessions = doctorSessions.filter(
          (session) => session.isSessionActive
        );

        const closedSessions = doctorSessions.filter(
          (session) => session.isSessionClosed
        );

        const allSessionsClosed =
          doctorSessions.length > 0 &&
          closedSessions.length === doctorSessions.length;

const doctorBookings =
  bookingsByDoctor.get(key) || [];

const hasEmergencyBooking = doctorBookings.some(
  isWaitingEmergencyBooking
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

          // Holiday information.
          holidayDates,
          isOnHolidayToday: holidayDates.includes(today),

          // All today's sessions, one per slot.
          sessions: doctorSessions,

          // Compatibility fields for existing frontend code.
          activeSession: activeSessions[0] || null,
          latestSession,

          isSessionActive: activeSessions.length > 0,

          // True only when every recorded session/slot is closed.
          isSessionClosed: allSessionsClosed,

          hasClosedSession: closedSessions.length > 0,

          sessionState: allSessionsClosed
            ? "closed"
            : activeSessions.length > 0
              ? "active"
              : latestSession?.sessionState || "not-started",

          // Booking information.
          // Booking information.
bookings: doctorBookings,

// Emergency indicator.
isEmergency: hasEmergencyBooking,
        };
      })
      .filter(Boolean);

    // 9. Return clinic.
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
        ...(process.env.NODE_ENV === "development"
          ? { error: error.message }
          : {}),
      },
      500
    );
  }
}
