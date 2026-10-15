"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
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
} from "lucide-react";

const INDIA_TIME_ZONE = "Asia/Kolkata";

const HISTORY_STATUSES = [
  "completed",
  "cancelled",
  "skipped",
  "refunded",
  "failed",
  "rejected",
];

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

  const getPart = (type) =>
    parts.find((part) => part.type === type)?.value;

  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");

  return year && month && day ? `${year}-${month}-${day}` : null;
}

function getTodayDateKey() {
  return getIndiaDateKey(new Date());
}

function parseTimeForQueue(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value >= 0 && value < 1440 ? Math.floor(value) : null;
  }

  const text = String(value).trim();
  const match =
    /^(\d{1,2})(?::(\d{1,2}))?(?::\d{2})?\s*(AM|PM)?$/i.exec(text);

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

  const hours = Number(
    parts.find((part) => part.type === "hour")?.value
  );
  const minutes = Number(
    parts.find((part) => part.type === "minute")?.value
  );

  return hours * 60 + minutes;
}

function formatTime(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

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

function formatDate(value) {
  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
  ) {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return "Date not available";
    }

    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  const date = parseDate(value);
  if (!date) return "Date not available";

  return date.toLocaleDateString("en-IN", {
    timeZone: INDIA_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

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

  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : null;
}

function getDuration(booking) {
  const value =
    booking.duration ??
    booking.doctorDuration ??
    booking.consultationDuration ??
    booking.queue?.duration;

  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function getWaitMinutes(booking) {
  const value =
    booking.estimatedWaitMinutes ??
    booking.queue?.estimatedWaitMinutes;

  if (value !== null && value !== undefined && value !== "") {
    const number = Number(value);

    if (Number.isFinite(number)) {
      return Math.max(0, number);
    }
  }

  const peopleAhead = getPeopleAhead(booking);
  const duration = getDuration(booking);

  if (peopleAhead === null || duration === null) return null;

  return peopleAhead * duration;
}

function getSavedExpectedTurn(booking) {
  return (
    booking.expectedTurnAt ??
    booking.queue?.expectedTurnAt ??
    null
  );
}

function getExpectedTurnDate(booking) {
  const saved = parseDate(getSavedExpectedTurn(booking));

  if (saved) return saved;

  const appointmentDate = getIndiaDateKey(getDateValue(booking));
  if (!appointmentDate) return null;

  const bookingMinutes = parseTimeForQueue(
    getBookingTimeValue(booking)
  );
  const checkupMinutes = parseTimeForQueue(
    getCheckupStartValue(booking)
  );

  const baseMinutes =
    bookingMinutes !== null && checkupMinutes !== null
      ? Math.max(bookingMinutes, checkupMinutes)
      : bookingMinutes ?? checkupMinutes;

  if (baseMinutes === null || baseMinutes === undefined) return null;

  const waitMinutes = getWaitMinutes(booking);
  if (waitMinutes === null) return null;

  const [year, month, day] = appointmentDate.split("-").map(Number);

  return new Date(
    Date.UTC(year, month - 1, day, 0, baseMinutes + waitMinutes) -
      330 * 60 * 1000
  );
}

function normalizeStatus(status) {
  const value = String(status || "waiting")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-")
    .replaceAll(" ", "-");

  const aliases = {
    pending: "waiting",
    booked: "confirmed",
    success: "confirmed",
    paid: "confirmed",
    inprogress: "in-progress",
    canceled: "cancelled",
    "no-show": "skipped",
    "no-showed": "skipped",
  };

  return aliases[value] || value;
}

function shouldMarkCompleted(booking, now = Date.now()) {
  const status = normalizeStatus(booking.status);

  if (HISTORY_STATUSES.includes(status)) {
    return status === "completed";
  }

  const expectedTurn = getExpectedTurnDate(booking);
  const duration = getDuration(booking);

  if (!expectedTurn || duration === null) return false;

  const completionTime =
    expectedTurn.getTime() + duration * 60 * 1000;

  return completionTime <= now;
}

function getDisplayStatus(booking, now = Date.now()) {
  const status = normalizeStatus(booking.status);

  if (HISTORY_STATUSES.includes(status)) {
    return status;
  }

  const expectedTurn = getExpectedTurnDate(booking);
  const duration = getDuration(booking);

  if (expectedTurn && duration !== null) {
    const startTime = expectedTurn.getTime();
    const endTime = startTime + duration * 60 * 1000;

    if (now >= startTime && now < endTime) {
      return "your-turn";
    }

    if (now >= endTime) {
      return "completed";
    }
  }

  return status;
}

function isHistoryStatus(status) {
  return HISTORY_STATUSES.includes(normalizeStatus(status));
}

function isActiveStatus(status) {
  return !isHistoryStatus(status);
}

function formatIndiaTime(date) {
  if (!date || Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("en-IN", {
    timeZone: INDIA_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getExpectedTurn(booking) {
  const calculated = getExpectedTurnDate(booking);

  if (calculated) return formatIndiaTime(calculated);

  const saved = getSavedExpectedTurn(booking);

  if (saved !== null && saved !== undefined && saved !== "") {
    return formatTime(saved);
  }

  return formatTime(
    getCheckupStartValue(booking) || getBookingTimeValue(booking)
  );
}

function getBookingSortTime(booking) {
  const expected = getExpectedTurnDate(booking);

  if (expected) {
    return getIndiaMinutes(expected) ?? Number.MAX_SAFE_INTEGER;
  }

  const saved = parseDate(getSavedExpectedTurn(booking));

  if (saved) {
    return getIndiaMinutes(saved) ?? Number.MAX_SAFE_INTEGER;
  }

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

function sortBookings(bookings) {
  return [...bookings].sort((a, b) => {
    const dateDifference = getBookingSortDate(a) - getBookingSortDate(b);
    if (dateDifference !== 0) return dateDifference;

    const timeDifference = getBookingSortTime(a) - getBookingSortTime(b);
    if (timeDifference !== 0) return timeDifference;

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

function StatusBadge({ status, peopleAhead }) {
  const normalized = normalizeStatus(status);

  const styles = {
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
      {labels[normalized] || normalized.replaceAll("-", " ")}
    </span>
  );
}

function getPaymentAmount(booking) {
  let value;
  let unit;

  if (
    booking.amount !== null &&
    booking.amount !== undefined &&
    booking.amount !== ""
  ) {
    value = booking.amount;
    unit = booking.amountUnit;
  } else if (
    booking.paymentAmount !== null &&
    booking.paymentAmount !== undefined &&
    booking.paymentAmount !== ""
  ) {
    value = booking.paymentAmount;
    unit = booking.paymentAmountUnit;
  } else if (
    booking.bookingCharge !== null &&
    booking.bookingCharge !== undefined &&
    booking.bookingCharge !== ""
  ) {
    value = booking.bookingCharge;
    unit = "rupees";
  } else if (
    booking.fee !== null &&
    booking.fee !== undefined &&
    booking.fee !== ""
  ) {
    value = booking.fee;
    unit = "rupees";
  } else {
    return null;
  }

  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;

  const rupees = unit === "rupees" ? amount : amount / 100;

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: booking.currency || "INR",
    maximumFractionDigits: 2,
  }).format(rupees);
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
    booking.clinic?.location?.longitude ??
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

  const clinicName =
    booking.clinicName ||
    booking.clinic?.name ||
    "";

  if (clinicName) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      clinicName
    )}`;
  }

  return null;
}

function BookingCard({ booking, now }) {
  const { start, end } = getSlotTimes(booking);

  const patient =
    booking.patient && typeof booking.patient === "object"
      ? booking.patient
      : {};

  const patientName =
    patient.name ||
    booking.patientName ||
    booking.name ||
    "Not specified";

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

  const doctorName =
    booking.doctorName ||
    booking.doctor?.name ||
    "";

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

  const status = getDisplayStatus(booking, now);
  const peopleAhead = getPeopleAhead(booking);
  const expectedTurn = getExpectedTurn(booking);
  const duration = getDuration(booking);
  const paymentAmount = getPaymentAmount(booking);

  const canShowQueue = [
    "waiting",
    "confirmed",
    "in-progress",
    "serving",
    "your-turn",
  ].includes(status);

  const slot = getSlot(booking);

  const slotOpen =
    typeof slot === "object"
      ? slot.open || slot.start || ""
      : "";

  const token =
    booking.tokenNumber ||
    booking.token ||
    booking.bookingReference ||
    "N/A";

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

        <StatusBadge status={status} peopleAhead={peopleAhead} />
      </div>

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
              <p className="text-xs text-gray-500">Expected Turn</p>
              <p className="mt-1 text-lg font-bold text-indigo-700">
                {expectedTurn || "Not available"}
              </p>
            </div>
          </div>

          <p className="mt-3 text-xs leading-5 text-gray-500">
            Queue estimates may change when consultations take longer,
            patients are added, or priority cases are handled.
          </p>
        </div>
      )}

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div className="flex items-start gap-3">
          <CalendarDays
            size={18}
            className="mt-0.5 shrink-0 text-indigo-600"
          />
          <div>
            <p className="text-xs text-gray-500">Appointment date</p>
            <p className="mt-1 text-sm font-medium text-gray-800">
              {formatDate(getDateValue(booking))}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Clock
            size={18}
            className="mt-0.5 shrink-0 text-indigo-600"
          />
          <div>
            <p className="text-xs text-gray-500">Checkup time</p>

            {start && (
              <p className="mt-1 text-sm font-medium text-gray-800">
                {end
                  ? `Booking slot: ${formatTime(slotOpen) || start} - ${formatTime(end)}`
                  : formatTime(start)}
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
          <User
            size={18}
            className="mt-0.5 shrink-0 text-indigo-600"
          />
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
            <MapPin
              size={18}
              className="mt-0.5 shrink-0 text-indigo-600"
            />

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
            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0 text-indigo-600"
            />
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
            <CreditCard
              size={18}
              className="mt-0.5 shrink-0 text-indigo-600"
            />
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

      {booking.paymentStatus &&
        booking.paymentStatus !== "unknown" && (
          <div className="mt-4 border-t border-gray-100 pt-3">
            <span className="text-xs text-gray-500">
              Payment status:{" "}
            </span>
            <span className="text-xs font-semibold capitalize text-gray-700">
              {booking.paymentStatus}
            </span>
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
  const { data: session, status: sessionStatus } = useSession();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const fetchBookings = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await fetch("/api/my-bookings", {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to load your bookings."
        );
      }

      setBookings(Array.isArray(data.bookings) ? data.bookings : []);
    } catch (err) {
      setError(
        err?.message || "Something went wrong while loading bookings."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus === "loading") return;

    if (!session) {
      setBookings([]);
      setError("");
      setLoading(false);
      return;
    }

    fetchBookings();
  }, [session, sessionStatus, fetchBookings]);

  useEffect(() => {
    if (sessionStatus !== "authenticated" || !session) return;

    const interval = setInterval(() => {
      setNow(Date.now());
      fetchBookings(true);
    }, 20000);

    return () => clearInterval(interval);
  }, [session, sessionStatus, fetchBookings]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const sortedBookings = useMemo(
    () => sortBookings(bookings),
    [bookings]
  );

  const todayKey = getTodayDateKey();

  const upcomingBookings = useMemo(() => {
    return sortedBookings.filter((booking) => {
      const dateKey = getIndiaDateKey(getDateValue(booking));
      const status = normalizeStatus(booking.status);

      return (
        dateKey !== null &&
        dateKey >= todayKey &&
        isActiveStatus(status) &&
        !shouldMarkCompleted(booking, now)
      );
    });
  }, [sortedBookings, todayKey, now]);

  const pastBookings = useMemo(() => {
    return sortedBookings.filter((booking) => {
      const dateKey = getIndiaDateKey(getDateValue(booking));

      if (isHistoryStatus(booking.status)) return true;
      if (!dateKey) return true;

      return (
        dateKey < todayKey ||
        shouldMarkCompleted(booking, now)
      );
    });
  }, [sortedBookings, todayKey, now]);

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
              <h1 className="text-3xl font-bold text-gray-900">
                My Bookings
              </h1>
              <p className="mt-2 text-gray-600">
                View and track your appointments in one place.
              </p>
            </div>

            <button
              type="button"
              onClick={() => fetchBookings(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                className={refreshing ? "animate-spin" : ""}
              />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              <div className="flex items-start gap-2">
                <AlertCircle
                  size={18}
                  className="mt-0.5 shrink-0"
                />

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
                {upcomingBookings.map((booking, index) => (
                  <BookingCard
                    key={
                      booking._id ||
                      booking.id ||
                      booking.bookingReference ||
                      index
                    }
                    booking={booking}
                    now={now}
                  />
                ))}
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
                {pastBookings.map((booking, index) => (
                  <BookingCard
                    key={
                      booking._id ||
                      booking.id ||
                      booking.bookingReference ||
                      index
                    }
                    booking={booking}
                    now={now}
                  />
                ))}
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

      <GoUpButton />
    </>
  );
}