
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

const TIME_ZONE = "Asia/Kolkata";
const DAYS_TO_SHOW = 30;

const EXCLUDED_BOOKING_STATUSES = [
  "cancelled",
  "canceled",
  "failed",
  "refunded",
  "rejected",
];

// --------------------------------------------------
// DATE HELPERS
// --------------------------------------------------

function getIndiaDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(date, days) {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function isValidDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) {
    return false;
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
}

function getWeekdayLabel(date) {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString(
    "en-US",
    {
      weekday: "short",
      timeZone: "UTC",
    }
  );
}

function formatDateLabel(date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function getWeekday(date) {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString(
    "en-US",
    {
      weekday: "long",
      timeZone: "UTC",
    }
  );
}

// --------------------------------------------------
// NORMALIZATION HELPERS
// --------------------------------------------------

function normalizeTime(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function normalizeHolidayDates(holidayDates = []) {
  if (!Array.isArray(holidayDates)) {
    return [];
  }

  return holidayDates
    .map((item) => {
      const value =
        typeof item === "string"
          ? item
          : item?.date ??
            item?.holidayDate ??
            item?.value ??
            "";

      return typeof value === "string" ? value.trim() : "";
    })
    .filter(isValidDate);
}

function getMemberSchedule(member, date) {
  const weekday = getWeekday(date);
  return member?.schedule?.[weekday] || null;
}

// Weekly schedule.active controls weekday availability.
// Individual slots are active unless explicitly false.

function isScheduleActive(schedule) {
  return (
    schedule?.active === true &&
    Array.isArray(schedule?.slots) &&
    schedule.slots.some(
      (slot) => slot && slot.active !== false
    )
  );
}

// --------------------------------------------------
// SESSION STATUS HELPERS
// --------------------------------------------------

function isClosedStatus(status) {
  return [
    "closed",
    "completed",
    "cancelled",
    "canceled",
    "expired",
    "rejected",
  ].includes(
    String(status ?? "").trim().toLowerCase()
  );
}

function isSessionCancelled(session) {
  if (!session) return false;

  const status = String(session.status || "")
    .trim()
    .toLowerCase();

  if (
    session.cancel === true ||
    isClosedStatus(status) ||
    Boolean(session.closedAt)
  ) {
    return true;
  }

  if (status === "active" && session.expiresAt) {
    const expiresAt = new Date(session.expiresAt).getTime();

    if (
      Number.isFinite(expiresAt) &&
      expiresAt <= Date.now()
    ) {
      return true;
    }
  }

  return false;
}

// --------------------------------------------------
// TEAM SESSION HELPERS
// --------------------------------------------------

function sameSessionTime(a, b) {
  const aOpen = normalizeTime(a?.open || a?.slotOpen);
  const aClose = normalizeTime(a?.close || a?.slotClose);

  const bOpen = normalizeTime(b?.open || b?.slotOpen);
  const bClose = normalizeTime(b?.close || b?.slotClose);

  return Boolean(
    aOpen &&
    aClose &&
    bOpen &&
    bClose &&
    aOpen === bOpen &&
    aClose === bClose
  );
}

function getSessionTimeFromId(sessionId) {
  const value = String(sessionId ?? "").trim();

  if (!value.includes("-")) {
    return null;
  }

  const parts = value.split("-");

  if (parts.length !== 2) {
    return null;
  }

  return {
    open: parts[0].trim(),
    close: parts[1].trim(),
  };
}

// Supports both:
//
// Format 1:
// { date, sessions: [...] }
//
// Format 2:
// { date, sessionId, cancel, status, ... }

function getDailySessionEntries(dailyRecords = []) {
  const entries = [];

  for (const record of dailyRecords) {
    if (Array.isArray(record?.sessions)) {
      entries.push(...record.sessions);
    }

    if (
      record?.sessionId ||
      record?.slotOpen ||
      record?.slotClose
    ) {
      entries.push(record);
    }
  }

  return entries;
}

function matchesDailySession(dailySession, scheduleSlot) {
  if (!dailySession || !scheduleSlot) {
    return false;
  }

  // Match opening and closing times.
  if (sameSessionTime(dailySession, scheduleSlot)) {
    return true;
  }

  const sessionId = normalizeTime(dailySession.sessionId);
  const scheduleId = normalizeTime(scheduleSlot.slotId);

  // Match slot IDs.
  if (
    sessionId &&
    scheduleId &&
    sessionId === scheduleId
  ) {
    return true;
  }

  // Match sessionId stored as open-close.
  const scheduleTime = normalizeTime(
    `${scheduleSlot.open}-${scheduleSlot.close}`
  );

  if (sessionId && sessionId === scheduleTime) {
    return true;
  }

  const parsedTime = getSessionTimeFromId(
    dailySession.sessionId
  );

  return Boolean(
    parsedTime &&
    sameSessionTime(parsedTime, scheduleSlot)
  );
}

function getSessionSortTime(session) {
  const updatedAt = session?.updatedAt
    ? new Date(session.updatedAt).getTime()
    : 0;

  const startedAt = session?.startedAt
    ? new Date(session.startedAt).getTime()
    : 0;

  const createdAt = session?.createdAt
    ? new Date(session.createdAt).getTime()
    : 0;

  return Math.max(
    Number.isFinite(updatedAt) ? updatedAt : 0,
    Number.isFinite(startedAt) ? startedAt : 0,
    Number.isFinite(createdAt) ? createdAt : 0
  );
}

// Get latest matching teamSession for one weekly slot.

function getMatchingDailySessions(
  dailyRecords = [],
  scheduleSlot
) {
  const matching = getDailySessionEntries(
    dailyRecords
  ).filter((session) =>
    matchesDailySession(session, scheduleSlot)
  );

  if (!matching.length) {
    return [];
  }

  matching.sort(
    (a, b) =>
      getSessionSortTime(b) - getSessionSortTime(a)
  );

  return [matching[0]];
}

// --------------------------------------------------
// DAILY SLOT HELPERS
// --------------------------------------------------

function getMatchingDailySlot(
  dailySession,
  scheduleSlot
) {
  if (!Array.isArray(dailySession?.slots)) {
    return null;
  }

  return (
    dailySession.slots.find((dailySlot) => {
      if (!dailySlot) {
        return false;
      }

      const sameId =
        dailySlot.slotId &&
        scheduleSlot.slotId &&
        normalizeTime(dailySlot.slotId) ===
          normalizeTime(scheduleSlot.slotId);

      return (
        sameSessionTime(dailySlot, scheduleSlot) ||
        sameId
      );
    }) || null
  );
}

function isDailySlotClosed(dailySlot) {
  if (!dailySlot) {
    return false;
  }

  return (
    dailySlot.cancel === true ||
    isClosedStatus(dailySlot.status) ||
    dailySlot.active === false ||
    Boolean(dailySlot.closedAt)
  );
}

// --------------------------------------------------
// CHECK WHETHER ONE SLOT IS CLOSED
// --------------------------------------------------

function isSlotClosedForDate(
  dailyRecords = [],
  scheduleSlot
) {
  if (!scheduleSlot) {
    return false;
  }

  // Find the latest matching teamSession.
  const matchingSessions = getMatchingDailySessions(
    dailyRecords,
    scheduleSlot
  );

  // No teamSession override: use weekly schedule.
  if (!matchingSessions.length) {
    return false;
  }

  const latestSession = matchingSessions[0];

  // Check session-level closure.
  if (isSessionCancelled(latestSession)) {
    return true;
  }

  // Check nested individual daily slot closure.
  const dailySlot = getMatchingDailySlot(
    latestSession,
    scheduleSlot
  );

  if (dailySlot && isDailySlotClosed(dailySlot)) {
    return true;
  }

  return false;
}

// --------------------------------------------------
// DATE CLOSURE LOGIC
// --------------------------------------------------

function isDailySessionClosed(
  scheduleSlots = [],
  dailyRecords = []
) {
  // Explicit holiday.
  if (
    dailyRecords.some(
      (record) => record?.holiday === true
    )
  ) {
    return true;
  }

  const activeSlots = scheduleSlots.filter(
    (slot) => slot && slot.active !== false
  );

  if (!activeSlots.length) {
    return true;
  }

  // No daily override: weekly schedule remains active.
  if (!dailyRecords.length) {
    return false;
  }

  // Close the date only when every active slot is closed.
  return activeSlots.every((scheduleSlot) =>
    isSlotClosedForDate(dailyRecords, scheduleSlot)
  );
}

// --------------------------------------------------
// DAILY SLOT SELECTION
// --------------------------------------------------

function getMatchingDailySlotFromSessions(
  matchingSessions,
  scheduleSlot
) {
  const matchingSlots = matchingSessions
    .filter(
      (session) => !isSessionCancelled(session)
    )
    .map((session) =>
      getMatchingDailySlot(session, scheduleSlot)
    )
    .filter(Boolean);

  if (!matchingSlots.length) {
    return null;
  }

  return (
    matchingSlots.find(
      (slot) => !isDailySlotClosed(slot)
    ) || matchingSlots[0]
  );
}

// --------------------------------------------------
// BOOKING COUNT HELPERS
// --------------------------------------------------

function getBookingSlotKeys(booking) {
  const slotId = normalizeTime(booking?.slotId);

  const open = normalizeTime(
    booking?.open ?? booking?.slotOpen
  );

  const close = normalizeTime(
    booking?.close ?? booking?.slotClose
  );

  const timeKey =
    open && close ? `${open}-${close}` : "";

  return {
    slotId,
    timeKey,
  };
}

function getBookedCount(
  bookingCountsMap,
  slotId,
  timeKey
) {
  const idCount = Number(
    bookingCountsMap[normalizeTime(slotId)] ?? 0
  );

  const timeCount = Number(
    bookingCountsMap[normalizeTime(timeKey)] ?? 0
  );

  return Math.max(idCount, timeCount);
}

// --------------------------------------------------
// AVAILABLE SLOT CALCULATION
// --------------------------------------------------

function getAvailableSlots(
  schedule,
  dailyRecords = [],
  bookingCountsMap = {}
) {
  if (!Array.isArray(schedule?.slots)) {
    return [];
  }

  return schedule.slots
    .filter(
      (slot) => slot && slot.active !== false
    )
    .map((slot) => {
      // IMPORTANT:
      // Check the teamSessions collection records first.
      // A closed session hides only its matching slot.
      if (
        isSlotClosedForDate(dailyRecords, slot)
      ) {
        return null;
      }

      const matchingSessions = getMatchingDailySessions(
        dailyRecords,
        slot
      );

      const activeSessions = matchingSessions.filter(
        (session) => !isSessionCancelled(session)
      );

      const dailySession = activeSessions[0] || null;

      const dailySlot = getMatchingDailySlotFromSessions(
        activeSessions,
        slot
      );

      // Daily capacity overrides weekly capacity.
      const rawCapacity =
        dailySlot?.capacity ?? slot.capacity;

      const parsedCapacity = Number(rawCapacity);

      const capacity =
        Number.isFinite(parsedCapacity) &&
        parsedCapacity > 0
          ? Math.floor(parsedCapacity)
          : 0;

      // Prefer daily slot ID, then weekly slot ID.
      const slotIdStr = String(
        dailySlot?.slotId ||
        slot.slotId ||
        dailySession?.slotId ||
        `${slot.open}-${slot.close}`
      );

      const timeKey = normalizeTime(
        `${slot.open}-${slot.close}`
      );

      const bookedCount = getBookedCount(
        bookingCountsMap,
        slotIdStr,
        timeKey
      );

      const remaining =
        capacity > 0
          ? Math.max(0, capacity - bookedCount)
          : 0;

      return {
        id: slotIdStr,
        slotId: slotIdStr,

        sessionId:
          dailySession?.sessionId ||
          dailySession?._id?.toString?.() ||
          null,

        label: `${slot.open} - ${slot.close}`,

        open: slot.open,
        close: slot.close,

        checkupStartTime:
          dailySlot?.checkupStartTime ||
          dailySession?.checkupStartTime ||
          slot.checkupStartTime ||
          slot.open,

        configured: capacity > 0,

        capacity,
        booked: bookedCount,
        remaining,

        isFull:
          capacity > 0 && remaining === 0,
      };
    })
    .filter(Boolean);
}

// --------------------------------------------------
// FETCH BOOKING COUNTS
// --------------------------------------------------

async function getBookingCounts(
  db,
  memberId,
  memberObjectId,
  date
) {
  const bookings = await db
    .collection("bookings")
    .find(
      {
        $and: [
          {
            $or: [
              { doctorId: memberId },
              { doctorId: memberObjectId },
              { memberId },
              { memberId: memberObjectId },
            ],
          },
          { date },
        ],
      },
      {
        projection: {
          status: 1,
          slotId: 1,
          open: 1,
          close: 1,
          slotOpen: 1,
          slotClose: 1,
        },
      }
    )
    .toArray();

  const bookingCountsMap = Object.create(null);

  for (const booking of bookings) {
    const status = String(
      booking?.status ?? ""
    )
      .trim()
      .toLowerCase();

    if (
      EXCLUDED_BOOKING_STATUSES.includes(status)
    ) {
      continue;
    }

    const { slotId, timeKey } =
      getBookingSlotKeys(booking);

    const uniqueKeys = new Set(
      [slotId, timeKey].filter(Boolean)
    );

    for (const key of uniqueKeys) {
      bookingCountsMap[key] =
        (bookingCountsMap[key] || 0) + 1;
    }
  }

  return bookingCountsMap;
}

// --------------------------------------------------
// MAIN API ROUTE
// --------------------------------------------------

export async function GET(request, { params }) {
  try {
    const { id } = await params;

    // --------------------------------------------------
    // VALIDATE MEMBER ID
    // --------------------------------------------------

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid team member ID.",
        },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    // --------------------------------------------------
    // AUTHENTICATION
    // --------------------------------------------------

    const authSession = await getServerSession(
      authOptions
    );

    if (!authSession?.user) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication required.",
        },
        { status: 401 }
      );
    }

    const requesterRole = authSession.user.role;

    // --------------------------------------------------
    // DATABASE CONNECTION
    // --------------------------------------------------

    const client = await clientPromise;

    const db = client.db(
      process.env.MONGODB || "rahul"
    );

    // --------------------------------------------------
    // FIND DOCTOR OR STAFF
    // --------------------------------------------------

    const memberObjectId = new ObjectId(id);

    const member = await db
      .collection("team")
      .findOne({
        _id: memberObjectId,
        role: {
          $in: ["doctor", "staff"],
        },
      });

    if (!member) {
      return NextResponse.json(
        {
          success: false,
          message: "Doctor or staff member not found.",
        },
        { status: 404 }
      );
    }

    const memberId = String(member._id);
    const memberRole = member.role;

    const today = getIndiaDate();

    // --------------------------------------------------
    // DATE VALIDATION
    // --------------------------------------------------

    if (date) {
      if (!isValidDate(date)) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid date format.",
          },
          { status: 400 }
        );
      }

      if (date < today) {
        return NextResponse.json(
          {
            success: false,
            message: "Past dates are not available.",
          },
          { status: 400 }
        );
      }
    }

    // --------------------------------------------------
    // FETCH DAILY TEAM SESSIONS
    // --------------------------------------------------

    const sessionQuery = {
      $and: [
        {
          $or: [
            { doctorId: memberId },
            { doctorId: memberObjectId },

            { staffId: memberId },
            { staffId: memberObjectId },

            { memberId },
            { memberId: memberObjectId },
          ],
        },
        {
          $or: [
            { role: memberRole },
            { role: null },
          ],
        },
      ],
    };

    if (date) {
      sessionQuery.date = date;
    } else {
      sessionQuery.date = {
        $gte: today,
        $lt: addDays(today, DAYS_TO_SHOW),
      };
    }

    const dailyRecords = await db
      .collection("teamSessions")
      .find(sessionQuery)
      .sort({
        updatedAt: -1,
        createdAt: -1,
      })
      .toArray();

    // --------------------------------------------------
    // GROUP DAILY RECORDS BY DATE
    // --------------------------------------------------

    const dailyRecordMap = new Map();

    for (const record of dailyRecords) {
      if (!record?.date) {
        continue;
      }

      const existing =
        dailyRecordMap.get(record.date) || [];

      existing.push(record);

      dailyRecordMap.set(
        record.date,
        existing
      );
    }

    // --------------------------------------------------
    // HOLIDAYS
    // --------------------------------------------------

    const holidays = normalizeHolidayDates(
      member.holidayDates
    );

    // --------------------------------------------------
    // AVAILABLE DATES RANGE MODE
    // --------------------------------------------------

    if (!date) {
      const availableDates = [];

      for (let i = 0; i < DAYS_TO_SHOW; i++) {
        const dateValue = addDays(today, i);

        const records =
          dailyRecordMap.get(dateValue) || [];

        const schedule = getMemberSchedule(
          member,
          dateValue
        );

        const holiday =
          holidays.includes(dateValue) ||
          records.some(
            (record) => record?.holiday === true
          );

        const scheduleActive =
          isScheduleActive(schedule);

        const allSessionsClosed =
          isDailySessionClosed(
            schedule?.slots || [],
            records
          );

        const isClosed =
          holiday ||
          !scheduleActive ||
          allSessionsClosed;

        availableDates.push({
          value: dateValue,
          label: formatDateLabel(dateValue),
          weekday: getWeekday(dateValue),
          weekdayShort: getWeekdayLabel(dateValue),

          isHoliday: holiday,
          isClosed,
          isAvailable: !isClosed,
        });
      }

      return NextResponse.json({
        success: true,
        requesterRole,
        memberRole,
        memberId,
        availableDates,
      });
    }

    // --------------------------------------------------
    // SPECIFIC DATE MODE
    // --------------------------------------------------

    const bookingCountsMap = await getBookingCounts(
      db,
      memberId,
      memberObjectId,
      date
    );

    const records =
      dailyRecordMap.get(date) || [];

    const holiday =
      holidays.includes(date) ||
      records.some(
        (record) => record?.holiday === true
      );

    const schedule = getMemberSchedule(
      member,
      date
    );

    const scheduleActive =
      isScheduleActive(schedule);

    const allSessionsClosed =
      isDailySessionClosed(
        schedule?.slots || [],
        records
      );

    const active =
      scheduleActive &&
      !holiday &&
      !allSessionsClosed;

    const availableTimes = active
      ? getAvailableSlots(
          schedule,
          records,
          bookingCountsMap
        )
      : [];

    const dailySessionEntries =
      getDailySessionEntries(records);

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    return NextResponse.json({
      success: true,

      requesterRole,
      memberRole,
      memberId,
      date,

      selectedDoctorSchedule: {
        active,

        isHoliday: holiday,

        isSessionClosed: allSessionsClosed,

        slots: availableTimes,
      },

      availableTimes,

      dailyRecord: records.length
        ? {
            date,
            holiday,

            sessions: dailySessionEntries.map(
              (session) => {
                const { _id, ...rest } = session;
                return rest;
              }
            ),
          }
        : null,
    });
  } catch (error) {
    console.error(
      "GET team member slots error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error.message ||
          "Failed to fetch team member slots.",
      },
      { status: 500 }
    );
  }
}
