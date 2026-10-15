"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import Header from "@/components/Header";
import GoUpButton from "@/components/GoUpButton";
import LoadingScreen from "@/components/LoadingScreen";

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
} from "lucide-react";

function calculateDistance(lat1, lng1, lat2, lng2) {
  if (
    lat1 == null ||
    lng1 == null ||
    lat2 == null ||
    lng2 == null
  ) {
    return null;
  }

  const values = [lat1, lng1, lat2, lng2].map(Number);

  if (!values.every(Number.isFinite)) return null;

  const [latitude1, longitude1, latitude2, longitude2] = values;
  const earthRadius = 6371;
  const dLat = ((latitude2 - latitude1) * Math.PI) / 180;
  const dLng = ((longitude2 - longitude1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((latitude1 * Math.PI) / 180) *
      Math.cos((latitude2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return (
    earthRadius *
    2 *
    Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  );
}

function getTodayKey(date = new Date()) {
  return [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ][date.getDay()];
}

function getLocalDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
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

  const match = value.match(
    /^(\d{1,2})(?::(\d{1,2}))?\s*(AM|PM)?$/
  );

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

function formatTime(date) {
  if (!date || Number.isNaN(date.getTime())) return "Unavailable";

  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
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
  return ![
    "completed",
    "cancelled",
    "no-show",
    "noshow",
  ].includes(String(booking?.status || "").toLowerCase());
}

function getBookingsForSlot(doctor, dateKey, slot) {
  if (!Array.isArray(doctor?.bookings) || !slot) return [];

  const slotKey = getSlotKey(slot);

  return doctor.bookings.filter((booking) => {
    if (getBookingDateKey(booking) !== dateKey) return false;

    if (!isActiveBooking(booking)) return false;

    const bookingDoctorId =
      booking.doctorId ?? booking.doctor?.id;

    if (
      bookingDoctorId != null &&
      String(bookingDoctorId) !== String(doctor.id)
    ) {
      return false;
    }

    const bookingSlot =
      booking.slot || booking.selectedSlot || {};

    return getSlotKey(bookingSlot) === slotKey;
  });
}

function getSlotStartDate(dateString, slot) {
  const startMinutes = parseTime(
    slot?.checkupStartTime || slot?.open
  );

  if (startMinutes === null) return null;

  const [year, month, day] = dateString.split("-").map(Number);

  const result = new Date(year, month - 1, day, 0, 0, 0, 0);
  result.setMinutes(startMinutes);

  return result;
}

function getSlotCloseDate(dateString, slot) {
  const closeMinutes = parseTime(slot?.close);

  if (closeMinutes === null) return null;

  const [year, month, day] = dateString.split("-").map(Number);

  const result = new Date(year, month - 1, day, 0, 0, 0, 0);
  result.setMinutes(closeMinutes);

  return result;
}

function calculateSlotQueue(doctor, slot, date) {
  const dateKey = getLocalDateKey(date);
  const bookings = getBookingsForSlot(doctor, dateKey, slot);
  const queue = sortQueue(bookings);

  const capacity =
    Math.max(
      0,
      Number(slot?.capacity ?? doctor?.capacity) || 0
    );

  const completed = (doctor?.bookings || []).filter((booking) => {
    return (
      getBookingDateKey(booking) === dateKey &&
      getSlotKey(booking.slot || booking.selectedSlot || {}) ===
        getSlotKey(slot) &&
      String(booking.status || "").toLowerCase() === "completed"
    );
  }).length;

  const scheduledStart = getSlotStartDate(dateKey, slot);
  const slotClose = getSlotCloseDate(dateKey, slot);
  const duration = Math.max(1, Number(doctor?.duration) || 20);

  const empty = {
    total: bookings.length,
    capacity,
    peopleAhead: 0,
    waiting: 0,
    serving: null,
    completed,
    queue,
    servingIndex: -1,
    isStarted: false,
    isFinished: false,
    nextPatient: null,
    expectedTurn: null,
    estimatedWait: 0,
  };

  if (!scheduledStart || !slotClose) {
    return {
      ...empty,
      peopleAhead: queue.length,
      waiting: queue.length,
      nextPatient: queue[0] || null,
    };
  }

  const isToday = dateKey === getLocalDateKey(new Date());

  if (!isToday) {
    return {
      ...empty,
      peopleAhead: queue.length,
      waiting: queue.length,
      nextPatient: queue[0] || null,
      expectedTurn: queue.length ? scheduledStart : null,
    };
  }

  const now = date;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  if (now >= slotClose) {
    return {
      ...empty,
      isStarted: true,
      isFinished: true,
    };
  }

  const firstTurnTime = Math.max(
    now.getTime(),
    scheduledStart.getTime()
  );

  const latestCreationTime = queue.reduce(
    (latest, booking) => Math.max(latest, getCreatedAt(booking)),
    firstTurnTime
  );

  const expectedTurn = new Date(
    Math.max(firstTurnTime, latestCreationTime) +
      Math.max(0, queue.length - 1) * duration * 60_000
  );

  if (now < scheduledStart) {
    return {
      ...empty,
      peopleAhead: queue.length,
      waiting: queue.length,
      nextPatient: queue[0] || null,
      expectedTurn: queue.length ? scheduledStart : null,
      estimatedWait: Math.max(
        0,
        Math.ceil((scheduledStart.getTime() - now.getTime()) / 60_000)
      ),
    };
  }

  const firstBookingTime = queue
    .map((booking) => getCreatedAt(booking))
    .filter((timestamp) => {
      if (!timestamp) return false;

      const createdAt = new Date(timestamp);

      return (
        getLocalDateKey(createdAt) === dateKey &&
        createdAt.getTime() >= scheduledStart.getTime() &&
        createdAt.getTime() < slotClose.getTime()
      );
    })
    .sort((a, b) => a - b)[0];

  const queueStart = Math.max(
    scheduledStart.getTime(),
    firstBookingTime || scheduledStart.getTime()
  );

  if (now.getTime() < queueStart) {
    return {
      ...empty,
      peopleAhead: queue.length,
      waiting: queue.length,
      nextPatient: queue[0] || null,
      expectedTurn: queue.length ? new Date(queueStart) : null,
      estimatedWait: Math.ceil((queueStart - now.getTime()) / 60_000),
    };
  }

  const calculatedIndex = Math.floor(
    (now.getTime() - queueStart) / (duration * 60_000)
  );

  if (calculatedIndex >= queue.length) {
    return {
      ...empty,
      isStarted: true,
    };
  }

  const servingIndex = Math.max(0, calculatedIndex);
  const serving = queue[servingIndex] || null;
  const waiting = Math.max(0, queue.length - servingIndex - 1);

  const nextBooking = queue[servingIndex + 1] || null;

  const nextExpectedTurn = nextBooking
    ? new Date(
        Math.max(
          now.getTime(),
          queueStart + (servingIndex + 1) * duration * 60_000,
          getCreatedAt(nextBooking)
        )
      )
    : null;

  const safeExpectedTurn =
    nextExpectedTurn && nextExpectedTurn < slotClose
      ? nextExpectedTurn
      : null;

  return {
    ...empty,
    peopleAhead: waiting,
    waiting,
    serving,
    servingIndex,
    isStarted: true,
    nextPatient: nextBooking,
    expectedTurn: safeExpectedTurn,
    estimatedWait: safeExpectedTurn
      ? Math.max(
          0,
          Math.ceil((safeExpectedTurn.getTime() - now.getTime()) / 60_000)
        )
      : 0,
  };
}

function getDoctorStatus(schedule, now = new Date()) {
  const today = getTodayKey(now);
  const todaySchedule = schedule?.[today];

  if (!todaySchedule?.active || !todaySchedule?.slots?.length) {
    return {
      isOpen: false,
      text: "Closed Today",
      currentSlot: null,
      nextSlot: null,
    };
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const currentSlot = todaySchedule.slots.find((slot) => {
    const open = parseTime(slot.open);
    const close = parseTime(slot.close);

    return (
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
    };
  }

  const nextSlot = todaySchedule.slots
    .filter((slot) => {
      const open = parseTime(slot.open);

      return open !== null && open > currentMinutes;
    })
    .sort((a, b) => parseTime(a.open) - parseTime(b.open))[0];

  if (nextSlot) {
    return {
      isOpen: false,
      text: `Closed · Opens ${formatSlotTime(nextSlot.open)}`,
      currentSlot: null,
      nextSlot,
    };
  }

  return {
    isOpen: false,
    text: "Closed Today",
    currentSlot: null,
    nextSlot: null,
  };
}

function getScheduleText(schedule) {
  if (!schedule?.active || !schedule?.slots?.length) {
    return "Closed Today";
  }

  return schedule.slots
    .map(
      (slot) =>
        `${formatSlotTime(slot.open)} - ${formatSlotTime(slot.close)}`
    )
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

  return Number.isFinite(fallbackFee) && fallbackFee >= 0
    ? fallbackFee
    : 0;
}

function getSlotLabel(slot, dateKey, now, status) {
  const closeDate = getSlotCloseDate(dateKey, slot);
  const startDate = getSlotStartDate(dateKey, slot);

  if (closeDate && now >= closeDate) return "Finished";

  if (
    status.isOpen &&
    status.currentSlot?.open === slot.open &&
    status.currentSlot?.close === slot.close
  ) {
    return "Currently open";
  }

  if (startDate && now >= startDate) return "In progress";

  return "Upcoming";
}

export default function ClinicDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();

  const [clinics, setClinics] = useState([]);
  const [loadingClinics, setLoadingClinics] = useState(true);
  const [clinicError, setClinicError] = useState("");
  const [location, setLocation] = useState("Select Location");
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    let cancelled = false;

    async function fetchClinics() {
      try {
        setClinicError("");

        const response = await fetch("/api/clinics", {
          method: "GET",
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Failed to fetch clinics");
        }

        if (!Array.isArray(data.clinics)) {
          throw new Error("Invalid clinics response");
        }

        if (!cancelled) {
          setClinics(data.clinics);
        }
      } catch (error) {
        if (!cancelled) {
          setClinicError(
            error.message || "Unable to load clinics"
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingClinics(false);
        }
      }
    }

    fetchClinics();

    const refreshTimer = setInterval(fetchClinics, 20_000);

    return () => {
      cancelled = true;
      clearInterval(refreshTimer);
    };
  }, []);

  useEffect(() => {
    try {
      const savedLocation = localStorage.getItem("queueease-location");

      if (!savedLocation) return;

      const parsed = JSON.parse(savedLocation);

      if (parsed && typeof parsed === "object") {
        setLocation(
          parsed.name ||
            parsed.address ||
            parsed.location ||
            parsed.display_name ||
            "Selected Location"
        );
      } else {
        setLocation(String(savedLocation));
      }
    } catch {
      const savedLocation = localStorage.getItem("queueease-location");

      if (savedLocation) setLocation(savedLocation);
    }
  }, []);

  useEffect(() => {
    const updateTime = () => setCurrentTime(new Date());

    updateTime();

    const interval = setInterval(updateTime, 1_000);

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

  const clinicId = Array.isArray(params.id) ? params.id[0] : params.id;

  const clinic = useMemo(
    () =>
      clinics.find(
        (item) => String(item.id) === String(clinicId)
      ),
    [clinics, clinicId]
  );

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

  const distance = useMemo(() => {
    if (!clinic || !userCoordinates) return null;

    if (clinic.lat == null || clinic.lng == null) return null;

    return calculateDistance(
      userCoordinates.lat,
      userCoordinates.lng,
      clinic.lat,
      clinic.lng
    );
  }, [clinic, userCoordinates]);

  const today = getTodayKey(currentTime);
  const todayDate = getLocalDateKey(currentTime);

  const doctors = useMemo(() => {
    if (!clinic || !Array.isArray(clinic.doctors)) return [];

    return clinic.doctors.map((doctor) => {
      const normalizedDoctor = {
        ...doctor,
        schedule: doctor.schedule || {},
        bookings: Array.isArray(doctor.bookings)
          ? doctor.bookings
          : [],
      };

      const doctorStatus = getDoctorStatus(
        normalizedDoctor.schedule,
        currentTime
      );

      const todaySchedule = normalizedDoctor.schedule[today];

      const slotQueues =
        todaySchedule?.active && Array.isArray(todaySchedule.slots)
          ? todaySchedule.slots.map((slot) => ({
              slot,
              queueInfo: calculateSlotQueue(
                normalizedDoctor,
                slot,
                currentTime
              ),
            }))
          : [];

      return {
        ...normalizedDoctor,
        status: doctorStatus,
        slotQueues,
      };
    });
  }, [clinic, currentTime, today, todayDate]);

  if (status === "loading" || loadingClinics) {
    return <LoadingScreen />;
  }

  if (clinicError) {
    return (
      <main className="min-h-screen bg-gray-50">
        <Header showBack={false} />

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

        <GoUpButton />
      </main>
    );
  }

  if (!clinic) {
    return (
      <main className="min-h-screen bg-gray-50">
        <Header showBack={false} />

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

        <GoUpButton />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <Header showBack={false} />

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
          <div className="p-5 sm:p-7">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    {clinic.rating ?? "N/A"}
                  </span>

                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                    {doctors.length}{" "}
                    {doctors.length === 1 ? "Doctor" : "Doctors"}
                  </span>
                </div>

                <h1 className="mt-3 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                  {clinic.name}
                </h1>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
                      <MapPin className="h-4 w-4 text-indigo-600" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Clinic location
                      </p>

                      <p className="mt-0.5 text-sm font-semibold text-gray-700">
                        {clinic.address || "Address unavailable"}
                      </p>
                    </div>
                  </div>

                  {distance !== null && (
                    <>
                      <div className="hidden h-7 w-px bg-gray-200 sm:block" />

                      <div className="flex items-center gap-2">
                        <Navigation className="h-4 w-4 text-indigo-500" />

                        <span className="text-sm font-semibold text-gray-600">
                          {distance < 1
                            ? `${Math.round(distance * 1000)} m away`
                            : `${distance.toFixed(1)} km away`}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {clinic.lat != null &&
                clinic.lng != null &&
                Number.isFinite(Number(clinic.lat)) &&
                Number.isFinite(Number(clinic.lng)) && (
                  <a
                    href={`https://www.google.com/maps?q=${clinic.lat},${clinic.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-3 text-sm font-bold text-indigo-700 transition hover:bg-indigo-100 sm:w-auto"
                  >
                    <Navigation className="h-4 w-4" />
                    Get Directions
                  </a>
                )}
            </div>
          </div>

          <div className="border-t border-gray-100 bg-gray-50/70 px-5 py-3.5 sm:px-7">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-gray-400" />

              <span className="text-xs text-gray-400">
                Your location
              </span>

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
                No doctors are currently listed for this clinic.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {doctors.map((doctor) => {
                  const todaySchedule = doctor.schedule?.[today];

                  return (
                    <article key={doctor.id} className="p-5 sm:p-6">
                      <div className="flex flex-col gap-5">
                        <div className="flex items-start gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
                            <Stethoscope className="h-5 w-5 text-indigo-600" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold text-gray-900">
                                {doctor.name}
                              </h3>

                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  doctor.status.isOpen
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-gray-100 text-gray-500"
                                }`}
                              >
                                {doctor.status.isOpen
                                  ? "Available"
                                  : "Closed"}
                              </span>
                            </div>

                            <p className="mt-1 text-sm text-gray-500">
                              {doctor.specialization ||
                                "General consultation"}
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
                          {todaySchedule?.active &&
                          todaySchedule?.slots?.length > 0 ? (
                            <div className="space-y-2">
                              {doctor.slotQueues.map(
                                ({ slot, queueInfo }, index) => {
                                  const isCurrentActiveSlot =
                                    doctor.status.isOpen &&
                                    doctor.status.currentSlot?.open === slot.open &&
                                    doctor.status.currentSlot?.close === slot.close;

                                  const slotLabel = getSlotLabel(
                                    slot,
                                    todayDate,
                                    currentTime,
                                    doctor.status
                                  );

                                  const isFinished = queueInfo.isFinished;

                                  return (
                                    <div
                                      key={`${slot.open}-${slot.close}-${index}`}
                                      className={`rounded-xl border p-3.5 ${
                                        isCurrentActiveSlot
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

                                          {isCurrentActiveSlot && (
                                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider text-emerald-700">
                                              NOW
                                            </span>
                                          )}
                                        </div>

                                        <span
                                          className={`shrink-0 text-right text-xs font-bold sm:text-sm ${
                                            queueInfo.peopleAhead > 0
                                              ? "text-orange-600"
                                              : "text-emerald-600"
                                          }`}
                                        >
                                          {queueInfo.peopleAhead === 0
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

                                      {isCurrentActiveSlot && queueInfo.serving && (
                                        <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                                          <Users className="h-3.5 w-3.5" />
                                          Serving:{" "}
                                          {queueInfo.serving.patient?.name ||
                                            queueInfo.serving.patientName ||
                                            "Current patient"}
                                        </div>
                                      )}

                                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700">
                                          <Clock className="h-3.5 w-3.5" />
                                          {isFinished
                                            ? "Slot ended"
                                            : queueInfo.expectedTurn
                                              ? `Expected turn: ${formatTime(
                                                  queueInfo.expectedTurn
                                                )}`
                                              : "Expected turn unavailable"}
                                        </span>

                                        {isCurrentActiveSlot &&
                                          queueInfo.estimatedWait > 0 && (
                                            <span className="text-[11px] font-medium text-gray-500">
                                              Approx. {queueInfo.estimatedWait} min
                                            </span>
                                          )}
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
                            className="min-h-[40px] w-full rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white transition hover:bg-indigo-700"
                          >
                            Book Consultation
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

              <div className="space-y-4 p-3 sm:space-y-5 sm:p-4">
                {doctors.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    No doctor schedules available.
                  </p>
                ) : (
                  doctors.map((doctor) => (
                    <div key={doctor.id}>
                      <p className="mb-1.5 px-1 text-[10px] font-bold text-gray-800 sm:text-[11px]">
                        {doctor.name}
                      </p>

                      <div className="space-y-1">
                        {Object.entries(doctor.schedule).map(
                          ([day, schedule]) => {
                            const isToday = day === today;

                            return (
                              <div
                                key={day}
                                className={`flex items-start gap-2 rounded-md px-2.5 py-1.5 sm:px-3 sm:py-2 ${
                                  isToday ? "bg-indigo-50" : ""
                                }`}
                              >
                                <span
                                  className={`w-14 shrink-0 text-[9px] capitalize sm:w-16 sm:text-[10px] ${
                                    isToday
                                      ? "font-bold text-indigo-700"
                                      : "text-gray-600"
                                  }`}
                                >
                                  {day}
                                </span>

                                <div
                                  className={`min-w-0 flex-1 text-right text-[9px] leading-4 sm:text-[10px] ${
                                    schedule?.active
                                      ? "font-medium text-gray-700"
                                      : "text-gray-400"
                                  }`}
                                >
                                  {schedule?.active &&
                                  schedule?.slots?.length > 0 ? (
                                    <div>
                                      {schedule.slots.map((slot, index) => (
                                        <div
                                          key={`${slot.open}-${slot.close}-${index}`}
                                        >
                                          {formatSlotTime(slot.open)} -{" "}
                                          {formatSlotTime(slot.close)}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span>Closed Today</span>
                                  )}
                                </div>
                              </div>
                            );
                          }
                        )}
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
                    Select a doctor to continue with your consultation
                    booking.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <GoUpButton />

      {selectedDoctor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
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
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
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
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
                aria-label="Close booking dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-xl bg-indigo-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white">
                    <Stethoscope className="h-5 w-5 text-indigo-600" />
                  </div>

                  <div className="min-w-0">
                    <p className="font-bold text-gray-900">
                      {selectedDoctor.name}
                    </p>

                    <p className="mt-0.5 text-xs text-gray-500">
                      {selectedDoctor.specialization ||
                        "General consultation"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-gray-500">
                    Appointment
                  </span>

                  <span className="text-sm font-bold text-gray-900">
                    Consultation
                  </span>
                </div>

                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-gray-500">
                    Consultation Fee
                  </span>

                  <span className="text-sm font-semibold text-gray-900">
                    ₹{getDoctorFee(selectedDoctor.fee)}
                  </span>
                </div>

                <div className="flex items-center justify-between px-4 py-3">
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

                <div className="flex items-center justify-between bg-indigo-50 px-4 py-3">
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

                <div className="flex items-start justify-between gap-4 px-4 py-3">
                  <span className="text-[10px] text-gray-500">
                    Today's timing
                  </span>

                  <span className="text-right text-xs font-semibold text-gray-700">
                    {getScheduleText(
                      selectedDoctor.schedule?.[today]
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-gray-50 p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

                <p className="text-xs leading-5 text-gray-600">
                  Pay the booking charge to reserve your token. The
                  consultation fee is separate and can be paid at the
                  clinic.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  const doctorId = selectedDoctor.id;
                  const currentClinicId = clinic.id;

                  setSelectedDoctor(null);

                  router.push(
                    `/services/clinics/${encodeURIComponent(
                      currentClinicId
                    )}/book?doctor=${encodeURIComponent(doctorId)}`
                  );
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-700"
              >
                <CheckCircle2 className="h-4 w-4" />
                Continue Booking · ₹
                {getDoctorFee(
                  selectedDoctor.bookingCharge,
                  selectedDoctor.fee
                )}
              </button>

              <button
                type="button"
                onClick={() => setSelectedDoctor(null)}
                className="w-full py-1 text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}