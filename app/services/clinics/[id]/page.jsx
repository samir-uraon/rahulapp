"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import Header from "@/components/Header";
import GoUpButton from "@/components/GoUpButton";

import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  MapPin,
  Navigation,
  ShieldCheck,
  Star,
  Stethoscope,
  X,
  Clock,
  Users,
  AlertCircle,
  Palmtree,
  ArrowUpRight,
} from "lucide-react";

async function calculateDistance(lat1, lng1, lat2, lng2) {
  const coordinates = [lat1, lng1, lat2, lng2].map(Number);

  if (
    coordinates.some((value) => !Number.isFinite(value)) ||
    Math.abs(coordinates[0]) > 90 ||
    Math.abs(coordinates[2]) > 90 ||
    Math.abs(coordinates[1]) > 180 ||
    Math.abs(coordinates[3]) > 180
  ) {
    return null;
  }

  const [latitude1, longitude1, latitude2, longitude2] = coordinates;

  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${longitude1},${latitude1};${longitude2},${latitude2}` +
      `?overview=false`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Routing request failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.code !== "Ok" || !data.routes?.length) {
      return null;
    }

    const route = data.routes[0];

    return {
      distance: Number((route.distance / 1000).toFixed(2)),
      duration: Math.ceil(route.duration / 60),
    };
  } catch (error) {
    console.error("Road distance error:", error);
    return null;
  }
}

 

function getDoctorId(doctor) {
  return String(doctor?._id || doctor?.id || "");
}

function getScheduleForDay(schedule, day) {
  if (!schedule || !day) return null;

  const normalizedDay = String(day).toLowerCase();

  const matchingKey = Object.keys(schedule).find(
    (key) => key.toLowerCase() === normalizedDay
  );

  return matchingKey ? schedule[matchingKey] : null;
}

function getBookingDoctorId(booking) {
  const value =
    booking?.doctorId ??
    booking?.doctor?._id ??
    booking?.doctor?.id ??
    booking?.doctor?._id?.toString?.();

  return value == null ? "" : String(value);
}

function getBookingSlot(booking) {
  return booking?.slot || booking?.selectedSlot || {};
}

 

 function getIndiaDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );
}

function getTodayKey(date = new Date()) {
  return getIndiaDateParts(date).weekday.toLowerCase();
}

function getLocalDateKey(date = new Date()) {
  const parts = getIndiaDateParts(date);

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getIndiaDateTime(dateString, minutes) {
  if (!dateString || minutes == null) return null;

  const [year, month, day] = dateString.split("-").map(Number);

  if (
    !year ||
    !month ||
    !day ||
    !Number.isFinite(minutes)
  ) {
    return null;
  }

  // India is UTC +05:30.
  const timestamp =
    Date.UTC(year, month - 1, day, 0, minutes) -
    330 * 60 * 1000;

  const result = new Date(timestamp);

  return Number.isNaN(result.getTime()) ? null : result;
}

function getSlotStartDate(dateString, slot) {
  const startMinutes = parseTime(
    slot?.checkupStartTime || slot?.open
  );

  return startMinutes === null
    ? null
    : getIndiaDateTime(dateString, startMinutes);
}

function getSlotCloseDate(dateString, slot) {
  const closeMinutes = parseTime(slot?.close);

  return closeMinutes === null
    ? null
    : getIndiaDateTime(dateString, closeMinutes);
}

function getIndiaMinutes(date = new Date()) {
  const parts = getIndiaDateParts(date);

  return Number(parts.hour) * 60 + Number(parts.minute);
}

function getBookingDateKey(booking) {
  if (!booking?.date) return "";

  const value = String(booking.date);

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return getLocalDateKey(parsed);
}

function parseTime(time) {
  if (time == null || time === "") return null;

  const value = String(time).trim().toUpperCase();

  const match = value.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(AM|PM)?$/);

  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const period = match[3];

  if (minute < 0 || minute > 59) return null;

  if (period) {
    if (hour < 1 || hour > 12) return null;

    if (period === "AM" && hour === 12) hour = 0;
    if (period === "PM" && hour !== 12) hour += 12;
  } else if (hour < 0 || hour > 23) {
    return null;
  }

  return hour * 60 + minute;
}

function formatSlotTime(time) {
  const minutes = parseTime(time);

  if (minutes == null) return String(time || "");

  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;

  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${
    hour >= 12 ? "PM" : "AM"
  }`;
}

function getSlotKey(slot) {
  if (!slot) return "";

  return `${slot.open || ""}-${slot.close || ""}`;
}

function normalizeSessionSlot(value) {
  if (!value) return "";

  const parts = String(value).split("-");

  if (parts.length !== 2) return "";

  const open = parseTime(parts[0]);
  const close = parseTime(parts[1]);

  if (open === null || close === null) return "";

  return `${open}-${close}`;
}

function getMatchingSession(doctor, slot) {
  const sessions = Array.isArray(doctor?.sessions)
    ? doctor.sessions
    : [];

  const slotKey = normalizeSessionSlot(
    `${slot?.open || ""}-${slot?.close || ""}`
  );

  if (!slotKey) return null;

  return (
    sessions.find((session) => {
      const sessionKey =
        normalizeSessionSlot(session.sessionId) ||
        normalizeSessionSlot(
          `${session.slotOpen || ""}-${session.slotClose || ""}`
        );

      return sessionKey === slotKey;
    }) || null
  );
}

function getSlotSessionState(doctor, slot) {
  const session = getMatchingSession(doctor, slot);

  if (!session) {
    return {
      session: null,
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
    session.isSessionClosed === true ||
    closedStatuses.includes(status)
  ) {
    return {
      session,
      isSessionActive: false,
      isSessionClosed: true,
      sessionState:
        status === "expired" || session.sessionState === "expired"
          ? "expired"
          : "closed",
    };
  }

  if (status === "active" || session.isSessionActive === true) {
    const expiresAt = session.expiresAt
      ? new Date(session.expiresAt).getTime()
      : null;

    if (
      expiresAt !== null &&
      Number.isFinite(expiresAt) &&
      expiresAt <= Date.now()
    ) {
      return {
        session,
        isSessionActive: false,
        isSessionClosed: true,
        sessionState: "expired",
      };
    }

    return {
      session,
      isSessionActive: true,
      isSessionClosed: false,
      sessionState: "active",
    };
  }

  return {
    session,
    isSessionActive: false,
    isSessionClosed: false,
    sessionState: session.sessionState || status || "not-started",
  };
}

function getPriorityRank(booking) {
  const priority = String(booking?.priority || "").toLowerCase();
  const patientType = String(
    booking?.patient?.type || booking?.patientType || ""
  ).toLowerCase();

  if (priority === "emergency" || patientType === "emergency") {
    return 0;
  }

  if (priority === "elderly" || patientType === "elderly") {
    return 1;
  }

  return 2;
}

function getCreatedAt(booking) {
  const value = booking?.createdAt || booking?.bookedAt;

  if (!value) return 0;

  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getSequence(booking) {
  if (
    booking?.sequence === null ||
    booking?.sequence === undefined ||
    booking?.sequence === ""
  ) {
    return null;
  }

  const sequence = Number(booking.sequence);

  return Number.isFinite(sequence) ? sequence : null;
}

function sortQueue(bookings) {
  return [...bookings].sort((a, b) => {
    const priorityDifference =
      getPriorityRank(a) - getPriorityRank(b);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    const sequenceA = getSequence(a);
    const sequenceB = getSequence(b);

    if (
      sequenceA !== null &&
      sequenceB !== null &&
      sequenceA !== sequenceB
    ) {
      return sequenceA - sequenceB;
    }

    if ((sequenceA !== null) !== (sequenceB !== null)) {
      return sequenceA !== null ? -1 : 1;
    }

    return getCreatedAt(a) - getCreatedAt(b);
  });
}

function isActiveBooking(booking) {
  const status = String(booking?.status || "").toLowerCase();

  return [
    "waiting",
    "confirmed",
    "booked",
    "pending",
    "serving",
    "in-progress",
    "in_progress",
    "in progress",
  ].includes(status);
}

function getBookingStatus(booking) {
  return String(booking?.status || "").toLowerCase();
}

function getBookingsForSlot(doctor, dateKey, slot) {
  if (!Array.isArray(doctor?.bookings) || !slot) return [];

  const doctorId = getDoctorId(doctor);
  const slotKey = getSlotKey(slot);

  return doctor.bookings.filter((booking) => {
    if (getBookingDateKey(booking) !== dateKey) {
      return false;
    }

    if (!isActiveBooking(booking)) {
      return false;
    }

    const bookingDoctorId = getBookingDoctorId(booking);

    if (bookingDoctorId && bookingDoctorId !== doctorId) {
      return false;
    }

    return getSlotKey(getBookingSlot(booking)) === slotKey;
  });
}



function calculateSlotQueue(doctor, slot, date) {
  const dateKey = getLocalDateKey(date);

  const bookings = getBookingsForSlot(
    doctor,
    dateKey,
    slot
  );

  const sessionState = getSlotSessionState(doctor, slot);

  const servingBookings = bookings
    .filter((booking) =>
      [
        "serving",
        "in-progress",
        "in_progress",
        "in progress",
      ].includes(getBookingStatus(booking))
    )
    .sort((a, b) => getCreatedAt(a) - getCreatedAt(b));

  const waitingBookings = sortQueue(
    bookings.filter((booking) =>
      [
        "waiting",
        "confirmed",
        "booked",
        "pending",
      ].includes(getBookingStatus(booking))
    )
  );

  const serving = servingBookings[0] || null;

  const queue = [
    ...servingBookings,
    ...waitingBookings,
  ];

  const capacity = Math.max(
    0,
    Number(slot?.capacity ?? doctor?.capacity) || 0
  );

  const completed = (doctor?.bookings || []).filter((booking) => {
    return (
      getBookingDateKey(booking) === dateKey &&
      getSlotKey(getBookingSlot(booking)) === getSlotKey(slot) &&
      getBookingStatus(booking) === "completed"
    );
  }).length;

  const closeDate = getSlotCloseDate(dateKey, slot);

  const isTimeFinished = closeDate
    ? date.getTime() >= closeDate.getTime()
    : false;

  // A slot is unavailable if it was explicitly closed,
  // expired, or its scheduled closing time has passed.
  const isFinished =
    sessionState.isSessionClosed || isTimeFinished;

  const waiting = waitingBookings.length;

  const duration = Math.max(
    1,
    Number(doctor?.duration) || 20
  );

  return {
    total: bookings.length,
    capacity,

    peopleAhead: waiting,
    waiting,

    serving,
    completed,
    queue,

    servingIndex: serving ? 0 : -1,
    isStarted: Boolean(serving),
    isFinished,

    isSessionClosed: sessionState.isSessionClosed,
    isSessionActive: sessionState.isSessionActive,
    sessionState: sessionState.sessionState,
    session: sessionState.session,

    nextPatient: waitingBookings[0] || null,

    estimatedWait: waiting * duration,
    expectedTurn: null,
  };
}

function getDoctorStatus(doctor, now = new Date()) {
  if (doctor?.isOnHolidayToday) {
    return {
      isOpen: false,
      text: "On Holiday Today",
      currentSlot: null,
      nextSlot: null,
      isOnHoliday: true,
    };
  }

  const schedule = doctor?.schedule || {};
  const today = getTodayKey(now);
  const todaySchedule = getScheduleForDay(schedule, today);

  if (
    !todaySchedule?.active ||
    !Array.isArray(todaySchedule.slots) ||
    todaySchedule.slots.length === 0
  ) {
    return {
      isOpen: false,
      text: "Closed Today",
      currentSlot: null,
      nextSlot: null,
      isOnHoliday: false,
    };
  }

  const currentMinutes = getIndiaMinutes(now);

  const slots = todaySchedule.slots
    .filter((slot) => slot.active !== false)
    .map((slot) => ({
      ...slot,
      ...getSlotSessionState(doctor, slot),
    }))
    .filter(
      (slot) =>
        parseTime(slot.open) !== null &&
        parseTime(slot.close) !== null
    );

  const currentSlot = slots.find((slot) => {
    const open = parseTime(slot.open);
    const close = parseTime(slot.close);

    return (
      !slot.isSessionClosed &&
      open !== null &&
      close !== null &&
      currentMinutes >= open &&
      currentMinutes < close
    );
  });

  if (currentSlot) {
    return {
      isOpen: true,
      text: `Open · Closes ${formatSlotTime(currentSlot.close)}`,
      currentSlot,
      nextSlot: null,
      isOnHoliday: false,
    };
  }

  const nextSlot = slots
    .filter((slot) => {
      const open = parseTime(slot.open);

      return (
        !slot.isSessionClosed &&
        open !== null &&
        open > currentMinutes
      );
    })
    .sort(
      (a, b) => parseTime(a.open) - parseTime(b.open)
    )[0] || null;

  if (nextSlot) {
    return {
      isOpen: false,
      text: `Closed · Opens ${formatSlotTime(nextSlot.open)}`,
      currentSlot: null,
      nextSlot,
      isOnHoliday: false,
    };
  }

  return {
    isOpen: false,
    text: "Closed Today",
    currentSlot: null,
    nextSlot: null,
    isOnHoliday: false,
  };
}

function getScheduleText(schedule) {
  if (!schedule?.active || !schedule?.slots?.length) {
    return "Closed Today";
  }

  return schedule.slots
    .map((slot) => `${formatSlotTime(slot.open)} - ${formatSlotTime(slot.close)}`)
    .join(" / ");
}

function getDoctorFee(value, fallback = 0) {
  const fee = Number(value);

  if (
    value !== null &&
    value !== undefined &&
    value !== "" &&
    Number.isFinite(fee) &&
    fee >= 0
  ) {
    return fee;
  }

  const fallbackFee = Number(fallback);

  return Number.isFinite(fallbackFee) && fallbackFee >= 0 ? fallbackFee : 0;
}

function getSlotLabel(slot, dateString, now, queueInfo, isOnHoliday) {
  if (isOnHoliday) return "Doctor on Holiday";

  if (queueInfo.isSessionClosed) {
    return queueInfo.sessionState === "expired"
      ? "Session expired"
      : "Session closed";
  }

  const closeDate = getSlotCloseDate(dateString, slot);
  const startDate = getSlotStartDate(dateString, slot);

  if (closeDate && now >= closeDate) {
    return "Finished";
  }

  if (
    startDate &&
    closeDate &&
    now >= startDate &&
    now < closeDate
  ) {
    return queueInfo.isSessionActive
      ? "Live session active"
      : "Consultation time";
  }

  return "Upcoming";
}

function YouTubeLoader({ isLoading }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let timer;
    if (isLoading) {
      setProgress(15);
      timer = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 85) return prev;
          return prev + Math.floor(Math.random() * 10) + 5;
        });
      }, 200);
    } else {
      setProgress(100);
      const timeout = setTimeout(() => setProgress(0), 400);
      return () => clearTimeout(timeout);
    }

    return () => clearInterval(timer);
  }, [isLoading]);

  if (progress === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-1 w-full bg-gray-100/50">
      <div
        className="h-full bg-indigo-600 transition-all duration-300 ease-out shadow-[0_0_8px_rgba(79,70,229,0.6)]"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

function getSessionLocation(user) {
  if (!user) return "Select Location";

  const savedLocation = user.location;

  if (typeof savedLocation === "string" && savedLocation.trim()) {
    return savedLocation;
  }

  if (savedLocation && typeof savedLocation === "object") {
    return (
      savedLocation.name ||
      savedLocation.locationName ||
      savedLocation.address ||
      savedLocation.formattedAddress ||
      user.address ||
      user.locationName ||
      "Select Location"
    );
  }

  return (
    user.address ||
    user.locationName ||
    "Select Location"
  );
}

export default function ClinicDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const sessionId = session?.user?.id;

  const clinicId = Array.isArray(params.id) ? params.id[0] : params.id;

  const clinicCacheKey =
    sessionId && clinicId ? `zeric-clinic-${clinicId}-${sessionId}` : null;

  const CLINIC_CACHE_TTL = 20_000;
  const [clinic, setClinic] = useState(null);
  const [loadingClinic, setLoadingClinic] = useState(true);
  const [clinicError, setClinicError] = useState("");
  const [location, setLocation] = useState("Select Location");
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [distance, setDistance] = useState(null);
  const [distanceLoading, setDistanceLoading] = useState(false);

  useEffect(() => {
    if (status === "loading" || !clinicId) return;

    let cancelled = false;
    let inFlight = false;
    let hasDisplayedData = false;

    function readCache() {
      if (!clinicCacheKey) return null;

      try {
        const saved = sessionStorage.getItem(clinicCacheKey);
        if (!saved) return null;

        const parsed = JSON.parse(saved);

        if (
          !parsed.data ||
          typeof parsed.data !== "object" ||
          !Number.isFinite(parsed.cachedAt)
        ) {
          sessionStorage.removeItem(clinicCacheKey);
          return null;
        }

        return parsed;
      } catch (err) {
        console.warn("Unable to read clinic cache:", err);
        return null;
      }
    }

    async function fetchClinic() {
      if (cancelled || inFlight) return;

      inFlight = true;
      setLoadingClinic(true);

      try {
        const response = await fetch(`/api/clinics/${clinicId}`, {
          method: "GET",
          cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));

if (!response.ok) {
  console.error("Clinic API error:", {
    status: response.status,
    response: data,
  });

  throw new Error(
    data.error ||
    data.message ||
    `Failed to fetch clinic details (${response.status})`
  );
}

        if (!data.success || !data.clinic || typeof data.clinic !== "object") {
          throw new Error(data.message || "Invalid clinic response");
        }

        if (cancelled) return;

        setClinic(data.clinic);
        hasDisplayedData = true;
        setClinicError("");

        if (clinicCacheKey) {
          try {
            sessionStorage.setItem(
              clinicCacheKey,
              JSON.stringify({
                data: data.clinic,
                cachedAt: Date.now(),
              })
            );
          } catch (err) {
            console.warn("Unable to save clinic cache:", err);
          }
        }
      } catch (err) {
        console.error("Error fetching clinic:", err);

        if (!cancelled && !hasDisplayedData) {
          setClinicError(err.message || "Unable to load clinic details");
        }
      } finally {
        inFlight = false;

        if (!cancelled) {
          setLoadingClinic(false);
        }
      }
    }

    const cached = readCache();

    if (cached) {
      setClinic(cached.data);
      hasDisplayedData = true;
      setLoadingClinic(false);
    }

    const cacheIsFresh =
      cached && Date.now() - cached.cachedAt < CLINIC_CACHE_TTL;

    if (!cacheIsFresh) {
      fetchClinic();
    }

    const refreshTimer = setInterval(fetchClinic, 20_000);

    return () => {
      cancelled = true;
      clearInterval(refreshTimer);
    };
  }, [status, clinicId, clinicCacheKey]);

  const handleEmergencyBooking = (doctor) => {
    const doctorId = getDoctorId(doctor);
    const currentClinicId = String(clinic?._id || clinic?.id || "");

    if (!doctorId || !currentClinicId) {
      console.error("Missing clinic ID or doctor ID");
      return;
    }

    if (doctor.isEmergency === true) {
      return;
    }

    router.push(
      `/services/clinics/${encodeURIComponent(
        currentClinicId
      )}/emergency?doctor=${encodeURIComponent(doctorId)}`
    );
  };

  useEffect(() => {
    if (status === "loading") return;

    setLocation(getSessionLocation(session?.user));
  }, [
    status,
    session?.user?.location,
    session?.user?.address,
    session?.user?.locationName,
  ]);

  useEffect(() => {
    const updateTime = () => setCurrentTime(new Date());

    updateTime();

    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedDoctor) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedDoctor]);

  const userCoordinates = useMemo(() => {
    const latitude = Number(session?.user?.latitude);
    const longitude = Number(session?.user?.longitude);

    if (
      session?.user?.latitude == null ||
      session?.user?.longitude == null ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return null;
    }

    return { lat: latitude, lng: longitude };
  }, [session?.user?.latitude, session?.user?.longitude]);

  useEffect(() => {
    if (
      !clinic ||
      !userCoordinates ||
      clinic.lat == null ||
      clinic.lng == null
    ) {
      setDistance(null);
      setDistanceLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchRoadDistance() {
      setDistanceLoading(true);
      setDistance(null);

      try {
        const result = await calculateDistance(
          userCoordinates.lat,
          userCoordinates.lng,
          clinic.lat,
          clinic.lng
        );

        if (!cancelled) {
          setDistance(result);
        }
      } catch (err) {
        console.error("Unable to calculate road distance:", err);

        if (!cancelled) {
          setDistance(null);
        }
      } finally {
        if (!cancelled) {
          setDistanceLoading(false);
        }
      }
    }

    fetchRoadDistance();

    return () => {
      cancelled = true;
    };
  }, [
    clinic?.lat,
    clinic?.lng,
    userCoordinates?.lat,
    userCoordinates?.lng,
  ]);

  const today = getTodayKey(currentTime);
  const todayDate = getLocalDateKey(currentTime);

const doctors = useMemo(() => {
  if (!clinic || !Array.isArray(clinic.doctors)) {
    return [];
  }

  return clinic.doctors.map((doctor) => {
    const doctorId = getDoctorId(doctor);

    const normalizedDoctor = {
      ...doctor,
      _id: doctorId,
      id: doctorId,
      name: doctor.name || doctor.fullName || "Doctor",
      profileImage: doctor.profileImage || "",
      schedule: doctor.schedule || {},
      isEmergency: doctor.isEmergency === true,
      isOnHolidayToday: doctor.isOnHolidayToday === true,

      sessions: Array.isArray(doctor.sessions)
        ? doctor.sessions
        : [],

      isSessionActive: doctor.isSessionActive === true,
      activeSession: doctor.activeSession || null,

      holidayDates: Array.isArray(doctor.holidayDates)
        ? doctor.holidayDates
        : [],

      bookings: Array.isArray(doctor.bookings)
        ? doctor.bookings
        : [],
    };

    const todaySchedule = getScheduleForDay(
      normalizedDoctor.schedule,
      today
    );

    const doctorStatus = getDoctorStatus(
      normalizedDoctor,
      currentTime
    );

    const slotQueues =
      todaySchedule?.active &&
      Array.isArray(todaySchedule.slots)
        ? todaySchedule.slots
            .filter((slot) => slot.active !== false)
            .map((slot) => {
              const queueInfo = calculateSlotQueue(
                normalizedDoctor,
                slot,
                currentTime
              );

              const isCurrentSlot =
                doctorStatus.isOpen &&
                doctorStatus.currentSlot?.open === slot.open &&
                doctorStatus.currentSlot?.close === slot.close;

              return {
                slot,
                queueInfo,
                isCurrentSlot,
                isSessionClosed: queueInfo.isSessionClosed,
                isSessionActive: queueInfo.isSessionActive,
                sessionState: queueInfo.sessionState,
                session: queueInfo.session,
              };
            })
        : [];

    const hasActiveSession = normalizedDoctor.sessions.some(
      (session) => session.isSessionActive === true
    );

    return {
      ...normalizedDoctor,
      todaySchedule,
      status: doctorStatus,
      slotQueues,
      hasActiveSession,
    };
  });
}, [clinic, currentTime, today]);

  return (
    <main className="min-h-screen bg-gray-50">
      <YouTubeLoader isLoading={loadingClinic || status === "loading"} />

      <Header showBack={false} />

      {clinicError ? (
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <h1 className="text-xl font-bold text-gray-900">
            Unable to load clinic
          </h1>

          <p className="mt-2 text-sm text-red-600">{clinicError}</p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Try Again
          </button>
        </div>
      ) : !clinic && !loadingClinic ? (
        <div className="mx-auto flex min-h-[70vh] max-w-lg items-center justify-center px-4">
          <div className="w-full rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
              <X className="h-5 w-5 text-red-500" />
            </div>

            <h1 className="mt-4 text-xl font-bold text-gray-900">
              Clinic not found
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              The clinic you are looking for does not exist.
            </p>

            <button
              type="button"
              onClick={() => router.back()}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </button>
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-7">
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-indigo-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Clinics
          </button>

          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="p-4 sm:p-6 lg:p-7">
  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

    {/* Clinic Information */}
    <div className="min-w-0 flex-1">
      {/* Badges */}
      <div className="flex flex-wrap items-center gap-2">
        {clinic?.rating && (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-700">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            {clinic.rating}
          </span>
        )}

        <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-bold text-indigo-700">
          <Users className="h-3.5 w-3.5" />
          {doctors.length} {doctors.length === 1 ? "Doctor" : "Doctors"}
        </span>
      </div>

      {/* Name */}
      <h1 className="mt-4 break-words text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl lg:text-[34px]">
        {clinic?.name || "Loading Clinic..."}
      </h1>

      {/* Information */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">

        {/* Address */}
        <div className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-100">
            <MapPin className="h-4 w-4 text-indigo-600" />
          </div>

          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Clinic Address
            </p>
            <p className="mt-1 break-words text-xs font-semibold leading-relaxed text-slate-700 sm:text-sm">
              {clinic?.address || "Address unavailable"}
            </p>
          </div>
        </div>

        {/* Distance */}
        {(distanceLoading || distance) && (
          <div className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-100">
              <Navigation className="h-4 w-4 text-indigo-600" />
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Distance From You
              </p>

              <p className="mt-1 text-sm font-bold text-slate-800">
                {distanceLoading
                  ? "Calculating..."
                  : distance
                    ? distance.distance < 1
                      ? `${Math.round(distance.distance * 1000)} meters`
                      : `${distance.distance.toFixed(1)} km`
                    : ""}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Directions */}
    {clinic?.lat != null &&
      clinic?.lng != null &&
      Number.isFinite(Number(clinic.lat)) &&
      Number.isFinite(Number(clinic.lng)) && (
        <a
          href={`https://www.google.com/maps?q=${clinic.lat},${clinic.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex w-full shrink-0 items-center justify-center gap-2.5 rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/15 transition-all duration-200 hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-xl active:translate-y-0 sm:w-fit lg:self-center"
        >
          <Navigation className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          Get Directions
          <ArrowUpRight className="h-4 w-4 opacity-70" />
        </a>
      )}
  </div>
</div>

            <div className="border-t border-gray-100 bg-gray-50/70 px-5 py-3.5 sm:px-7">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-gray-400" />

                <span className="text-xs text-gray-400">Your location</span>

                <button
                  type="button"
                  className="truncate text-left text-xs font-semibold text-gray-700 hover:underline"
                  onClick={() => router.push("/profile")}
                >
                  {location.split(",")[0].trim() || "Select Location"}
                </button>
              </div>
            </div>
          </section>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="font-bold text-gray-900">Doctors</h2>

                    <p className="mt-1 text-xs text-gray-500">
                      Choose a doctor and book a consultation
                    </p>
                  </div>

                  <div className="hidden rounded-lg bg-gray-50 px-3 py-2 text-center sm:block">
                    <p className="text-[10px] text-gray-400">Today</p>

                    <p className="text-xs font-bold capitalize text-gray-700">
                      {today}
                    </p>
                  </div>
                </div>
              </div>

              {doctors.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-500">
                  {loadingClinic
                    ? "Retrieving doctor availability..."
                    : "No doctors are currently listed for this clinic."}
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {doctors.map((doctor) => {
                    const todaySchedule = doctor.todaySchedule;
                 
 

                    let buttonText = "Book Consultation";
                  

                    return (
                      <article key={doctor.id} className="p-5 sm:p-6">
                        <div className="flex flex-col gap-5">
                          <div className="flex items-start gap-3">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-indigo-50">
                              {doctor.profileImage ? (
                                <img
                                  src={doctor.profileImage}
                                  alt={doctor.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <Stethoscope className="h-5 w-5 text-indigo-600" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-bold text-gray-900">
                                  {doctor.name}
                                </h3>

                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    doctor.isOnHolidayToday
                                      ? "bg-amber-50 text-amber-700"
                                      : doctor.status.isOpen
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-gray-100 text-gray-500"
                                  }`}
                                >
                                  {doctor.isOnHolidayToday
                                    ? "On Holiday"
                                    : doctor.status.isOpen
                                    ? "Available"
                                    : "Closed"}
                                </span>

                              {doctor.hasActiveSession && (
  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
    Live Session Active
  </span>
)}
                              </div>

                              <p className="mt-1 text-sm text-gray-500">
                                {doctor.specialization || "General consultation"}
                              </p>

                              <div className="mt-2 flex flex-wrap gap-2">
                                {doctor.experience != null && (
                                  <span className="rounded-lg bg-gray-100 px-2.5 py-1 text-[10px] font-semibold text-gray-600">
                                    {doctor.experience} years experience
                                  </span>
                                )}

                                {doctor.duration != null && (
                                  <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold text-indigo-700">
                                    ~{doctor.duration} min appointment
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            {doctor.isOnHolidayToday ? (
                              <div className="flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-xs font-semibold text-amber-800">
                                <Palmtree className="h-4 w-4 shrink-0 text-amber-600" />
                                <span>Doctor is on holiday today.</span>
                              </div>
                            ) : todaySchedule?.active &&
                              todaySchedule?.slots?.length > 0 ? (
                              <div className="space-y-2">
                            {doctor.slotQueues.map(
  (
    {
      slot,
      queueInfo,
      isCurrentSlot,
      isSessionClosed,
      isSessionActive,
      sessionState,
    },
    index
  ) => {
    const isFinished = queueInfo.isFinished;

    const isUnavailable =
      isSessionClosed || isFinished;

    const slotLabel = getSlotLabel(
      slot,
      todayDate,
      currentTime,
      queueInfo,
      doctor.isOnHolidayToday
    );

    return (
      <div
        key={`${slot.open}-${slot.close}-${index}`}
        className={`rounded-xl border p-3.5 ${
          isUnavailable
            ? "border-red-200 bg-red-50/40"
            : isCurrentSlot
              ? "border-emerald-200 bg-emerald-50/40"
              : "border-gray-200 bg-gray-50/50"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-gray-800">
              {formatSlotTime(slot.open)} -{" "}
              {formatSlotTime(slot.close)}
            </span>

            {isUnavailable ? (
              <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider text-red-700">
                {sessionState === "expired" ? "EXPIRED" : "CLOSED"}
              </span>
            ) : isCurrentSlot ? (
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider text-emerald-700">
                NOW
              </span>
            ) : isSessionActive ? (
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider text-blue-700">
                ACTIVE
              </span>
            ) : null}
          </div>

          <span
            className={`shrink-0 text-right text-xs font-bold sm:text-sm ${
              isUnavailable
                ? "text-gray-400"
                : queueInfo.peopleAhead > 0
                  ? "text-orange-600"
                  : "text-emerald-600"
            }`}
          >
            {isUnavailable
              ? "Unavailable"
              : queueInfo.peopleAhead === 0
                ? "No one ahead"
                : `${queueInfo.peopleAhead} ${
                    queueInfo.peopleAhead === 1
                      ? "person"
                      : "people"
                  } ahead`}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200/70 pt-2">
          <span className="text-xs font-medium text-gray-500">
            {slotLabel}
          </span>

          <span className="text-xs font-semibold text-gray-500">
            {queueInfo.total}/{queueInfo.capacity} booked
          </span>
        </div>

        {isCurrentSlot &&
          !isUnavailable &&
          queueInfo.serving && (
            <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
              <Users className="h-3.5 w-3.5" />

              Serving:{" "}
              {getPriorityRank(queueInfo.serving) === 0
                ? "Emergency Patient"
                : queueInfo.serving.patient?.name ||
                  queueInfo.serving.patientName ||
                  "Current patient"}
            </div>
          )}

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span
            className={`inline-flex items-center gap-1 text-xs font-semibold ${
              isUnavailable
                ? "text-red-600"
                : "text-indigo-700"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />

            {isUnavailable
              ? "Slot unavailable"
              : isCurrentSlot
                ? "Slot currently open"
                : "Upcoming slot"}
          </span>

          <div className="flex flex-wrap items-center gap-2">
          

            {!isUnavailable &&
              isCurrentSlot &&
              doctor.status.isOpen &&
              doctor.isEmergency !== true && doctor.isSessionActive &&(
                <button
                  type="button"
                  onClick={() => handleEmergencyBooking(doctor)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-red-700 active:scale-95"
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  Emergency Book
                </button>
              )}
          </div>
        </div>
      </div>
    );
  }
)}
                              </div>
                            ) : (
                              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center text-xs font-medium text-gray-500">
                                Closed Today
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => setSelectedDoctor(doctor)}                             
                              className="min-h-[40px] w-full rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                            >
                              {buttonText}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <aside>
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-4 py-3.5 sm:px-5 sm:py-4">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 shrink-0 text-indigo-600" />

                    <h2 className="text-sm font-bold text-gray-900 sm:text-base">
                      Weekly Schedule
                    </h2>
                  </div>

                  <p className="mt-1 text-[11px] text-gray-500 sm:text-xs">
                    Doctor consultation timings
                  </p>
                </div>

              <div className="space-y-5 p-3 sm:space-y-6 sm:p-4 md:p-5">
  {doctors.length === 0 ? (
    <p className="py-4 text-center text-xs text-gray-500 sm:text-sm">
      No doctor schedules available.
    </p>
  ) : (
    doctors.map((doctor) => (
      <div key={doctor.id} className="min-w-0">
        <p className="mb-2 px-2 text-sm font-bold text-gray-800 sm:text-base">
          {doctor.name}
        </p>

        <div className="space-y-1">
          {[
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday",
          ].map((day) => {
            const schedule = getScheduleForDay(doctor.schedule, day);
            const isToday = day === today;

            return (
              <div
                key={day}
                className={`flex min-w-0 items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors sm:px-4 sm:py-3 ${
                  isToday
                    ? "bg-indigo-50 ring-1 ring-indigo-100"
                    : "hover:bg-gray-100"
                }`}
              >
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`text-xs capitalize sm:text-sm ${
                      isToday
                        ? "font-bold text-indigo-700"
                        : "font-medium text-gray-600"
                    }`}
                  >
                    {day}
                  </span>

                  {isToday && (
                    <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-700 sm:text-[10px]">
                      Today
                    </span>
                  )}
                </div>

                <div
                  className={`min-w-0 text-right text-[11px] leading-5 sm:text-xs md:text-sm ${
                    schedule?.active && schedule?.slots?.length > 0
                      ? "font-medium text-gray-700"
                      : "text-gray-400"
                  }`}
                >
                  {schedule?.active && schedule?.slots?.length > 0 ? (
                    <div className="space-y-0.5">
                      {schedule.slots.map((slot, index) => (
                        <div
                          key={`${slot.open}-${slot.close}-${index}`}
                          className="break-words"
                        >
                          {formatSlotTime(slot.open)} -{" "}
                          {formatSlotTime(slot.close)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span>Closed</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ))
  )}
</div>
              </div>

              <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  </div>

                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      Consultation only
                    </p>

                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      Select a doctor to continue with your consultation booking.
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}

      <GoUpButton />

      {selectedDoctor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-black/50 p-3 backdrop-blur-sm sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedDoctor(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-modal-title"
            className="relative my-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[90dvh]"
          >
            {/* Header */}
            <div className="z-10 flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-4 py-3 sm:px-5 sm:py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                  Zeric
                </p>

                <h2
                  id="booking-modal-title"
                  className="mt-1 text-lg font-bold text-gray-900"
                >
                  Book Consultation
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDoctor(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200"
                aria-label="Close booking dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4 scrollbar-thin sm:px-5 sm:py-5">
              <div className="space-y-4">
                <div className="rounded-xl bg-indigo-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white">
                      <Stethoscope className="h-5 w-5 text-indigo-600" />
                    </div>

                    <div className="min-w-0">
                      <p className="break-words font-bold text-gray-900">
                        {selectedDoctor.name}
                      </p>

                      <p className="mt-0.5 break-words text-xs text-gray-500">
                        {selectedDoctor.specialization ||
                          "General consultation"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="text-sm text-gray-500">Appointment</span>
                    <span className="text-right text-sm font-bold text-gray-900">
                      Consultation
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="text-sm text-gray-500">
                      Consultation Fee
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      ₹{getDoctorFee(selectedDoctor.fee)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="text-sm text-gray-500">
                      Booking Charge
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      ₹
                      {getDoctorFee(
                        selectedDoctor.bookingCharge,
                        selectedDoctor.fee
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 bg-indigo-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-indigo-900">
                        Pay Now
                      </p>
                      <p className="text-xs text-indigo-600">
                        Booking charge only
                      </p>
                    </div>

                    <span className="text-lg font-extrabold text-indigo-700">
                      ₹
                      {getDoctorFee(
                        selectedDoctor.bookingCharge,
                        selectedDoctor.fee
                      )}
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-3 px-4 py-3">
                    <span className="text-xs text-gray-500">Today's timing</span>
                    <span className="max-w-[60%] text-right text-xs font-semibold text-gray-700">
                      {getScheduleText(selectedDoctor.schedule?.[today])}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl bg-gray-50 p-4">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

                  <p className="text-xs leading-5 text-gray-600">
                    Pay the booking charge to reserve your token. The
                    consultation fee is separate and can be paid at the clinic.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const doctorId = getDoctorId(selectedDoctor);
                    const currentClinicId = String(
                      clinic._id || clinic.id || ""
                    );

                    if (!doctorId || !currentClinicId) {
                      console.error("Missing clinic ID or doctor ID");
                      return;
                    }

                    setSelectedDoctor(null);

                    router.push(
                      `/services/clinics/${encodeURIComponent(
                        currentClinicId
                      )}/book?doctor=${encodeURIComponent(doctorId)}`
                    );
                  }}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-indigo-700 active:scale-[0.99]"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>
                    Continue Booking · ₹
                    {getDoctorFee(
                      selectedDoctor.bookingCharge,
                      selectedDoctor.fee
                    )}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedDoctor(null)}
                  className="min-h-10 w-full py-2 text-sm font-medium text-gray-500 transition hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}