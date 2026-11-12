"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "react-hot-toast";

import Header from "@/components/Header";
import GoUpButton from "@/components/GoUpButton";

import {
  CalendarDays,
  Clock,
  MapPin,
  User,
  Ticket,
  RefreshCw,
  Stethoscope,
  AlertCircle,
  Users,
  CreditCard,
  ArrowRight,
  Navigation,
  XCircle,
  Calendar,
  Check,
  CheckCircle2,
} from "lucide-react";
import EnableNotifications from "@/components/EnableNotifications";

const INDIA_TIME_ZONE = "Asia/Kolkata";
const TWO_HOURS = 2 * 60 * 60 * 1000;
const BOOKINGS_CACHE_TTL = 30_000;
const REFRESH_INTERVAL = 20_000;

const HISTORY_STATUSES = [
  "completed",
  "cancelled",
  "skipped",
  "refunded",
  "failed",
  "rejected",
];

const bookingsCache = new Map();
const bookingsRequests = new Map();

/* ----------------------------------
    DATE HELPERS
---------------------------------- */

function parseDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "object") {
    if (value.$date) return parseDate(value.$date);
    if (typeof value.toDate === "function") {
      return parseDate(value.toDate());
    }
    return null;
  }

  const text = String(value).trim();
  if (!text) return null;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);

    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
    return date;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDateValue(booking) {
  return (
    booking.bookingDate ??
    booking.date ??
    booking.appointmentDate ??
    booking.appointment?.date ??
    booking.appointment?.appointmentDate ??
    null
  );
}

function getIndiaDateKey(value) {
  if (!value) return null;

  if (typeof value === "string") {
    const text = value.trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);

    if (match) {
      const [, y, m, d] = match;
      const year = Number(y);
      const month = Number(m);
      const day = Number(d);
      const check = new Date(year, month - 1, day);

      if (
        check.getFullYear() !== year ||
        check.getMonth() !== month - 1 ||
        check.getDate() !== day
      ) {
        return null;
      }
      return `${y}-${m}-${d}`;
    }
  }

  const date = parseDate(value);
  if (!date) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const getPart = (type) => parts.find((part) => part.type === type)?.value;
  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");

  return year && month && day ? `${year}-${month}-${day}` : null;
}

function getTodayDateKey() {
  return getIndiaDateKey(new Date());
}

function formatDate(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    const [year, month, day] = value.trim().split("-").map(Number);
    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return "Date not available";
    }

    return date.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  const date = parseDate(value);

  if (!date || Number.isNaN(date.getTime())) {
    return "Date not available";
  }

  return date.toLocaleDateString("en-IN", {
    timeZone: INDIA_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getBookedAtValue(booking) {
  return (
    booking.rescheduledAt ||
    booking.createdAt ||
    booking.updatedAt ||
    booking.updated_at ||
    booking.bookedAt ||
    booking.bookingCreatedAt ||
    booking.created_at ||
    booking.payment?.updatedAt ||
    booking.payment?.createdAt ||
    booking.payment?.paidAt ||
    null
  );
}

function formatDateTime(value) {
  if (!value) return "Booking time unavailable";

  const date = parseDate(value);

  if (!date || Number.isNaN(date.getTime())) {
    return "Booking time unavailable";
  }

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function getCancellationWindowInfo(booking) {
  const bookedAt = parseDate(getBookedAtValue(booking));
  const cancelledAt = parseDate(
    booking.cancelledAt ||
      booking.canceledAt ||
      booking.cancellation?.cancelledAt ||
      booking.cancellation?.canceledAt
  );

  const actor = getCancellationActor(booking);

  if (actor === "doctor" || booking.byDoctor) {
    return {
      available: true,
      withinTwoHours: true,
      message: "Rescheduled/Cancelled by Doctor. Eligible for full refund.",
    };
  }

  if (!bookedAt || !cancelledAt) {
    return {
      available: false,
      withinTwoHours: null,
      message: "Cancellation timing unavailable",
    };
  }

  const elapsedMs = cancelledAt.getTime() - bookedAt.getTime();
  if (elapsedMs < 0) {
    return {
      available: false,
      withinTwoHours: null,
      message: "Cancellation timing could not be verified",
    };
  }

  const withinTwoHours = elapsedMs <= TWO_HOURS;
  const totalMinutes = Math.floor(elapsedMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const elapsedLabel =
    hours > 0 ? `${hours} hr ${minutes} min` : `${minutes} min`;

  return {
    available: true,
    withinTwoHours,
    elapsedLabel,
    message: withinTwoHours
      ? `Cancelled within 2 hours of booking (${elapsedLabel} after booking).`
      : `Cancelled after 2 hours (${elapsedLabel} after booking).`,
  };
}

function getCancellationEligibilityInfo(booking, now = Date.now()) {
  if (isDoctorPendingAction(booking)) {
    return {
      available: true,
      refundable: true,
      remainingHours: 0,
      remainingMinutes: 0,
      message:
        "Action initiated by Doctor/Pending status. You are eligible for a full refund or a free reschedule.",
    };
  }

  const bookedAt = parseDate(getBookedAtValue(booking));
  if (!bookedAt) {
    return {
      available: false,
      refundable: null,
      remainingHours: 0,
      remainingMinutes: 0,
      message: "Refund eligibility will be verified by the server.",
    };
  }

  const bookedAtMs = bookedAt.getTime();
  if (!Number.isFinite(bookedAtMs) || !Number.isFinite(now)) {
    return {
      available: false,
      refundable: null,
      remainingHours: 0,
      remainingMinutes: 0,
      message: "Booking time could not be verified.",
    };
  }

  const elapsedMs = Math.max(0, now - bookedAtMs);
  const refundable = elapsedMs <= TWO_HOURS;

  if (refundable) {
    const remainingMs = Math.max(0, TWO_HOURS - elapsedMs);
    const totalRemainingMinutes = Math.floor(remainingMs / 60_000);
    const remainingHours = Math.floor(totalRemainingMinutes / 60);
    const remainingMinutes = totalRemainingMinutes % 60;
    const remainingTimeLabel =
      remainingHours > 0
        ? `${remainingHours} hr ${remainingMinutes} min`
        : `${remainingMinutes} min`;

    return {
      available: true,
      refundable: true,
      remainingHours,
      remainingMinutes,
      message: `Eligible for a refund if cancelled now. ${remainingTimeLabel} remain in the 2-hour refund window.`,
    };
  }

  return {
    available: true,
    refundable: false,
    remainingHours: 0,
    remainingMinutes: 0,
    message:
      "The 2-hour refund window has expired. You can still cancel, but no refund will be provided.",
  };
}

/* ----------------------------------
    TIME HELPERS
---------------------------------- */

function parseTimeForQueue(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value >= 0 && value < 1440 ? Math.floor(value) : null;
  }

  const text = String(value).trim();
  const match = /^(\d{1,2})(?::(\d{1,2}))?(?::\d{2})?\s*(AM|PM)?$/i.exec(text);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const period = match[3]?.toUpperCase();

  if (minutes > 59) return null;

  if (period) {
    if (hours < 1 || hours > 12) return null;
    hours %= 12;
    if (period === "PM") hours += 12;
  } else if (hours > 23) {
    return null;
  }

  return hours * 60 + minutes;
}

function getIndiaMinutes(value = new Date()) {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return null;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: INDIA_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const hours = Number(parts.find((part) => part.type === "hour")?.value);
  const minutes = Number(parts.find((part) => part.type === "minute")?.value);

  return hours * 60 + minutes;
}

function formatTime(value) {
  if (value === null || value === undefined || value === "") return "";

  if (value instanceof Date || typeof value === "object") {
    const date = parseDate(value);
    if (!date) return "";

    return date.toLocaleTimeString("en-IN", {
      timeZone: INDIA_TIME_ZONE,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  const text = String(value).trim();
  if (!text) return "";

  const minutes = parseTimeForQueue(text);
  if (minutes !== null) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const period = hours >= 12 ? "PM" : "AM";

    return `${hours % 12 || 12}:${String(mins).padStart(2, "0")} ${period}`;
  }

  const date = parseDate(text);
  if (date && (text.includes("T") || text.endsWith("Z"))) {
    return date.toLocaleTimeString("en-IN", {
      timeZone: INDIA_TIME_ZONE,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  return text;
}

/* ----------------------------------
    BOOKING HELPERS
---------------------------------- */

function getSlot(booking) {
  return (
    booking.slot ||
    booking.selectedSlot ||
    booking.appointment?.slot ||
    {}
  );
}

function getSlotStartValue(booking) {
  const slot = getSlot(booking);
  if (typeof slot === "string") {
    return slot.split(/\s+-\s+/)[0] || "";
  }
  return (
    slot.open ||
    slot.start ||
    slot.startTime ||
    slot.from ||
    slot.time ||
    ""
  );
}

function getBookingTimeValue(booking) {
  const slot = getSlot(booking);
  return (
    booking.bookingTime ||
    booking.bookTime ||
    booking.time ||
    booking.appointmentTime ||
    booking.appointment?.time ||
    getSlotStartValue(booking) ||
    ""
  );
}

function getCheckupStartValue(booking) {
  const slot = getSlot(booking);
  return (
    booking.checkupStartTime ||
    booking.appointment?.checkupStartTime ||
    (typeof slot === "object" ? slot.checkupStartTime : null) ||
    (typeof slot === "object" ? slot.scheduledTime : null) ||
    booking.scheduledTime ||
    null
  );
}

function getPeopleAhead(booking) {
  const value = booking.peopleAhead ?? booking.queue?.peopleAhead;
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : null;
}

function getDuration(booking) {
  const value =
    booking.duration ??
    booking.doctorDuration ??
    booking.consultationDuration ??
    booking.queue?.duration;

  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function normalizeStatus(status) {
  const value = String(status || "waiting")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-")
    .replaceAll(" ", "-");

  const aliases = {
    wait: "waiting",
    pending: "pending",
    booked: "confirmed",
    success: "confirmed",
    paid: "confirmed",
    complete: "completed",
    canceled: "cancelled",
    inprogress: "in-progress",
    "no-show": "skipped",
    "no-showed": "skipped",
  };

  return aliases[value] || value;
}

function isDoctorPendingAction(booking) {
  return (
    normalizeStatus(booking?.status) === "pending" &&
    (booking?.byDoctor === true || booking?.bydoctor === true)
  );
}

function canCancelBooking(booking) {
  const status = normalizeStatus(booking.status);
  if (isDoctorPendingAction(booking)) return true;

  const blockedStatuses = [
    "completed",
    "cancelled",
    "skipped",
    "refunded",
    "failed",
    "rejected",
    "serving",
    "in-progress",
    "your-turn",
    "cancellation-processing",
    "pending",
  ];

  return !blockedStatuses.includes(status);
}

function shouldMarkCompleted(booking) {
  return normalizeStatus(booking.status) === "completed";
}

function getDisplayStatus(booking) {
  return normalizeStatus(booking.status);
}

function getCancellationActor(booking) {
  const actor = normalizeStatus(
    booking?.cancelledBy || booking?.cancellationBy || ""
  );
  const reason = String(booking?.cancellationReason || "").toLowerCase();

  if (
    booking?.byDoctor === true ||
    booking?.bydoctor === true ||
    actor === "doctor" ||
    actor === "staff" ||
    reason.includes("doctor")
  ) {
    return "doctor";
  }

  if (
    ["patient", "user", "owner"].includes(actor) ||
    reason.includes("patient") ||
    reason.includes("user")
  ) {
    return "patient";
  }

  return "";
}

function getCancellationLabel(booking) {
  const actor = getCancellationActor(booking);

  if (actor === "doctor" || booking?.byDoctor || booking?.bydoctor) {
    return "Cancelled by Doctor";
  }
  if (actor === "patient") {
    return "Cancelled by You";
  }

  return "Cancelled";
}

function getCancellationDescription(booking) {
  const actor = getCancellationActor(booking);

  if (actor === "doctor" || booking?.byDoctor || booking?.bydoctor) {
    return "The doctor modified or cancelled this session. You are eligible for a free reschedule or full refund.";
  }

  if (actor === "patient") {
    return "You cancelled this appointment.";
  }

  return booking?.cancellationReason || "This appointment was cancelled.";
}

function isHistoryStatus(status) {
  return HISTORY_STATUSES.includes(normalizeStatus(status));
}

function isActiveStatus(status) {
  return !isHistoryStatus(status);
}

function getActualArrivalTime(booking) {
  const teamSession = booking.teamSession || booking.session || {};
  return (
    teamSession.startedAt ||
    teamSession.startTime ||
    teamSession.sessionStartedAt ||
    teamSession.checkupStartTime ||
    booking.sessionStartedAt ||
    booking.arrivalTime ||
    booking.queue?.arrivalTime ||
    booking.actualStartTime ||
    booking.actualCheckupTime ||
    booking.actualTime ||
    null
  );
}

function getSessionStartDisplay(booking) {
  const sessionCreatedAt = booking?.sessionCreatedAt;
  const sessionStartedAt = booking?.sessionStartedAt;

  if (sessionStartedAt) {
    return {
      label: `Doctor started at ${formatTime(sessionStartedAt)}`,
      started: true,
      sessionCreatedAt,
      sessionStartedAt,
    };
  }

  if (sessionCreatedAt) {
    return {
      label: `Session created at ${formatTime(sessionCreatedAt)}`,
      started: false,
      sessionCreatedAt,
      sessionStartedAt: null,
    };
  }

  return {
    label: "Session time unavailable",
    started: false,
    sessionCreatedAt: null,
    sessionStartedAt: null,
  };
}

function getBookingSortTime(booking) {
  return (
    parseTimeForQueue(
      getCheckupStartValue(booking) || getBookingTimeValue(booking)
    ) ?? Number.MAX_SAFE_INTEGER
  );
}

function getBookingSortDate(booking) {
  const key = getIndiaDateKey(getDateValue(booking));
  return key ? Number(key.replaceAll("-", "")) : Number.MAX_SAFE_INTEGER;
}

function getPriorityRank(booking) {
  const priority = String(booking.priority || "normal")
    .trim()
    .toLowerCase();

  const priorityRanks = {
    emergency: 1,
    pending: 2,
    normal: 3,
  };

  return priorityRanks[priority] ?? 3;
}

function sortBookings(bookings) {
  return [...bookings].sort((a, b) => {
    // 1. Priority ranking: Emergency > Pending > Normal
    const priorityDifference =
      getPriorityRank(a) - getPriorityRank(b);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    // 2. Appointment date
    const dateDifference =
      getBookingSortDate(a) - getBookingSortDate(b);

    if (dateDifference !== 0) {
      return dateDifference;
    }

    // 3. Appointment time
    const timeDifference =
      getBookingSortTime(a) - getBookingSortTime(b);

    if (timeDifference !== 0) {
      return timeDifference;
    }

    // 4. Booking creation time
    const aCreated = parseDate(a.createdAt)?.getTime() || 0;
    const bCreated = parseDate(b.createdAt)?.getTime() || 0;

    return aCreated - bCreated;
  });
}

function getSlotTimes(booking) {
  const slot = getSlot(booking);
  const start = getBookingTimeValue(booking);

  if (typeof slot === "string") {
    const parts = slot.split(/\s+-\s+/);
    return {
      start: formatTime(start || parts[0] || ""),
      end: formatTime(parts[1] || ""),
    };
  }

  const end =
    booking.checkupEndTime ||
    booking.appointment?.checkupEndTime ||
    slot.checkupEndTime ||
    slot.close ||
    slot.end ||
    slot.endTime ||
    slot.to ||
    booking.endTime ||
    "";

  return {
    start: formatTime(start),
    end: formatTime(end),
  };
}

function getPaymentAmount(booking) {
  const rawVal = booking.paymentAmount ?? booking.originalPaymentAmount ?? booking.amount;
  if (rawVal === undefined || rawVal === null || rawVal === "") return null;

  const numericVal = Number(rawVal) / 100;
  if (!Number.isFinite(numericVal) || numericVal < 0) return null;

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: booking.currency || "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numericVal);
}

function getClinicCoordinates(booking) {
  const lat =
    booking.lat ??
    booking.latitude ??
    booking.location?.lat ??
    booking.location?.latitude ??
    booking.clinic?.lat ??
    booking.clinic?.latitude ??
    booking.clinic?.location?.lat ??
    booking.clinic?.location?.latitude ??
    null;

  const lng =
    booking.lng ??
    booking.longitude ??
    booking.location?.lng ??
    booking.location?.longitude ??
    booking.clinic?.lng ??
    booking.clinic?.longitude ??
    booking.clinic?.location?.lng ??
    booking.clinic?.location?.latitude ??
    null;

  const hasCoordinates =
    lat !== null &&
    lat !== undefined &&
    lat !== "" &&
    lng !== null &&
    lng !== undefined &&
    lng !== "" &&
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lng)) &&
    Number(lat) >= -90 &&
    Number(lat) <= 90 &&
    Number(lng) >= -180 &&
    Number(lng) <= 180;

  return {
    lat: hasCoordinates ? Number(lat) : null,
    lng: hasCoordinates ? Number(lng) : null,
    hasCoordinates,
  };
}

function getGoogleMapsUrl(booking, lat, lng, hasCoordinates, address) {
  if (hasCoordinates) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  if (address) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      address
    )}`;
  }
  const clinicName = booking.clinicName || booking.clinic?.name || "";
  if (clinicName) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      clinicName
    )}`;
  }

  return null;
}

function getBookingsCacheKey(session) {
  const userId = session?.user?.id;
  const email = session?.user?.email?.trim().toLowerCase();
  const identity = userId || email;

  return identity ? `my-bookings:${identity}` : null;
}

function getCachedBookings(key) {
  if (!key) return null;

  const cached = bookingsCache.get(key);
  if (!cached) return null;

  if (Date.now() > cached.expiresAt) {
    bookingsCache.delete(key);
    return null;
  }

  return cached.bookings;
}

function setCachedBookings(key, bookings) {
  if (!key) return;

  bookingsCache.set(key, {
    bookings,
    expiresAt: Date.now() + BOOKINGS_CACHE_TTL,
  });
}

function StatusBadge({ status, peopleAhead, booking }) {
  const normalized = normalizeStatus(status);

  const styles = {
    pending: "bg-amber-100 text-amber-800 border border-amber-300",
    waiting: "bg-amber-100 text-amber-800",
    confirmed: "bg-green-100 text-green-800",
    completed: "bg-blue-100 text-blue-800",
    cancelled: "bg-red-100 text-red-800",
    "in-progress": "bg-purple-100 text-purple-800",
    serving: "bg-purple-100 text-purple-800",
    "your-turn": "bg-indigo-100 text-indigo-800",
    skipped: "bg-gray-100 text-gray-700",
    refunded: "bg-gray-100 text-gray-700",
    failed: "bg-red-100 text-red-800",
    rejected: "bg-red-100 text-red-800",
  };

  const labels = {
    pending: "Pending",
    waiting:
      peopleAhead !== null && peopleAhead !== undefined
        ? Number(peopleAhead) === 0
          ? "Your turn"
          : `${peopleAhead} ${
              Number(peopleAhead) === 1 ? "person" : "people"
            } ahead`
        : "Waiting",
    confirmed: "Confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
    "in-progress": "In Progress",
    serving: "In Progress",
    "your-turn": "Your Turn",
    skipped: "No-show",
    refunded: "Refunded",
    failed: "Failed",
    rejected: "Rejected",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
        styles[normalized] || "bg-gray-100 text-gray-700"
      }`}
    >
      {normalized === "cancelled"
        ? getCancellationLabel(booking)
        : labels[normalized] || normalized.replaceAll("-", " ")}
    </span>
  );
}


function RescheduleModal({ booking, onClose, onConfirm, loading }) {
  const [appointmentDate, setAppointmentDate] = useState("");
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedDoctorSchedule, setSelectedDoctorSchedule] = useState(null);
  const [availableTimes, setAvailableTimes] = useState([]);

  const [loadingDates, setLoadingDates] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(false);

  const [datesError, setDatesError] = useState("");
  const [bookingsError, setBookingsError] = useState("");

  const [dateRefreshKey, setDateRefreshKey] = useState(0);
  const [bookingRefreshKey, setBookingRefreshKey] = useState(0);

  const [selectedSlot, setSelectedSlot] = useState(null);

  const bookingId = String(
    booking?._id || booking?.id || ""
  );

  const doctorId = String(
    booking?.doctorId ||
      booking?.doctor?._id ||
      (typeof booking?.doctor === "string"
        ? booking.doctor
        : "")
  );

  const doctorName =
    booking?.doctorName ||
    booking?.doctor?.name ||
    "the Doctor";

  // --------------------------------------------------
  // SLOT IDENTIFICATION
  // --------------------------------------------------

  const getSlotIdentifier = (slot) => {
    if (!slot) return "";

    return String(
      slot.slotId ||
        slot.id ||
        (slot.open && slot.close
          ? `${slot.open}-${slot.close}`
          : slot.label || "")
    ).trim().toLowerCase();
  };

  const formatSlot = (slot) => {
    if (slot?.label) return slot.label;

    if (slot?.open && slot?.close) {
      return `${formatTime(slot.open)} - ${formatTime(slot.close)}`;
    }

    return slot?.time
      ? formatTime(slot.time)
      : "Available Slot";
  };

  // --------------------------------------------------
  // LOAD AVAILABLE DATES
  // --------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadDates() {
      if (!doctorId) {
        setAvailableDates([]);
        setAppointmentDate("");
        setLoadingDates(false);
        setDatesError("Doctor information is unavailable.");
        return;
      }

      setLoadingDates(true);
      setDatesError("");
      setAvailableDates([]);
      setAppointmentDate("");

      setSelectedSlot(null);
      setSelectedDoctorSchedule(null);
      setAvailableTimes([]);

      try {
        const params = new URLSearchParams();

        if (bookingId) {
          params.set("excludeBookingId", bookingId);
        }

        const response = await fetch(
          `/api/${encodeURIComponent(doctorId)}/slots?${params.toString()}`,
          {
            cache: "no-store",
            signal: controller.signal,
            headers: {
              Accept: "application/json",
            },
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Unable to load doctor schedule."
          );
        }

        if (cancelled) return;

        const dates = Array.isArray(data.availableDates)
          ? data.availableDates
          : [];

        setAvailableDates(dates);

        const firstAvailable = dates.find(
          (item) =>
            item?.value &&
            !item.isClosed &&
            !item.isHoliday
        );

        setAppointmentDate(
          firstAvailable?.value || ""
        );

        if (!firstAvailable) {
          setDatesError(
            "No appointment dates are currently available."
          );
        }
      } catch (error) {
        if (cancelled || error.name === "AbortError") {
          return;
        }

        setDatesError(
          error.message || "Unable to load doctor schedule."
        );

        toast.error(
          error.message || "Unable to load doctor schedule."
        );
      } finally {
        if (!cancelled) {
          setLoadingDates(false);
        }
      }
    }

    loadDates();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [doctorId, bookingId, dateRefreshKey]);

  // --------------------------------------------------
  // LOAD SLOTS FOR SELECTED DATE
  // --------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadSchedule() {
      if (!appointmentDate || !doctorId) {
        setSelectedDoctorSchedule(null);
        setAvailableTimes([]);
        setSelectedSlot(null);
        setLoadingBookings(false);
        return;
      }

      setLoadingBookings(true);
      setBookingsError("");

      // Never retain slots from the previous date.
      setSelectedSlot(null);
      setSelectedDoctorSchedule(null);
      setAvailableTimes([]);

      try {
        const params = new URLSearchParams({
          date: appointmentDate,
        });

        if (bookingId) {
          params.set("excludeBookingId", bookingId);
        }

        const response = await fetch(
          `/api/${encodeURIComponent(doctorId)}/slots?${params.toString()}`,
          {
            cache: "no-store",
            signal: controller.signal,
            headers: {
              Accept: "application/json",
            },
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message ||
              "Unable to verify appointment availability."
          );
        }

        if (cancelled) return;

        const schedule =
          data.selectedDoctorSchedule || {};

        const times = Array.isArray(data.availableTimes)
          ? data.availableTimes
          : Array.isArray(schedule.slots)
          ? schedule.slots
          : [];

        setSelectedDoctorSchedule(schedule);

        // Do not display slots if the date is inactive.
        if (
          schedule.active !== true ||
          schedule.isHoliday === true
        ) {
          setAvailableTimes([]);
          setSelectedSlot(null);
        } else {
          setAvailableTimes(times);
        }
      } catch (error) {
        if (cancelled || error.name === "AbortError") {
          return;
        }

        setBookingsError(
          error.message ||
            "Availability could not be verified."
        );

        setAvailableTimes([]);
        setSelectedDoctorSchedule(null);
        setSelectedSlot(null);
      } finally {
        if (!cancelled) {
          setLoadingBookings(false);
        }
      }
    }

    loadSchedule();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    appointmentDate,
    doctorId,
    bookingId,
    bookingRefreshKey,
  ]);

  // --------------------------------------------------
  // SELECTED DATE INFORMATION
  // --------------------------------------------------

  const selectedDateInfo = availableDates.find(
    (item) => item.value === appointmentDate
  );

  // --------------------------------------------------
  // VALIDATE SELECTED SLOT AGAINST LATEST RESPONSE
  // --------------------------------------------------

  const latestSelectedSlot = selectedSlot
    ? availableTimes.find(
        (slot) =>
          getSlotIdentifier(slot) ===
          getSlotIdentifier(selectedSlot)
      )
    : null;

  const isSlotSelectable = (slot) => {
    return (
      slot &&
      slot.configured !== false &&
      slot.isFull !== true &&
      Number(slot.capacity) > 0 &&
      Number(slot.remaining) > 0
    );
  };

  const canConfirm =
    Boolean(appointmentDate) &&
    Boolean(latestSelectedSlot) &&
    isSlotSelectable(latestSelectedSlot) &&
    selectedDoctorSchedule?.active === true &&
    !selectedDoctorSchedule?.isHoliday &&
    !loadingDates &&
    !loadingBookings &&
    !bookingsError &&
    !loading;

  // --------------------------------------------------
  // DATE CHANGE
  // --------------------------------------------------

  const handleDateChange = (event) => {
    const nextDate = event.target.value;

    const dateInfo = availableDates.find(
      (item) => item.value === nextDate
    );

    if (
      !dateInfo ||
      dateInfo.isClosed ||
      dateInfo.isHoliday
    ) {
      return;
    }

    setAppointmentDate(nextDate);

    // Clear old date selection immediately.
    setSelectedSlot(null);
    setSelectedDoctorSchedule(null);
    setAvailableTimes([]);
    setBookingsError("");
  };

  // --------------------------------------------------
  // SLOT SELECTION
  // --------------------------------------------------

  const handleSlotSelect = (slot) => {
    if (
      !isSlotSelectable(slot) ||
      loadingBookings ||
      !selectedDoctorSchedule?.active
    ) {
      return;
    }

    setSelectedSlot(slot);
  };

  // --------------------------------------------------
  // RETRY
  // --------------------------------------------------

  const retryDates = () => {
    setDatesError("");
    setDateRefreshKey((key) => key + 1);
  };

  const retryBookings = () => {
    setBookingsError("");
    setBookingRefreshKey((key) => key + 1);
  };

  // --------------------------------------------------
  // CONFIRM RESCHEDULE
  // --------------------------------------------------

  const handleConfirm = () => {
    if (!appointmentDate) {
      toast.error("Please select an appointment date.");
      return;
    }

    if (loadingBookings || loadingDates) {
      toast.error("Please wait while availability is verified.");
      return;
    }

    if (bookingsError) {
      toast.error("Please verify availability again.");
      return;
    }

    if (!latestSelectedSlot) {
      toast.error(
        "Your selected slot is no longer available. Please select again."
      );

      setSelectedSlot(null);
      return;
    }

    if (!isSlotSelectable(latestSelectedSlot)) {
      toast.error(
        "This appointment slot is no longer available."
      );

      setSelectedSlot(null);
      return;
    }

    if (
      selectedDoctorSchedule?.active !== true ||
      selectedDoctorSchedule?.isHoliday
    ) {
      toast.error(
        "Doctor is unavailable on the selected date."
      );
      return;
    }

    // Pass the latest API slot, not stale selected state.
    onConfirm(
      appointmentDate,
      latestSelectedSlot
    );
  };

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto scrollbar-thin bg-slate-950/60 p-3 backdrop-blur-md sm:p-5">
      <div className="my-auto flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/60 bg-white shadow-2xl">

        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 px-6 py-5">
          <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-16 right-24 h-32 w-32 rounded-full bg-violet-300/20 blur-2xl" />

          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/15 text-white shadow-inner">
                <CalendarDays size={23} />
              </div>

              <div>
                <h3 className="text-lg font-bold tracking-tight text-white">
                  Reschedule Appointment
                </h3>
                <p className="mt-0.5 text-xs text-indigo-100">
                  Choose your preferred date and time
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20 disabled:opacity-50"
            >
              <XCircle size={21} />
            </button>
          </div>

          <div className="relative mt-4 flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5">
            <Clock size={15} className="shrink-0 text-indigo-100" />
            <p className="text-xs text-white">
              Rescheduling with{" "}
              <span className="font-bold">{doctorName}</span>
            </p>
            <span className="ml-auto shrink-0 rounded-lg bg-emerald-400/20 px-2 py-1 text-[10px] font-bold text-emerald-100">
              NO EXTRA CHARGE
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">

          {/* Date selection */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-gray-900">
                  Select Appointment Date
                </h4>
                <p className="mt-1 text-xs text-gray-500">
                  Choose a date from the doctor's schedule.
                </p>
              </div>

              <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
                <CalendarDays size={19} />
              </div>
            </div>

            {loadingDates ? (
              <div className="animate-pulse rounded-2xl border border-gray-200 p-4">
                <div className="h-3 w-28 rounded bg-gray-200" />
                <div className="mt-3 h-11 rounded-xl bg-gray-100" />
              </div>
            ) : datesError && availableDates.length === 0 ? (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-center">
                <p className="text-sm font-semibold text-red-700">
                  Unable to load appointment dates
                </p>
                <p className="mt-1 text-xs text-red-500">
                  {datesError}
                </p>
                <button
                  type="button"
                  onClick={retryDates}
                  className="mt-3 text-xs font-bold text-red-700 underline"
                >
                  Retry
                </button>
              </div>
            ) : availableDates.length > 0 ? (
              <div className="relative">
                <select
                  value={appointmentDate}
                  onChange={handleDateChange}
                  className="w-full appearance-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 pr-11 text-sm font-semibold text-gray-800 outline-none transition hover:border-indigo-300 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                >
                  <option value="" disabled>
                    Select appointment date
                  </option>

                  {availableDates.map((date) => (
                    <option
                      key={date.value}
                      value={date.value}
                      disabled={
                        date.isClosed || date.isHoliday
                      }
                    >
                      {date.label} ({date.weekday})
                      {date.isHoliday
                        ? " — Holiday"
                        : date.isClosed
                        ? " — Closed"
                        : ""}
                    </option>
                  ))}
                </select>

                <CalendarDays
                  size={18}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-indigo-500"
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-center">
                <CalendarDays className="mx-auto text-amber-500" size={25} />
                <p className="mt-2 text-sm font-semibold text-amber-800">
                  No appointment dates available
                </p>
                <p className="mt-1 text-xs text-amber-600">
                  Please check again later.
                </p>
              </div>
            )}

            {bookingsError && appointmentDate && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50 p-3">
                <p className="text-xs text-red-600">
                  {bookingsError}
                </p>
                <button
                  type="button"
                  onClick={retryBookings}
                  className="shrink-0 text-xs font-bold text-red-700 underline"
                >
                  Retry
                </button>
              </div>
            )}

            {selectedDateInfo && (
              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm">
                  <CalendarDays size={19} />
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-bold text-indigo-900">
                    {formatDate(appointmentDate)}
                  </p>
                  <p className="mt-0.5 text-xs text-indigo-600">
                    {selectedDateInfo.isHoliday
                      ? "Doctor is on holiday"
                      : selectedDateInfo.isClosed
                      ? "Doctor is unavailable"
                      : "Scheduled appointment date"}
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Time selection */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-gray-900">
                  Select Appointment Time
                </h4>
                <p className="mt-1 text-xs text-gray-500">
                  Choose an available consultation session.
                </p>
              </div>

              <div className="rounded-xl bg-violet-50 p-2 text-violet-600">
                <Clock size={19} />
              </div>
            </div>

            {!appointmentDate ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-7 text-center">
                <CalendarDays className="mx-auto text-gray-400" size={27} />
                <p className="mt-2 text-sm font-semibold text-gray-600">
                  Select a date first
                </p>
              </div>
            ) : selectedDateInfo?.isHoliday ||
              selectedDoctorSchedule?.isHoliday ? (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-7 text-center">
                <CalendarDays className="mx-auto text-red-400" size={27} />
                <p className="mt-2 text-sm font-bold text-red-700">
                  Doctor is on Holiday
                </p>
                <p className="mt-1 text-xs text-red-500">
                  Please select another appointment date.
                </p>
              </div>
            ) : loadingBookings ? (
              <div className="grid grid-cols-2 gap-3">
                {[1, 2].map((item) => (
                  <div
                    key={item}
                    className="animate-pulse rounded-2xl border border-gray-200 p-4"
                  >
                    <div className="h-3 w-24 rounded bg-gray-200" />
                    <div className="mt-3 h-3 w-16 rounded bg-gray-100" />
                  </div>
                ))}
              </div>
            ) : bookingsError ? (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-center">
                <p className="text-sm font-semibold text-red-700">
                  Unable to verify availability
                </p>
                <button
                  type="button"
                  onClick={retryBookings}
                  className="mt-2 text-xs font-bold text-red-700 underline"
                >
                  Try again
                </button>
              </div>
            ) : selectedDoctorSchedule?.active !== true ||
              availableTimes.length === 0 ? (
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-7 text-center">
                <Clock className="mx-auto text-amber-500" size={27} />
                <p className="mt-2 text-sm font-bold text-amber-800">
                  No Available Sessions
                </p>
                <p className="mt-1 text-xs text-amber-600">
                  No active consultation sessions or available slots for this date.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {availableTimes.map((slot, index) => {
                  const slotId = getSlotIdentifier(slot);

                  const isSelected =
                    getSlotIdentifier(selectedSlot) === slotId &&
                    Boolean(selectedSlot);

                  const disabled =
                    !isSlotSelectable(slot);

                  return (
                    <button
                      key={slotId || index}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleSlotSelect(slot)}
                      className={`group relative rounded-2xl border p-4 text-left transition-all duration-200 ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-100 ring-2 ring-indigo-100"
                          : disabled
                          ? "cursor-not-allowed border-gray-200 bg-gray-100 opacity-60"
                          : "border-gray-200 bg-white hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`rounded-xl p-2 ${
                              isSelected
                                ? "bg-indigo-600 text-white"
                                : "bg-indigo-50 text-indigo-600"
                            }`}
                          >
                            <Clock size={17} />
                          </div>

                          <div>
                            <p className="text-sm font-bold text-gray-900">
                              {formatSlot(slot)}
                            </p>
                            <p className="mt-1 text-[11px] text-gray-500">
                              Consultation session
                            </p>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white">
                            <Check size={12} />
                          </div>
                        )}
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                        <span className="text-[11px] text-gray-500">
                          {slot.checkupStartTime
                            ? `Starts ${slot.checkupStartTime}`
                            : "Start time not specified"}
                        </span>

                        <span
                          className={`text-[11px] font-bold ${
                            disabled
                              ? "text-red-500"
                              : isSelected
                              ? "text-indigo-700"
                              : "text-emerald-600"
                          }`}
                        >
                          {slot.configured === false ||
                          Number(slot.capacity) <= 0
                            ? "Not configured"
                            : slot.isFull
                            ? "Full"
                            : `${slot.remaining} left`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Selected appointment summary */}
          {latestSelectedSlot && (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600" />
                <p className="text-sm font-bold text-emerald-800">
                  Appointment Selected
                </p>
              </div>

              <p className="mt-2 text-xs text-emerald-700">
                {formatDate(appointmentDate)} ·{" "}
                {formatSlot(latestSelectedSlot)}
              </p>

              {latestSelectedSlot.checkupStartTime && (
                <p className="mt-1 text-xs text-emerald-700">
                  Consultation starts at{" "}
                  {latestSelectedSlot.checkupStartTime}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 bg-white px-5 py-4 sm:px-6">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={!canConfirm}
              onClick={handleConfirm}
              className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <RefreshCw size={15} className="animate-spin" />
                  Processing...
                </span>
              ) : (
                "Confirm Reschedule"
              )}
            </button>
          </div>

          <p className="mt-3 text-center text-[10px] text-gray-400">
            Your rescheduled appointment will be confirmed after verification.
          </p>
        </div>
      </div>
    </div>
  );
}


function BookingCard({ booking, now, onCancel, cancelling, onRescheduleClick }) {
  const { start, end } = getSlotTimes(booking);

  const patient =
    booking.patient && typeof booking.patient === "object"
      ? booking.patient
      : {};

  const patientName =
    patient.name || booking.patientName || booking.name || "Not specified";
  const patientType = patient.type || booking.patientType || "self";
  const patientAge = patient.age ?? booking.age;
  const patientGender = patient.gender || booking.gender;

  const serviceName =
    booking.serviceName ||
    booking.doctorName ||
    booking.service ||
    "Consultation";

  const clinicName =
    booking.clinicName ||
    booking.clinic?.name ||
    booking.clinic?.clinicName ||
    "";

  const { lat, lng, hasCoordinates } = getClinicCoordinates(booking);
  const doctorName = booking.doctorName || booking.doctor?.name || "";

  const address =
    booking.address ||
    booking.clinicAddress ||
    booking.clinic?.address ||
    booking.clinic?.clinicAddress ||
    booking.clinic?.location?.address ||
    "";

  const mapsUrl = getGoogleMapsUrl(
    booking,
    lat,
    lng,
    hasCoordinates,
    address
  );

  const status = getDisplayStatus(booking);
  const peopleAhead = getPeopleAhead(booking);
  const sessionInfo = getSessionStartDisplay(booking, now);
  const duration = getDuration(booking);
  const paymentAmount = getPaymentAmount(booking);

const isEmergency =
  String(booking.priority || "").trim().toLowerCase() === "emergency";

const canShowQueue =
  !isEmergency &&
  [
    "waiting",
    "confirmed",
    "in-progress",
    "serving",
    "your-turn",
  ].includes(status);

  const token =
    booking.tokenNumber ||
    booking.token ||
    booking.bookingReference ||
    "N/A";

  const refundStatus = String(
    booking.refundStatus ||
      booking.payment?.refundStatus ||
      (booking.paymentStatus === "refunded" ? "completed" : "") ||
      ""
  )
    .trim()
    .toLowerCase();

  const formattedRefundAmount = useMemo(() => {
    const rawVal =
      booking.refundAmount ??
      booking.payment?.refundAmount ??
      booking.paymentAmount ??
      booking.originalPaymentAmount ??
      booking.amount;

    if (rawVal === undefined || rawVal === null || rawVal === "") return null;
    const numericVal = Number(rawVal) / 100;
    if (!Number.isFinite(numericVal) || numericVal < 0) return null;

    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: booking.currency || "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(numericVal);
  }, [
    booking.refundAmount,
    booking.payment?.refundAmount,
    booking.paymentAmount,
    booking.originalPaymentAmount,
    booking.amount,
    booking.currency,
  ]);

  const showRefundCard =
    booking.status?.toLowerCase() === "cancelled" &&
    (Boolean(refundStatus) ||
      booking.paymentStatus === "refunded" ||
      booking.refundAmount !== undefined ||
      Boolean(booking.refundId));

  const bookingId = booking._id || booking.id;
  const isPendingDoctorAction = isDoctorPendingAction(booking);
  const cancellationAllowed = canCancelBooking(booking);

  const cancellationEligibility = getCancellationEligibilityInfo(
    booking,
    now
  );

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Ticket size={20} className="shrink-0 text-indigo-600" />
            <h3 className="break-words text-lg font-bold text-gray-900">
              Token {token}
            </h3>
          </div>
          <p className="mt-1 break-words text-sm text-gray-500">
            {serviceName}
          </p>
          {doctorName && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-700">
              <Stethoscope size={15} className="shrink-0 text-indigo-500" />
              {doctorName}
            </p>
          )}
          {booking.bookingReference && (
            <p className="mt-1 break-all text-xs text-gray-400">
              Ref: {booking.bookingReference}
            </p>
          )}
        </div>

        <StatusBadge
          status={status}
          peopleAhead={peopleAhead}
          booking={booking}
        />
      </div>

      {isPendingDoctorAction && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="shrink-0 text-amber-700" />
            <p className="text-sm font-bold text-amber-900">
              Action Required from Doctor
            </p>
          </div>
          <p className="mt-1 text-xs text-amber-800">
            The doctor has updated this booking to pending. You are entitled to a full refund or a free reschedule with this doctor.
          </p>
        </div>
      )}

      {status === "cancelled" && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2">
            <XCircle size={17} className="shrink-0 text-red-600" />
            <p className="text-sm font-semibold text-red-800">
              {getCancellationLabel(booking)}
            </p>
          </div>
          <p className="mt-1 text-sm text-red-700">
            {getCancellationDescription(booking)}
          </p>
          <div className="mt-3 rounded-lg border border-red-100 bg-white/80 p-3">
            <p className="text-xs font-semibold text-gray-600">
              Booking and cancellation timeline
            </p>
            <p className="mt-1 text-xs text-gray-700">
              Booked on: {formatDateTime(getBookedAtValue(booking))}
            </p>
            <p className="mt-1 text-xs text-gray-700">
              Cancelled on:{" "}
              {formatDateTime(
                booking.cancelledAt ||
                  booking.canceledAt ||
                  booking.cancellation?.cancelledAt ||
                  booking.cancellation?.canceledAt
              )}
            </p>
            {(() => {
              const cancellationWindow = getCancellationWindowInfo(booking);
              return (
                <p
                  className={`mt-2 text-sm font-semibold ${
                    cancellationWindow.withinTwoHours === true
                      ? "text-green-700"
                      : cancellationWindow.withinTwoHours === false
                      ? "text-red-700"
                      : "text-amber-700"
                  }`}
                >
                  {cancellationWindow.message}
                </p>
              );
            })()}
          </div>
        </div>
      )}

      {canShowQueue && (
        <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/70 p-4">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-indigo-600" />
            <h4 className="font-semibold text-gray-900">
              Live queue information
            </h4>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs text-gray-500">People ahead</p>
              <p className="mt-1 text-lg font-bold text-gray-900">
                {peopleAhead === null ? "—" : peopleAhead}
              </p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs text-gray-500">Doctor's Session</p>
              <p
                className={`mt-1 text-lg font-bold ${
                  sessionInfo.started ? "text-green-700" : "text-indigo-700"
                }`}
              >
                {sessionInfo.label}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div className="flex items-start gap-3">
          <Clock size={18} className="mt-0.5 shrink-0 text-indigo-600" />
          <div>
            <p className="text-xs text-gray-500">Booked on</p>
            <p className="mt-1 text-sm font-medium text-gray-800">
              {formatDateTime(getBookedAtValue(booking))}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <CalendarDays size={18} className="mt-0.5 shrink-0 text-indigo-600" />
          <div>
            <p className="text-xs text-gray-500">Appointment date</p>
            <p className="mt-1 text-sm font-medium text-gray-800">
              {formatDate(getDateValue(booking))}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Clock size={18} className="mt-0.5 shrink-0 text-indigo-600" />
          <div>
            <p className="text-xs text-gray-500">Checkup time</p>
            {start && (
              <p className="mt-1 text-sm font-medium text-gray-800">
                {end ? `${start} - ${end}` : start}
              </p>
            )}
            {duration !== null && (
              <p className="mt-1 text-xs text-gray-500">
                Consultation duration: {duration} minutes
              </p>
            )}
          </div>
        </div>

        <div className="flex items-start gap-3">
          <User size={18} className="mt-0.5 shrink-0 text-indigo-600" />
          <div>
            <p className="text-xs text-gray-500">Patient</p>
            <p className="mt-1 break-words text-sm font-medium text-gray-800">
              {patientName}
            </p>
            <p className="text-xs capitalize text-gray-500">
              {patientType}
              {patientAge != null && ` · ${patientAge} years`}
              {patientGender && ` · ${patientGender}`}
            </p>
          </div>
        </div>

        {(clinicName || address || mapsUrl) && (
          <div className="flex items-start gap-3">
            <MapPin size={18} className="mt-0.5 shrink-0 text-indigo-600" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Clinic</p>
              <p className="mt-1 break-words text-sm font-medium text-gray-800">
                {clinicName || "Clinic"}
              </p>
              {address && (
                <p className="mt-1 break-words text-xs text-gray-500">
                  {address}
                </p>
              )}
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 transition hover:text-indigo-800 hover:underline"
                >
                  <Navigation size={11} />
                  Get Directions
                </a>
              )}
            </div>
          </div>
        )}

        {booking.priority && (
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-indigo-600" />
            <div>
              <p className="text-xs text-gray-500">Queue priority</p>
              <p className="mt-1 text-sm font-medium capitalize text-gray-800">
                {booking.priority}
              </p>
            </div>
          </div>
        )}

        {paymentAmount && (
          <div className="flex items-start gap-3">
            <CreditCard size={18} className="mt-0.5 shrink-0 text-indigo-600" />
            <div>
              <p className="text-xs text-gray-500">Payment amount</p>
              <p className="mt-1 text-sm font-semibold text-gray-800">
                {paymentAmount}
              </p>
            </div>
          </div>
        )}
      </div>

      {booking.priority === "emergency" && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          Emergency priority
        </div>
      )}

      {booking.paymentStatus && booking.paymentStatus !== "unknown" && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <span className="text-xs text-gray-500">Payment status: </span>
          <span className="text-xs font-semibold capitalize text-gray-700">
            {booking.paymentStatus}
          </span>
        </div>
      )}

      {showRefundCard && (
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-500">Refund status</p>
          <p className="mt-1 text-sm font-semibold capitalize text-gray-800">
            {refundStatus ? refundStatus.replaceAll("_", " ") : "Completed"}
          </p>
          {formattedRefundAmount && (
            <p className="mt-1 text-xs font-medium text-gray-700">
              Refund amount: {formattedRefundAmount}
            </p>
          )}
          {booking.refundExpectedDays && (
            <p className="mt-1 text-xs text-gray-500">
              Expected time: {booking.refundExpectedDays}
            </p>
          )}
          {booking.refundInitiatedAt && (
            <p className="mt-1 text-xs text-gray-500">
              Initiated: {formatDate(booking.refundInitiatedAt)}
            </p>
          )}
          {booking.refundId && (
            <p className="mt-1 break-all text-xs text-gray-500">
              Refund ID: {booking.refundId}
            </p>
          )}
        </div>
      )}

      {(cancellationAllowed || isPendingDoctorAction) && (
        <div className="mt-5 border-t border-gray-100 pt-4">
          <div
            className={`mb-3 rounded-xl border p-3 ${
              cancellationEligibility.refundable === true
                ? "border-green-200 bg-green-50"
                : cancellationEligibility.refundable === false
                ? "border-amber-200 bg-amber-50"
                : "border-gray-200 bg-gray-50"
            }`}
          >
            <p
              className={`text-sm font-semibold ${
                cancellationEligibility.refundable === true
                  ? "text-green-800"
                  : cancellationEligibility.refundable === false
                  ? "text-amber-800"
                  : "text-gray-700"
              }`}
            >
              {cancellationEligibility.refundable === true
                ? "Refund eligible"
                : cancellationEligibility.refundable === false
                ? "Cancellation without refund"
                : "Refund eligibility"}
            </p>
            <p className="mt-1 text-xs text-gray-700">
              {cancellationEligibility.message}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {isPendingDoctorAction && (
              <button
                type="button"
                onClick={() => onRescheduleClick?.(booking)}
                disabled={cancelling}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
              >
                <Calendar size={16} />
                Reschedule for Free
              </button>
            )}

            <button
              type="button"
              onClick={() => onCancel?.(booking)}
              disabled={cancelling || !bookingId}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <XCircle size={16} />
              {cancelling
                ? "Processing..."
                : isPendingDoctorAction
                ? "Get Refund"
                : "Cancel Booking"}
            </button>
          </div>

          <p className="mt-2 text-xs text-gray-500">
            {isPendingDoctorAction
              ? "Because the doctor initiated this change, you can either select a new slot for free or request a complete refund."
              : "You can cancel before the doctor starts the session. Refund eligibility depends on whether cancellation happens within 2 hours of booking creation."}
          </p>
        </div>
      )}
    </article>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-5 py-12 text-center">
      <Ticket size={36} className="mx-auto text-gray-400" />
      <h3 className="mt-3 font-semibold text-gray-800">{title}</h3>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
      <Link
        href="/"
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
      >
        Book an appointment
        <ArrowRight size={16} />
      </Link>
    </div>
  );
}

export default function MyBookingsPage() {
  const { data: session, status: sessionStatus,update } = useSession();
const user = session?.user;
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [cancellingBookingId, setCancellingBookingId] = useState(null);

  const [rescheduleBooking, setRescheduleBooking] = useState(null);
  const [rescheduling, setRescheduling] = useState(false);

  const mountedRef = useRef(false);
  const userCacheKey = getBookingsCacheKey(session);

  const fetchBookings = useCallback(
    async (isRefresh = false, silent = false) => {
      if (!userCacheKey) return;

      if (!silent) {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
      }

      try {
        setError("");
        let requestPromise = bookingsRequests.get(userCacheKey);

        if (!requestPromise) {
          const promise = fetch("/api/my-bookings", {
            method: "GET",
            cache: "no-store",
            headers: { Accept: "application/json" },
          }).then(async (response) => {
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.success) {
              throw new Error(
                data.message || "Unable to load your bookings."
              );
            }
            return Array.isArray(data.bookings) ? data.bookings : [];
          });

          requestPromise = promise;
          bookingsRequests.set(userCacheKey, promise);

          promise
            .finally(() => {
              if (bookingsRequests.get(userCacheKey) === promise) {
                bookingsRequests.delete(userCacheKey);
              }
            })
            .catch(() => {});
        }

        const freshBookings = await requestPromise;
        if (!mountedRef.current) return;

        setCachedBookings(userCacheKey, freshBookings);
        setBookings(freshBookings);
      } catch (err) {
        if (!mountedRef.current) return;
        setError(
          err?.message || "Something went wrong while loading bookings."
        );
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [userCacheKey]
  );

  const handleConfirmReschedule = async (newDate, newSlot) => {
    if (!rescheduleBooking) return;
    const bookingId = rescheduleBooking._id || rescheduleBooking.id;

    try {
      setRescheduling(true);
      setError("");

      const response = await fetch("/api/my-bookings/reschedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          bookingId: String(bookingId),
          currentBookingId: String(bookingId),
          newDate,
          newSlot,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to reschedule booking.");
      }

      toast.success(
        "Appointment successfully rescheduled! Your booking is active again."
      );
      setRescheduleBooking(null);
      await fetchBookings(true, true);
    } catch (err) {
      const message = err?.message || "Unable to reschedule booking.";
      setError(message);
      toast.error(message);
    } finally {
      setRescheduling(false);
    }
  };

  const handleCancelBooking = useCallback(
    async (booking) => {
      const bookingId = booking?._id || booking?.id;
      if (!bookingId) {
        toast.error("Unable to identify this booking. Please refresh.");
        return;
      }

      if (cancellingBookingId) return;

      if (!canCancelBooking(booking)) {
        toast.error("This booking can no longer be cancelled.");
        return;
      }

      const isDoctorPending = isDoctorPendingAction(booking);
      let confirmed = false;

      if (isDoctorPending) {
        const choice = window.confirm(
          "The doctor has updated this appointment to pending.\n\n" +
            "Click OK to cancel this booking and get a FULL REFUND.\n" +
            "Click CANCEL if you want to reschedule your slot instead."
        );

        if (!choice) {
          setRescheduleBooking(booking);
          return;
        }
        confirmed = true;
      } else {
        const cancellationEligibility = getCancellationEligibilityInfo(
          booking,
          Date.now()
        );

        const refundMessage =
          cancellationEligibility.refundable === true
            ? "Your booking is within the 2-hour refund window. An eligible refund will be initiated."
            : cancellationEligibility.refundable === false
            ? "The 2-hour refund window has expired. You can cancel, but you will not receive a refund."
            : "Refund eligibility will be verified by the server.";

        confirmed = window.confirm(
          "Are you sure you want to cancel this booking?\n\n" +
            refundMessage +
            "\n\nThis action cannot be undone."
        );
      }

      if (!confirmed) return;

      try {
        setCancellingBookingId(String(bookingId));
        setError("");

        const response = await fetch("/api/my-bookings/cancel", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            bookingId: String(bookingId),
            cancelledBy: isDoctorPending ? "doctor" : "patient",
            byDoctor: isDoctorPending || booking.byDoctor,
            cancellationReason: isDoctorPending
              ? "Cancelled by doctor update"
              : "Cancelled by patient",
          }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Unable to cancel this booking."
          );
        }

        const updatedBooking = {
          ...booking,
          ...(data.booking || {}),
          status: "cancelled",
          byDoctor: isDoctorPending || booking.byDoctor,
          cancelledBy: isDoctorPending ? "doctor" : "patient",
          cancellationReason: isDoctorPending
            ? "Cancelled by doctor update"
            : "Cancelled by patient",
          cancelledAt:
            data.booking?.cancelledAt || new Date().toISOString(),
          refundStatus:
            data.booking?.refundStatus ||
            data.refundStatus ||
            booking.refundStatus,
        };

        setBookings((current) => {
          const updated = current.map((item) =>
            String(item._id || item.id) === String(bookingId)
              ? updatedBooking
              : item
          );
          setCachedBookings(userCacheKey, updated);
          return updated;
        });

        bookingsCache.delete(userCacheKey);

        const refundStatus = String(
          data.booking?.refundStatus || data.refundStatus || ""
        ).toLowerCase();

        if (
          isDoctorPending ||
          ["initiated", "processing"].includes(refundStatus)
        ) {
          toast.success(
            "Booking cancelled successfully. Your full refund has been initiated."
          );
        } else if (refundStatus === "completed") {
          toast.success(
            "Booking cancelled successfully. Your refund is completed."
          );
        } else if (["failed", "rejected"].includes(refundStatus)) {
          toast.error(
            "Booking cancelled, but the refund could not be completed. Please check your refund status."
          );
        } else if (
          ["not-eligible", "not_eligible", "not eligible"].includes(
            refundStatus
          )
        ) {
          toast.success(
            "Booking cancelled successfully. No refund is applicable because the 2-hour refund window expired."
          );
        } else {
          toast.success("Booking cancelled successfully.");
        }

        await fetchBookings(true, true);
      } catch (err) {
        const message = err?.message || "Unable to cancel this booking.";
        setError(message);
        toast.error(message);
      } finally {
        setCancellingBookingId(null);
      }
    },
    [cancellingBookingId, fetchBookings, userCacheKey]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (sessionStatus === "loading") return;

    if (!session) {
      setBookings([]);
      setError("");
      setLoading(false);
      return;
    }

    const cached = getCachedBookings(userCacheKey);
    if (cached !== null) {
      setBookings(cached);
      setLoading(false);
    }

    fetchBookings(false, cached !== null);
  }, [session, sessionStatus, userCacheKey, fetchBookings]);

  useEffect(() => {
    if (sessionStatus !== "authenticated" || !session) return;

    const interval = setInterval(() => {
      setNow(Date.now());
      fetchBookings(true, true);
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [session, sessionStatus, fetchBookings]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 10_000);

    return () => clearInterval(interval);
  }, []);

  const sortedBookings = useMemo(() => sortBookings(bookings), [bookings]);

  const todayKey = getTodayDateKey();

  const upcomingBookings = useMemo(() => {
    return sortedBookings.filter((booking) => {
      const dateKey = getIndiaDateKey(getDateValue(booking));
      const status = normalizeStatus(booking.status);

      return (
        dateKey !== null &&
        dateKey >= todayKey &&
        isActiveStatus(status) &&
        !shouldMarkCompleted(booking)
      );
    });
  }, [sortedBookings, todayKey]);

  const pastBookings = useMemo(() => {
    return sortedBookings.filter((booking) => {
      const dateKey = getIndiaDateKey(getDateValue(booking));

      if (isHistoryStatus(booking.status)) return true;
      if (!dateKey) return true;

      return dateKey < todayKey || shouldMarkCompleted(booking);
    });
  }, [sortedBookings, todayKey]);

  if (sessionStatus === "loading" || loading) {
    return (
      <>
        <Header showBack={true} />
        <main className="min-h-screen bg-gray-50 px-4 py-12">
          <div className="mx-auto max-w-5xl animate-pulse">
            <div className="h-8 w-56 rounded bg-gray-200" />
            <div className="mt-3 h-4 w-80 max-w-full rounded bg-gray-200" />
            <div className="mt-8 space-y-4">
              <div className="h-44 rounded-2xl bg-gray-200" />
              <div className="h-44 rounded-2xl bg-gray-200" />
            </div>
          </div>
        </main>
      </>
    );
  }

  if (!session) {
    return (
      <>
        <Header showBack={true} />
        <main className="flex min-h-[70vh] items-center justify-center bg-gray-50 px-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <Ticket size={42} className="mx-auto text-indigo-600" />
            <h1 className="mt-4 text-2xl font-bold text-gray-900">
              Login required
            </h1>
            <p className="mt-2 text-gray-500">
              Please log in to view your bookings.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-700"
            >
              Login
            </Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header showBack={true} />

      <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Bookings</h1>
              <p className="mt-2 text-gray-600">
                View and track your appointments in one place.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
  <EnableNotifications
    webPushEnabled={user?.webPushEnabled === true}
    updateSession={update}
  />

  <button
    type="button"
    onClick={() => fetchBookings(true)}
    disabled={refreshing}
    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
  >
    <RefreshCw
      size={16}
      className={refreshing ? "animate-spin" : ""}
    />
    {refreshing ? "Refreshing..." : "Refresh"}
  </button>
</div>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              <div className="flex items-start gap-2">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <div>
                  <p>{error}</p>
                  <button
                    type="button"
                    onClick={() => fetchBookings()}
                    className="mt-2 inline-flex items-center gap-2 font-semibold underline"
                  >
                    <RefreshCw size={14} />
                    Try again
                  </button>
                </div>
              </div>
            </div>
          )}

          {!error && bookings.length === 0 && (
            <div className="mb-8 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-800">
              You do not have any bookings yet.
            </div>
          )}

          <section className="mb-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                Upcoming bookings
              </h2>
              <span className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-700">
                {upcomingBookings.length}
              </span>
            </div>

            {upcomingBookings.length > 0 ? (
              <div className="space-y-4">
                {upcomingBookings.map((booking, index) => {
                  const id =
                    booking._id ||
                    booking.id ||
                    booking.bookingReference ||
                    index;

                  return (
                    <BookingCard
                      key={id}
                      booking={booking}
                      now={now}
                      onCancel={handleCancelBooking}
                      onRescheduleClick={(b) => setRescheduleBooking(b)}
                      cancelling={
                        cancellingBookingId ===
                        String(booking._id || booking.id)
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="No upcoming bookings"
                description="Your active appointments will appear here."
              />
            )}
          </section>

          <section className="mb-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                Booking history
              </h2>
              <span className="rounded-full bg-gray-200 px-3 py-1 text-sm font-semibold text-gray-700">
                {pastBookings.length}
              </span>
            </div>

            {pastBookings.length > 0 ? (
              <div className="space-y-4">
                {pastBookings.map((booking, index) => {
                  const id =
                    booking._id ||
                    booking.id ||
                    booking.bookingReference ||
                    index;

                  return (
                    <BookingCard
                      key={id}
                      booking={booking}
                      now={now}
                      onCancel={handleCancelBooking}
                      onRescheduleClick={(b) => setRescheduleBooking(b)}
                      cancelling={
                        cancellingBookingId ===
                        String(booking._id || booking.id)
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="No booking history"
                description="Completed and past appointments will appear here."
              />
            )}
          </section>
        </div>
      </main>

      {rescheduleBooking && (
        <RescheduleModal
          booking={rescheduleBooking}
          onClose={() => setRescheduleBooking(null)}
          onConfirm={handleConfirmReschedule}
          loading={rescheduling}
        />
      )}

      <GoUpButton />
    </>
  );
}