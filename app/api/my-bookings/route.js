 
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

  const date = value instanceof Date ? value : new Date(value);

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

    if (meridiem === "PM") hours += 12;
  } else if (hours > 23) {
    return null;
  }

  return hours * 60 + minutes;
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

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(
    String(dateKey)
  );

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
    const match = raw.match(/(.+?)\s+-\s+(.+)/);

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

function getCheckupStartTime(booking, doctor) {
  const slot = getBookingSlot(booking);
  const dateKey = getIndiaDateKey(getBookingDate(booking));

  if (dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);

    const dayKey =
      DAY_NAMES[
        new Date(Date.UTC(year, month - 1, day)).getUTCDay()
      ];

    const scheduleSlots = Array.isArray(
      doctor?.schedule?.[dayKey]?.slots
    )
      ? doctor.schedule[dayKey].slots
      : [];

    const slotOpen = parseTime(slot.open);
    const slotClose = parseTime(slot.close);

    const configuredSlot = scheduleSlots.find((item) => {
      const open = parseTime(
        item.open || item.start || item.startTime
      );

      const close = parseTime(
        item.close || item.end || item.endTime
      );

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

    if (configuredStart !== null) return configuredStart;
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

function getStartMinutes(booking, doctor) {
  const bookingMinutes = getBookingTime(booking);
  const checkupMinutes = getCheckupStartTime(booking, doctor);

  if (bookingMinutes === null && checkupMinutes === null) {
    return null;
  }

  if (bookingMinutes === null) return checkupMinutes;
  if (checkupMinutes === null) return bookingMinutes;

  return Math.max(bookingMinutes, checkupMinutes);
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

function sameDoctorAndClinic(a, b) {
  return (
    getClinicId(a) !== "" &&
    getDoctorId(a) !== "" &&
    getClinicId(a) === getClinicId(b) &&
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
      toDate(existing.updatedAt || existing.createdAt)?.getTime() ||
      0;

    const incomingUpdated =
      toDate(booking.updatedAt || booking.createdAt)?.getTime() ||
      0;

    if (incomingUpdated > existingUpdated) {
      unique.set(key, booking);
    }
  }

  return [...unique.values()];
}


function getScheduledBaseMinutes(booking, doctor) {
  const dateKey = getIndiaDateKey(getBookingDate(booking));
  const slot = getBookingSlot(booking);

  const slotOpen = parseTime(slot.open);
  const checkupStart = getCheckupStartTime(booking, doctor);

  let baseMinutes = getStartMinutes(booking, doctor);

  if (slotOpen !== null) {
    baseMinutes =
      baseMinutes === null
        ? slotOpen
        : Math.max(baseMinutes, slotOpen);
  }

  if (checkupStart !== null) {
    baseMinutes =
      baseMinutes === null
        ? checkupStart
        : Math.max(baseMinutes, checkupStart);
  }

  const createdAt = toDate(booking.createdAt);

  if (
    createdAt &&
    dateKey &&
    getIndiaDateKey(createdAt) === dateKey
  ) {
    const createdMinutes = getIndiaMinutes(createdAt);

    if (createdMinutes !== null) {
      baseMinutes =
        baseMinutes === null
          ? createdMinutes
          : Math.max(baseMinutes, createdMinutes);
    }
  }

  return baseMinutes;
}

function calculateQueueInfo(booking, queuePool, doctor, now) {
  const status = normalizeStatus(booking.status);
  const dateKey = getIndiaDateKey(getBookingDate(booking));
  const todayKey = getIndiaDateKey(now);
  const currentMinutes = getIndiaMinutes(now);

  const activeBookings = queuePool
    .filter(
      (item) =>
        isActive(item.status) &&
        getIndiaDateKey(getBookingDate(item)) === dateKey &&
        sameDoctorAndClinic(item, booking)
    )
    .sort(compareBookings);

  const timeline = [];
  let previousEndMinutes = null;

  for (const item of activeBookings) {
    const itemBaseMinutes = getScheduledBaseMinutes(
      item,
      doctor
    );

    let startMinutes =
      itemBaseMinutes ??
      previousEndMinutes ??
      currentMinutes ??
      0;

    // If a patient is currently being served, estimate their
    // remaining queue time from the current time.
    if (
      isServing(item.status) &&
      dateKey === todayKey &&
      currentMinutes !== null
    ) {
      startMinutes = Math.max(
        startMinutes,
        currentMinutes
      );
    }

    // Every patient starts after the previous patient's
    // estimated finish, unless their own scheduled start is later.
    if (previousEndMinutes !== null) {
      startMinutes = Math.max(
        startMinutes,
        previousEndMinutes
      );
    }

    const itemDuration = getDuration(item, doctor);
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
    (item) =>
      bookingId &&
      item.id === bookingId
  );

  if (ownIndex < 0 && booking.bookingReference) {
    ownIndex = timeline.findIndex(
      (item) =>
        item.booking.bookingReference &&
        String(item.booking.bookingReference) ===
          String(booking.bookingReference)
    );
  }

  const ownTimeline =
    ownIndex >= 0 ? timeline[ownIndex] : null;

  const ownBaseMinutes =
    getScheduledBaseMinutes(booking, doctor);

  let peopleAhead = 0;
  let expectedStartMinutes = ownBaseMinutes;
  let estimatedWaitMinutes = 0;

  if (isActive(status)) {
    if (ownTimeline) {
      peopleAhead = ownIndex;
      expectedStartMinutes = ownTimeline.startMinutes;

      const waitBase =
        ownBaseMinutes ?? ownTimeline.startMinutes;

      estimatedWaitMinutes = Math.max(
        0,
        ownTimeline.startMinutes - waitBase
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

  if (
    dateKey &&
    expectedStartMinutes !== null &&
    expectedStartMinutes !== undefined
  ) {
    if (isServing(status) && dateKey === todayKey) {
      expectedTurnAt = now;
    } else {
      expectedTurnAt = makeIndiaDate(
        dateKey,
        expectedStartMinutes
      );
    }
  }

  return {
    peopleAhead,
    estimatedWaitMinutes,
    expectedTurnAt,
    duration: getDuration(booking, doctor),
    startMinutes: expectedStartMinutes,
  };
}


function serializeBooking(booking, clinic, doctor, queueInfo) {
  const expectedTurnAt =
    queueInfo.expectedTurnAt ??
    booking.expectedTurnAt ??
    booking.queue?.expectedTurnAt ??
    null;

  const latitude =
    booking.latitude ??
    booking.lat ??
    booking.location?.latitude ??
    booking.location?.lat ??
    clinic?.latitude ??
    clinic?.lat ??
    clinic?.location?.latitude ??
    clinic?.location?.lat ??
    null;

  const longitude =
    booking.longitude ??
    booking.lng ??
    booking.location?.longitude ??
    booking.location?.lng ??
    clinic?.longitude ??
    clinic?.lng ??
    clinic?.location?.longitude ??
    clinic?.location?.lng ??
    null;

  return {
    ...booking,

    _id: booking._id ? String(booking._id) : null,

    clinicId:
      getClinicId(booking) || String(clinic?._id || ""),

    doctorId:
      getDoctorId(booking) ||
      String(doctor?._id || doctor?.id || ""),

    clinicName:
      booking.clinicName ||
      clinic?.name ||
      clinic?.clinicName ||
      booking.clinic?.name ||
      "Clinic",

    doctorName:
      booking.doctorName ||
      doctor?.name ||
      doctor?.doctorName ||
      booking.doctor?.name ||
      "Doctor",

    lat:
      latitude !== null && latitude !== ""
        ? Number(latitude)
        : null,

    lng:
      longitude !== null && longitude !== ""
        ? Number(longitude)
        : null,

    status: normalizeStatus(booking.status),

    peopleAhead: queueInfo.peopleAhead,
    estimatedWaitMinutes: queueInfo.estimatedWaitMinutes,
    duration: queueInfo.duration,
    expectedTurnAt,

    queue: {
      ...(booking.queue || {}),
      peopleAhead: queueInfo.peopleAhead,
      estimatedWaitMinutes: queueInfo.estimatedWaitMinutes,
      expectedTurnAt,
      duration: queueInfo.duration,
      startMinutes: queueInfo.startMinutes,
    },
  };
}

function buildUserQuery(token) {
  const clauses = [];

  const tokenId = String(token.id || token.sub || "").trim();
  const subject = String(token.sub || "").trim();
  const email = String(token.email || "").trim().toLowerCase();

  for (const id of new Set([tokenId, subject].filter(Boolean))) {
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

function getDoctorFromClinic(clinic, doctorId) {
  if (!clinic || !doctorId) return null;

  for (const key of ["doctors", "doctorList", "staff"]) {
    const list = Array.isArray(clinic[key]) ? clinic[key] : [];

    const doctor = list.find(
      (item) =>
        String(item?._id || item?.id || item?.doctorId || "") ===
        String(doctorId)
    );

    if (doctor) return doctor;
  }

  return null;
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
      console.error(
        "GET /api/my-bookings: AUTH_SECRET or NEXTAUTH_SECRET is not configured."
      );

      return NextResponse.json(
        {
          success: false,
          message: "Authentication configuration is missing.",
        },
        { status: 500 }
      );
    }

    // FIX: Pass the request using the req property.
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
      console.error(
        "GET /api/my-bookings: MONGODB environment variable is missing."
      );

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
    const usersCollection = db.collection("users");
    const clinicsCollection = db.collection("clinics");

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

    const email = String(token.email || "").trim().toLowerCase();
    const tokenId = String(token.id || token.sub || "").trim();

    const userLookupClauses = [];

    if (
      tokenId &&
      ObjectId.isValid(tokenId) &&
      tokenId.length === 24
    ) {
      userLookupClauses.push({
        _id: new ObjectId(tokenId),
      });
    }

    if (email) {
      userLookupClauses.push({
        email: {
          $regex: `^${escapeRegex(email)}$`,
          $options: "i",
        },
      });
    }

    const [bookingDocuments, userDocument] = await Promise.all([
      bookingsCollection.find({ $or: userQuery }).toArray(),

      userLookupClauses.length
        ? usersCollection.findOne({ $or: userLookupClauses })
        : Promise.resolve(null),
    ]);

    const embeddedBookings = Array.isArray(userDocument?.bookings)
      ? userDocument.bookings
          .filter(
            (booking) =>
              booking &&
              typeof booking === "object" &&
              !Array.isArray(booking)
          )
          .map((booking) => ({
            ...booking,
            userId:
              booking.userId ||
              userDocument._id?.toString() ||
              tokenId,
            email:
              booking.email ||
              booking.userEmail ||
              userDocument.email ||
              email,
          }))
      : [];

    const userBookings = deduplicateBookings([
      ...bookingDocuments,
      ...embeddedBookings,
    ]);

    if (!userBookings.length) {
      return NextResponse.json({
        success: true,
        bookings: [],
        total: 0,
      });
    }

    const clinics = await clinicsCollection.find({}).toArray();

    const clinicById = new Map();
    const doctorByPair = new Map();

    for (const clinic of clinics) {
      if (!clinic?._id) continue;

      const clinicId = String(clinic._id);
      clinicById.set(clinicId, clinic);

      const doctors = [
        ...(Array.isArray(clinic.doctors) ? clinic.doctors : []),
        ...(Array.isArray(clinic.doctorList) ? clinic.doctorList : []),
        ...(Array.isArray(clinic.staff) ? clinic.staff : []),
      ];

      for (const doctor of doctors) {
        if (!doctor || typeof doctor !== "object") continue;

        const doctorId = String(
          doctor._id || doctor.id || doctor.doctorId || ""
        );

        if (doctorId) {
          doctorByPair.set(`${clinicId}|${doctorId}`, doctor);
        }
      }
    }

    const clinicDoctorPairs = new Map();

    for (const booking of userBookings) {
      const clinicId = getClinicId(booking);
      const doctorId = getDoctorId(booking);

      if (clinicId && doctorId) {
        clinicDoctorPairs.set(`${clinicId}|${doctorId}`, {
          clinicId,
          doctorId,
        });
      }
    }

    const queueConditions = [];

    for (const { clinicId, doctorId } of clinicDoctorPairs.values()) {
      const clinicCandidates = new Set();
      const doctorCandidates = new Set();

      addIdCandidates(clinicCandidates, clinicId);
      addIdCandidates(doctorCandidates, doctorId);

      queueConditions.push({
        clinicId: { $in: [...clinicCandidates] },
        doctorId: { $in: [...doctorCandidates] },
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
          .find({ $or: queueConditions })
          .toArray()
      : [];

    const queuePool = deduplicateBookings([
      ...otherQueueBookings,
      ...userBookings,
    ]);

    const now = new Date();

    const result = userBookings.map((booking) => {
      const clinicId = getClinicId(booking);
      const doctorId = getDoctorId(booking);

      const clinic =
        clinicById.get(clinicId) ||
        booking.clinic ||
        null;

      const doctor =
        doctorByPair.get(`${clinicId}|${doctorId}`) ||
        getDoctorFromClinic(clinic, doctorId) ||
        booking.doctor ||
        null;

      const queueInfo = calculateQueueInfo(
        booking,
        queuePool,
        doctor,
        now
      );

      return serializeBooking(
        booking,
        clinic,
        doctor,
        queueInfo
      );
    });

    result.sort((a, b) => {
      const dateA = getIndiaDateKey(getBookingDate(a)) || "";
      const dateB = getIndiaDateKey(getBookingDate(b)) || "";

      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }

      return getSequence(a) - getSequence(b);
    });

    return NextResponse.json({
      success: true,
      bookings: result,
      total: result.length,
    });
  } catch (error) {
    console.error("GET /api/my-bookings error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch bookings.",
        error:
          process.env.NODE_ENV === "development"
            ? error?.stack || error?.message || String(error)
            : undefined,
      },
      { status: 500 }
    );
  }
}
