
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const INDIA_TIME_ZONE = "Asia/Kolkata";

const ACTIVE_STATUSES = [
  "waiting",
  "serving",
  "in-progress",
  "in_progress",
  "in progress",
];

const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function normalizeStatus(status) {
  return String(status || "waiting")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "-");
}

function isServing(status) {
  return ["serving", "in-progress", "in_progress"].includes(
    normalizeStatus(status)
  );
}

function isActive(status) {
  return ACTIVE_STATUSES.map(normalizeStatus).includes(
    normalizeStatus(status)
  );
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "object") {
    if (value.$date) return toDate(value.$date);

    if (typeof value.toDate === "function") {
      return toDate(value.toDate());
    }
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function parseTime(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value >= 0 && value < 1440 ? Math.floor(value) : null;
  }

  if (value instanceof Date) {
    return getIndiaMinutes(value);
  }

  const text = String(value).trim();

  if (!text) return null;

  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    const date = toDate(text);
    return date ? getIndiaMinutes(date) : null;
  }

  const match = text.match(
    /^(\d{1,2})(?::(\d{1,2}))?(?::\d{2})?\s*(AM|PM)?$/i
  );

  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const meridiem = match[3]?.toUpperCase();

  if (minutes > 59) return null;

  if (meridiem) {
    if (hours < 1 || hours > 12) return null;

    hours %= 12;

    if (meridiem === "PM") {
      hours += 12;
    }
  } else if (hours > 23) {
    return null;
  }

  return hours * 60 + minutes;
}

function formatMinutesToTimeString(minutes) {
  if (
    minutes === null ||
    minutes === undefined ||
    !Number.isFinite(minutes)
  ) {
    return null;
  }

  const hrs24 = Math.floor(minutes / 60) % 24;
  const mins = Math.floor(minutes % 60);

  const meridiem = hrs24 >= 12 ? "PM" : "AM";
  const hrs12 = hrs24 % 12 === 0 ? 12 : hrs24 % 12;

  const pad = (n) => String(n).padStart(2, "0");

  return `${pad(hrs12)}:${pad(mins)} ${meridiem}`;
}

function getIndiaDateKey(value) {
  if (!value) return null;

  if (typeof value === "string") {
    const text = value.trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);

    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);

      const check = new Date(Date.UTC(year, month - 1, day));

      if (
        check.getUTCFullYear() !== year ||
        check.getUTCMonth() !== month - 1 ||
        check.getUTCDate() !== day
      ) {
        return null;
      }

      return text;
    }
  }

  const date = toDate(value);
  if (!date) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const getPart = (type) =>
    parts.find((part) => part.type === type)?.value;

  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");

  return year && month && day
    ? `${year}-${month}-${day}`
    : null;
}

function getIndiaMinutes(value = new Date()) {
  const date = toDate(value);
  if (!date) return null;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: INDIA_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const hours = Number(
    parts.find((part) => part.type === "hour")?.value
  );

  const minutes = Number(
    parts.find((part) => part.type === "minute")?.value
  );

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
}

function makeIndiaDate(dateKey, minutes) {
  if (
    !dateKey ||
    minutes === null ||
    minutes === undefined ||
    !Number.isFinite(Number(minutes))
  ) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey));

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  return new Date(
    Date.UTC(year, month - 1, day, 0, Number(minutes)) -
      330 * 60 * 1000
  );
}

function getBookingDate(booking) {
  return (
    booking.bookingDate ||
    booking.appointmentDate ||
    booking.date ||
    booking.appointment?.date ||
    booking.booking?.date ||
    booking.createdAt ||
    null
  );
}

function getBookingSlot(booking) {
  const raw =
    booking.slot ||
    booking.selectedSlot ||
    booking.appointment?.slot ||
    booking.timeSlot ||
    booking.booking?.slot ||
    {};

  if (typeof raw === "string") {
    const match = raw.match(/(.+?)\s*-\s*(.+)/);

    return {
      open: match ? match[1].trim() : raw.trim(),
      close: match ? match[2].trim() : null,
      checkupStartTime:
        booking.checkupStartTime ||
        booking.appointment?.checkupStartTime ||
        null,
    };
  }

  const slot = raw && typeof raw === "object" ? raw : {};

  return {
    ...slot,

    open:
      slot.open ||
      slot.start ||
      slot.startTime ||
      booking.slotOpen ||
      booking.slotStart ||
      null,

    close:
      slot.close ||
      slot.end ||
      slot.endTime ||
      booking.slotClose ||
      booking.slotEnd ||
      null,

    checkupStartTime:
      slot.checkupStartTime ||
      booking.checkupStartTime ||
      booking.appointment?.checkupStartTime ||
      null,
  };
}

function getBookingTime(booking) {
  const slot = getBookingSlot(booking);

  const values = [
    booking.bookingTime,
    booking.bookTime,
    booking.time,
    booking.appointmentTime,
    booking.appointment?.time,
    booking.booking?.time,
    slot.open,
  ];

  for (const value of values) {
    const minutes = parseTime(value);

    if (minutes !== null) return minutes;
  }

  return null;
}

function getDoctorSchedule(booking, doctor) {
  return (
    doctor?.schedule ||
    doctor?.weeklySchedule ||
    booking?.doctor?.schedule ||
    booking?.doctorSchedule ||
    {}
  );
}

function getCheckupStartTime(booking, doctor, sessionInfo = null) {
  const slot = getBookingSlot(booking);

  const dateKey = getIndiaDateKey(getBookingDate(booking));

  if (dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);

    const dayKey =
      DAY_NAMES[
        new Date(Date.UTC(year, month - 1, day)).getUTCDay()
      ];

    const schedule = getDoctorSchedule(booking, doctor);

    const scheduleSlots = Array.isArray(schedule?.[dayKey]?.slots)
      ? schedule[dayKey].slots
      : [];

    const slotOpen = parseTime(
      sessionInfo?.slotOpen || slot.open
    );

    const slotClose = parseTime(
      sessionInfo?.slotClose || slot.close
    );

    const configuredSlot = scheduleSlots.find((item) => {
      const open = parseTime(item.open || item.start || item.startTime);
      const close = parseTime(item.close || item.end || item.endTime);

      return (
        open !== null &&
        close !== null &&
        open === slotOpen &&
        close === slotClose
      );
    });

    const configuredStart = parseTime(
      configuredSlot?.checkupStartTime
    );

    if (configuredStart !== null) {
      return configuredStart;
    }
  }

  const values = [
    booking.checkupStartTime,
    booking.appointment?.checkupStartTime,
    booking.booking?.checkupStartTime,
    slot.checkupStartTime,
    booking.scheduledTime,
    slot.open,
  ];

  for (const value of values) {
    const minutes = parseTime(value);

    if (minutes !== null) return minutes;
  }

  return null;
}

function getDuration(booking, doctor) {
  const values = [
    booking.duration,
    booking.checkupDuration,
    booking.appointment?.duration,
    booking.booking?.duration,
    doctor?.duration,
    doctor?.checkupDuration,
    doctor?.consultationDuration,
    15,
  ];

  for (const value of values) {
    if (value === null || value === undefined || value === "") {
      continue;
    }

    const duration = Number(value);

    if (Number.isFinite(duration) && duration > 0) {
      return duration;
    }
  }

  return 15;
}

function getPriority(booking) {
  const priority = String(booking.priority || "normal")
    .trim()
    .toLowerCase();

  const patientType = String(
    booking.patientType ||
    booking.patient?.type ||
    booking.patient?.patientType ||
    ""
  )
    .trim()
    .toLowerCase();

  if (priority === "emergency" || patientType === "emergency") {
    return 0;
  }

  if (
    priority === "elderly" ||
    patientType === "elderly" ||
    booking.isElderly === true
  ) {
    return 1;
  }

  return 2;
}

function getSequence(booking) {
  const value = Number(
    booking.sequence ??
    booking.tokenNumber ??
    booking.token?.number
  );

  return Number.isFinite(value) && value > 0
    ? value
    : Number.MAX_SAFE_INTEGER;
}

function getCreatedTime(booking) {
  const date = toDate(booking.createdAt);
  return date ? date.getTime() : 0;
}

function getBookingId(booking) {
  return String(
    booking._id ||
    booking.bookingId ||
    booking.bookingReference ||
    booking.paymentId ||
    ""
  );
}

function getCancellationInfo(booking) {
  const rawCancelledBy = String(
    booking.cancelledBy ||
    booking.cancellationBy ||
    booking.canceledBy ||
    booking.cancellationReason ||
    ""
  )
    .trim()
    .toLowerCase();

  let cancelledBy = null;

  if (
    booking.byStaff === true ||
    booking.bystaff === true ||
    rawCancelledBy.includes("staff")
  ) {
    cancelledBy = "staff";
  } else if (
    booking.byDoctor === true ||
    booking.bydoctor === true ||
    rawCancelledBy.includes("doctor")
  ) {
    cancelledBy = "doctor";
  } else if (
    rawCancelledBy.includes("patient") ||
    rawCancelledBy.includes("user")
  ) {
    cancelledBy = "patient";
  }

  const status = normalizeStatus(booking.status);

  return {
    cancelledBy: status === "cancelled" ? cancelledBy : null,

    cancellationReason:
      status === "cancelled"
        ? booking.cancellationReason || null
        : null,

    cancelledAt:
      status === "cancelled"
        ? toDate(
            booking.cancelledAt || booking.canceledAt
          )?.toISOString() || null
        : null,

    refundStatus:
      booking.refundStatus ??
      booking.payment?.refundStatus ??
      null,

    refundId:
      booking.refundId ??
      booking.payment?.refundId ??
      null,

    refundAmount:
      booking.refundAmount ??
      booking.payment?.refundAmount ??
      null,

    refundInitiatedAt:
      toDate(booking.refundInitiatedAt)?.toISOString() || null,

    refundExpectedDays:
      booking.refundExpectedDays ?? null,
  };
}

function getClinicId(booking) {
  return String(
    booking.clinicId ||
    booking.clinic?._id ||
    booking.clinic?.id ||
    ""
  );
}

function getDoctorId(booking) {
  return String(
    booking.doctorId ||
    booking.doctor?._id ||
    booking.doctor?.id ||
    ""
  );
}

function compareBookings(a, b) {
  const aServing = isServing(a.status);
  const bServing = isServing(b.status);

  if (aServing !== bServing) {
    return aServing ? -1 : 1;
  }

  const priorityDifference = getPriority(a) - getPriority(b);

  if (priorityDifference !== 0) {
    return priorityDifference;
  }

  const sequenceDifference = getSequence(a) - getSequence(b);

  if (sequenceDifference !== 0) {
    return sequenceDifference;
  }

  return getCreatedTime(a) - getCreatedTime(b);
}

function sameDoctor(a, b) {
  return (
    getDoctorId(a) !== "" &&
    getDoctorId(a) === getDoctorId(b)
  );
}

function deduplicateBookings(bookings) {
  const unique = new Map();

  for (const booking of bookings) {
    if (!booking || typeof booking !== "object") continue;

    const id = getBookingId(booking);

    const key =
      id ||
      [
        booking.userId || "",
        booking.email || booking.userEmail || "",
        getClinicId(booking),
        getDoctorId(booking),
        getIndiaDateKey(getBookingDate(booking)) || "",
        getBookingTime(booking) ?? "",
      ].join("|");

    if (!unique.has(key)) {
      unique.set(key, booking);
      continue;
    }

    const existing = unique.get(key);

    const existingUpdated =
      toDate(existing.updatedAt || existing.createdAt)?.getTime() || 0;

    const incomingUpdated =
      toDate(booking.updatedAt || booking.createdAt)?.getTime() || 0;

    if (incomingUpdated > existingUpdated) {
      unique.set(key, { ...existing, ...booking });
    }
  }

  return [...unique.values()];
}

function getScheduledBaseMinutes(booking, doctor, sessionInfo = null) {
  const slot = getBookingSlot(booking);

  const slotOpen = parseTime(
    sessionInfo?.slotOpen || slot.open
  );

  const checkupStart = getCheckupStartTime(
    booking,
    doctor,
    sessionInfo
  );

  const bookingMinutes = getBookingTime(booking);

  const values = [
    slotOpen,
    checkupStart,
    bookingMinutes,
  ].filter((value) => value !== null);

  return values.length > 0 ? Math.max(...values) : null;
}

// Patient-specific serving start. Never use teamSession.startedAt here.
function getActualSessionStart(booking) {
  const values = [
    booking.sessionStartedAt,
    booking.servingStartedAt,
    booking.startedAt,
    booking.appointment?.sessionStartedAt,
    booking.appointment?.startedAt,
  ];

  for (const value of values) {
    const date = toDate(value);

    if (date) return date;
  }

  return null;
}

// Doctor's team session start.
function getTeamSessionStartedAt(sessionInfo) {
  return toDate(sessionInfo?.startedAt);
}

function makeSessionKey(doctorId, dateKey, slotOpen, sessionId = null) {
  const sessionOpen =
    parseTime(slotOpen) !== null
      ? String(parseTime(slotOpen))
      : String(
          slotOpen ||
          String(sessionId || "").split("-")[0] ||
          ""
        ).trim().toLowerCase();

  return [
    String(doctorId || ""),
    String(dateKey || ""),
    sessionOpen,
  ].join("|");
}

function calculateQueueInfo(
  booking,
  queuePool,
  doctor,
  now,
  sessionInfo = null,
  sessionByPair = new Map()
) {
  const status = normalizeStatus(booking.status);

  const dateKey = getIndiaDateKey(
    getBookingDate(booking)
  );

  const activeBookings = queuePool
    .filter(
      (item) =>
        isActive(item.status) &&
        getIndiaDateKey(getBookingDate(item)) === dateKey &&
        sameDoctor(item, booking)
    )
    .sort(compareBookings);

  const timeline = [];

  let previousEndMinutes = null;

  for (const item of activeBookings) {
    const itemDateKey = getIndiaDateKey(
      getBookingDate(item)
    );

    const itemSlot = getBookingSlot(item);

    const itemSessionKey = makeSessionKey(
      getDoctorId(item),
      itemDateKey,
      itemSlot.open,
      `${itemSlot.open || ""}-${itemSlot.close || ""}`
    );

    const itemSessionInfo =
      sessionByPair.get(itemSessionKey) || null;

    const itemDoctor = item.doctor || doctor;

    const itemBaseMinutes = getScheduledBaseMinutes(
      item,
      itemDoctor,
      itemSessionInfo
    );

    let startMinutes =
      itemBaseMinutes ??
      previousEndMinutes ??
      getIndiaMinutes(now) ??
      0;

    if (isServing(item.status)) {
      const actualStart = getActualSessionStart(item);

      if (
        actualStart &&
        getIndiaDateKey(actualStart) === itemDateKey
      ) {
        const actualStartMinutes = getIndiaMinutes(actualStart);

        if (actualStartMinutes !== null) {
          startMinutes = actualStartMinutes;
        }
      }
    }

    if (previousEndMinutes !== null) {
      startMinutes = Math.max(
        startMinutes,
        previousEndMinutes
      );
    }

    const itemDuration = getDuration(item, itemDoctor);

    const endMinutes = startMinutes + itemDuration;

    timeline.push({
      booking: item,
      id: getBookingId(item),
      startMinutes,
      endMinutes,
      duration: itemDuration,
    });

    previousEndMinutes = endMinutes;
  }

  const bookingId = getBookingId(booking);

  let ownIndex = timeline.findIndex(
    (item) => bookingId && item.id === bookingId
  );

  if (ownIndex < 0 && booking.bookingReference) {
    ownIndex = timeline.findIndex(
      (item) =>
        String(item.booking.bookingReference || "") ===
        String(booking.bookingReference)
    );
  }

  const ownTimeline =
    ownIndex >= 0 ? timeline[ownIndex] : null;

  const ownBaseMinutes = getScheduledBaseMinutes(
    booking,
    doctor,
    sessionInfo
  );

  let peopleAhead = 0;
  let expectedStartMinutes = ownBaseMinutes;
  let estimatedWaitMinutes = 0;

  if (isActive(status)) {
    if (ownTimeline) {
      peopleAhead = ownIndex;

      expectedStartMinutes = ownTimeline.startMinutes;

      estimatedWaitMinutes = Math.max(
        0,
        ownTimeline.startMinutes -
          (ownBaseMinutes ?? ownTimeline.startMinutes)
      );
    } else {
      peopleAhead = timeline.length;

      const lastEnd =
        timeline.length > 0
          ? timeline[timeline.length - 1].endMinutes
          : null;

      if (lastEnd !== null) {
        expectedStartMinutes = Math.max(
          ownBaseMinutes ?? lastEnd,
          lastEnd
        );
      }

      estimatedWaitMinutes =
        expectedStartMinutes !== null &&
        ownBaseMinutes !== null
          ? Math.max(
              0,
              expectedStartMinutes - ownBaseMinutes
            )
          : 0;
    }
  }

  let expectedTurnAt = null;

  if (dateKey && isServing(status)) {
    const actualStart = getActualSessionStart(booking);

    if (actualStart) {
      expectedTurnAt = actualStart.toISOString();
    } else if (expectedStartMinutes !== null) {
      const turnDate = makeIndiaDate(
        dateKey,
        expectedStartMinutes
      );

      expectedTurnAt = turnDate
        ? turnDate.toISOString()
        : null;
    }
  } else if (
    dateKey &&
    expectedStartMinutes !== null
  ) {
    const turnDate = makeIndiaDate(
      dateKey,
      expectedStartMinutes
    );

    expectedTurnAt = turnDate
      ? turnDate.toISOString()
      : null;
  }

  return {
    peopleAhead,
    estimatedWaitMinutes,
    expectedTurnAt,
    duration: getDuration(booking, doctor),
    startMinutes: expectedStartMinutes,
  };
}

function serializeBooking(
  booking,
  sessionInfo,
  doctor,
  queueInfo
) {
  const slotRaw = getBookingSlot(booking);

  const dateKey = getIndiaDateKey(
    getBookingDate(booking)
  );

  const checkupStartMinutes = getCheckupStartTime(
    booking,
    doctor,
    sessionInfo
  );

  // Prefer the actual teamSession slot.
  const actualSlotOpen =
    sessionInfo?.slotOpen || slotRaw.open;

  const actualSlotClose =
    sessionInfo?.slotClose || slotRaw.close;

  const slotOpenMinutes = parseTime(actualSlotOpen);
  const slotCloseMinutes = parseTime(actualSlotClose);

  const slot = {
    open:
      formatMinutesToTimeString(slotOpenMinutes) ||
      actualSlotOpen ||
      null,

    close:
      formatMinutesToTimeString(slotCloseMinutes) ||
      actualSlotClose ||
      null,

    checkupStartTime:
      formatMinutesToTimeString(checkupStartMinutes) ||
      slotRaw.checkupStartTime ||
      null,
  };

  const bookingTimeMinutes = getBookingTime(booking);

  const bookingTime =
    formatMinutesToTimeString(bookingTimeMinutes) ||
    booking.bookingTime ||
    slot.open;

  const cancellationInfo = getCancellationInfo(booking);

  const originalPaymentAmount = Number(
    booking.originalPaymentAmount ??
    booking.paymentAmount ??
    booking.amount ??
    booking.payment?.originalAmount ??
    booking.payment?.amount ??
    0
  );

  const paymentAmount = Number(
    booking.paymentAmount ?? originalPaymentAmount ?? 0
  );

  const sequence = getSequence(booking);

  const sequenceNum =
    sequence === Number.MAX_SAFE_INTEGER ? 1 : sequence;

  const tokenNumber =
    booking.tokenNumber ||
    booking.token?.number ||
    `A${String(sequenceNum).padStart(3, "0")}`;

  const actualPatientStartedAt = getActualSessionStart(booking);

  const teamSessionStartedAt =
    getTeamSessionStartedAt(sessionInfo);

  const latitude =
    booking.lat ??
    booking.latitude ??
    booking.location?.lat ??
    booking.location?.latitude ??
    null;

  const longitude =
    booking.lng ??
    booking.longitude ??
    booking.location?.lng ??
    booking.location?.longitude ??
    null;

  let createdAtDate = toDate(
    booking.createdAt ||
    booking.created_at ||
    booking.bookedAt ||
    booking.bookingCreatedAt
  );

  if (!createdAtDate && booking._id) {
    const idStr = String(booking._id);

    if (/^[0-9a-fA-F]{24}$/.test(idStr)) {
      createdAtDate = new Date(
        parseInt(idStr.substring(0, 8), 16) * 1000
      );
    }
  }

  const createdAt = createdAtDate
    ? createdAtDate.toISOString()
    : null;

  const updatedAt =
    toDate(booking.updatedAt || booking.updated_at)?.toISOString() ||
    createdAt;

  const rescheduledAt =
    toDate(booking.rescheduledAt)?.toISOString() || null;

  const isByDoctor =
    booking.byDoctor === true ||
    booking.bydoctor === true;

  const isByStaff =
    booking.byStaff === true ||
    booking.bystaff === true;

  return {
    _id: String(booking._id),

    bookingReference:
      booking.bookingReference ||
      booking.bookingId ||
      `REF-${String(booking._id).slice(-8).toUpperCase()}`,

    userId: String(
      booking.userId || booking.user || ""
    ),

    createdAt,
    updatedAt,
    rescheduledAt,
    bookedAt: createdAt,

    clinicId: getClinicId(booking),

    clinicName:
      booking.clinicName ||
      booking.clinic?.name ||
      "Clinic",

    doctorId:
      getDoctorId(booking) ||
      String(doctor?._id || doctor?.id || ""),

    doctorName:
      booking.doctorName ||
      doctor?.name ||
      doctor?.doctorName ||
      booking.doctor?.name ||
      "Doctor",

    bookingDate: dateKey,

    slot,
    bookingTime,

    sequence: sequenceNum,
    tokenNumber,

    status: normalizeStatus(booking.status),

    byDoctor: isByDoctor,
    bydoctor: isByDoctor,
    byStaff: isByStaff,
    bystaff: isByStaff,

    priority: String(
      booking.priority || "normal"
    ).toLowerCase(),

    patient: booking.patient || {},

    patientType: String(
      booking.patientType ||
      booking.patient?.type ||
      "self"
    ).toLowerCase(),

    duration: queueInfo.duration,

    paymentAmount,
    originalPaymentAmount,

    paymentStatus: booking.paymentStatus || "paid",

    // Actual teamSessions document information
    sessionStatus: sessionInfo?.status || null,

    sessionId: sessionInfo?.sessionId || null,

    sessionLabel: sessionInfo?.sessionLabel || null,

    sessionStartedAt: teamSessionStartedAt
      ? teamSessionStartedAt.toISOString()
      : null,

    sessionCreatedAt:
      toDate(sessionInfo?.createdAt)?.toISOString() || null,

    sessionExpiresAt:
      toDate(sessionInfo?.expiresAt)?.toISOString() || null,

    sessionSlot: {
      open: sessionInfo?.slotOpen || null,
      close: sessionInfo?.slotClose || null,
    },

    sessionCancelled: sessionInfo?.cancel === true,

    // Patient-specific serving information
    patientStartedAt: actualPatientStartedAt
      ? actualPatientStartedAt.toISOString()
      : null,

    peopleAhead: queueInfo.peopleAhead,

    expectedTurnAt: queueInfo.expectedTurnAt,

    lat:
      latitude !== null
        ? Number(latitude)
        : null,

    lng:
      longitude !== null
        ? Number(longitude)
        : null,

    cancelledBy: cancellationInfo.cancelledBy,

    cancellationReason:
      cancellationInfo.cancellationReason,

    cancelledAt: cancellationInfo.cancelledAt,

    refundStatus: cancellationInfo.refundStatus,

    refundId: cancellationInfo.refundId,

    refundAmount: cancellationInfo.refundAmount,

    refundInitiatedAt:
      cancellationInfo.refundInitiatedAt,

    refundExpectedDays:
      cancellationInfo.refundExpectedDays,
  };
}

function buildUserQuery(token) {
  const clauses = [];

  const tokenId = String(
    token.id || token.sub || ""
  ).trim();

  const subject = String(
    token.sub || ""
  ).trim();

  const email = String(
    token.email || ""
  ).trim().toLowerCase();

  for (const id of new Set(
    [tokenId, subject].filter(Boolean)
  )) {
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

function addIdCandidates(values, id) {
  if (!id) return;

  const text = String(id);

  values.add(text);

  if (ObjectId.isValid(text) && text.length === 24) {
    values.add(new ObjectId(text));
  }
}

export async function GET(request) {
  try {
    const secret =
      process.env.AUTH_SECRET ||
      process.env.NEXTAUTH_SECRET;

    if (!secret) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication configuration is missing.",
        },
        { status: 500 }
      );
    }

    const token = await getToken({
      req: request,
      secret,
    });

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: "Please log in to view your bookings.",
        },
        { status: 401 }
      );
    }

    if (!process.env.MONGODB) {
      return NextResponse.json(
        {
          success: false,
          message: "Database configuration is missing.",
        },
        { status: 500 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    const bookingsCollection = db.collection("bookings");

    // Collection name is teamSessions (plural)
    const teamSessionsCollection = db.collection("teamSessions");

    const userQuery = buildUserQuery(token);

    if (!userQuery.length) {
      return NextResponse.json(
        {
          success: false,
          message: "Unable to identify your account.",
        },
        { status: 400 }
      );
    }

    // 1. Fetch patient's bookings
    const bookingDocuments = await bookingsCollection
      .find({
        $or: userQuery,
      })
      .toArray();

    if (!bookingDocuments.length) {
      return NextResponse.json({
        success: true,
        bookings: [],
        total: 0,
      });
    }

    // 2. Fetch matching teamSessions
    const sessionConditions = [];

    for (const booking of bookingDocuments) {
      const doctorId = getDoctorId(booking);

      const dateKey = getIndiaDateKey(
        getBookingDate(booking)
      );

      if (!doctorId || !dateKey) continue;

      const doctorCandidates = new Set();

      addIdCandidates(doctorCandidates, doctorId);

      sessionConditions.push({
        doctorId: {
          $in: [...doctorCandidates],
        },
        date: dateKey,
      });
    }

    const teamSessions = sessionConditions.length
      ? await teamSessionsCollection
          .find({
            $or: sessionConditions,
          })
          .sort({
            updatedAt: -1,
            createdAt: -1,
          })
          .toArray()
      : [];

    // Match sessions using doctorId + date + slotOpen
    const sessionByPair = new Map();

    for (const session of teamSessions) {
      if (!session?.doctorId || !session?.date) {
        continue;
      }

      const key = makeSessionKey(
        session.doctorId,
        session.date,
        session.slotOpen,
        session.sessionId
      );

      const existing = sessionByPair.get(key);

      const sessionIsActive =
        String(session.status || "").toLowerCase() === "active" &&
        session.cancel !== true;

      const existingIsActive =
        String(existing?.status || "").toLowerCase() === "active" &&
        existing?.cancel !== true;

      if (
        !existing ||
        (sessionIsActive && !existingIsActive)
      ) {
        sessionByPair.set(key, session);
      }
    }

    // 3. Fetch all active queue bookings
    const queueConditions = [];

    for (const booking of bookingDocuments) {
      const doctorId = getDoctorId(booking);

      const dateKey = getIndiaDateKey(
        getBookingDate(booking)
      );

      if (!doctorId || !dateKey) continue;

      const doctorCandidates = new Set();

      addIdCandidates(doctorCandidates, doctorId);

      queueConditions.push({
        doctorId: {
          $in: [...doctorCandidates],
        },
        status: {
          $in: [
            "waiting",
            "serving",
            "in-progress",
            "in_progress",
            "in progress",
            "Waiting",
            "Serving",
            "In Progress",
          ],
        },
      });
    }

    const otherQueueBookings = queueConditions.length
      ? await bookingsCollection
          .find({
            $or: queueConditions,
          })
          .toArray()
      : [];

    const queuePool = deduplicateBookings([
      ...otherQueueBookings,
      ...bookingDocuments,
    ]);

    // 4. Calculate booking and queue information
    const now = new Date();

    const result = bookingDocuments.map((booking) => {
      const doctorId = getDoctorId(booking);

      const dateKey = getIndiaDateKey(
        getBookingDate(booking)
      );

      const slot = getBookingSlot(booking);

      const sessionKey = makeSessionKey(
        doctorId,
        dateKey,
        slot.open,
        `${slot.open || ""}-${slot.close || ""}`
      );

      const sessionInfo =
        sessionByPair.get(sessionKey) || null;

      const doctor = booking.doctor || null;

      const queueInfo = calculateQueueInfo(
        booking,
        queuePool,
        doctor,
        now,
        sessionInfo,
        sessionByPair
      );

      return serializeBooking(
        booking,
        sessionInfo,
        doctor,
        queueInfo
      );
    });

    // 5. Sort bookings
    result.sort((a, b) => {
      const dateA = a.bookingDate || "";
      const dateB = b.bookingDate || "";

      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }

      return a.sequence - b.sequence;
    });

    // 6. Return response
    return NextResponse.json({
      success: true,
      bookings: result,
      total: result.length,
    });

  } catch (error) {
    console.error(
      "GET /api/my-bookings error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch bookings.",
        error:
          process.env.NODE_ENV === "development"
            ? error?.stack ||
              error?.message ||
              String(error)
            : undefined,
      },
      { status: 500 }
    );
  }
}
