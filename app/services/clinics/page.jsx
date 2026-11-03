"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

import Header from "@/components/Header";
import GoUpButton from "@/components/GoUpButton";
import LoadingScreen from "@/components/LoadingScreen";

import {
  MapPin,
  Search,
  ChevronRight,
  X,
  Clock,
  Stethoscope,
  Loader2,
  Users,
  ArrowRight,
  Zap,
  Star,
  Activity,
} from "lucide-react";

// Persistent memory cache across re-renders
const clinicsMemoryCache = new Map();

function calculateStraightDistance(lat1, lng1, lat2, lng2) {
  const values = [lat1, lng1, lat2, lng2].map(Number);

  if (
    values.some((value) => !Number.isFinite(value)) ||
    Math.abs(values[0]) > 90 ||
    Math.abs(values[2]) > 90 ||
    Math.abs(values[1]) > 180 ||
    Math.abs(values[3]) > 180
  ) {
    return null;
  }

  const [latitude1, longitude1, latitude2, longitude2] = values;

  const toRadians = (value) => (value * Math.PI) / 180;

  const earthRadius = 6371;

  const dLat = toRadians(latitude2 - latitude1);
  const dLng = toRadians(longitude2 - longitude1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(latitude1)) *
      Math.cos(toRadians(latitude2)) *
      Math.sin(dLng / 2) ** 2;

  const distance =
    earthRadius *
    2 *
    Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return {
    distance: Number(distance.toFixed(2)),
    duration: null,
    isRoadDistance: false,
  };
}

async function calculateDistance(lat1, lng1, lat2, lng2) {
  const fallback = calculateStraightDistance(
    lat1,
    lng1,
    lat2,
    lng2
  );

  if (!fallback) return null;

  try {
    const coordinates = [lat1, lng1, lat2, lng2]
      .map(Number)
      .join(",");

    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${Number(lng1)},${Number(lat1)};${Number(lng2)},${Number(lat2)}` +
      `?overview=false`;

    const controller = new AbortController();

    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Routing request failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.code !== "Ok" || !data.routes?.length) {
        throw new Error("No valid route found");
      }

      const route = data.routes[0];

      return {
        distance: Number((route.distance / 1000).toFixed(2)),
        duration: Math.ceil(route.duration / 60),
        isRoadDistance: true,
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.warn("Using straight-line distance:", error.message);
    return fallback;
  }
}

function formatTime(time) {
  if (!time) return "";

  const value = String(time).trim();

  if (!value.includes("AM") && !value.includes("PM")) {
    const parts = value.split(":");
    let hour = Number(parts[0]);
    const minute = Number(parts[1] || 0);

    const suffix = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;

    return `${hour}:${String(minute).padStart(2, "0")} ${suffix}`;
  }

  const [timePart, period] = value.split(/\s+/);
  let [hour, minute] = timePart.split(":").map(Number);

  if (period === "AM" && hour === 12) {
    hour = 0;
  }

  if (period === "PM" && hour !== 12) {
    hour += 12;
  }

  const suffix = hour >= 12 ? "PM" : "AM";
  const formattedHour = hour % 12 || 12;

  return `${formattedHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function getMinutes(time) {
  if (!time) return null;

  const value = String(time).trim().toUpperCase();
  const match = value.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(AM|PM)?$/);

  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const period = match[3];

  if (period === "AM" && hour === 12) {
    hour = 0;
  }

  if (period === "PM" && hour !== 12) {
    hour += 12;
  }

  return hour * 60 + minute;
}

function getDoctorId(doctor) {
  return String(doctor?._id || doctor?.id || "");
}

function getTodayKey(date = new Date()) {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  return days[date.getDay()];
}

function getIndiaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function isDoctorOnHoliday(doctor, date = new Date()) {
  const today = getIndiaDateKey(date);
  const holidayDates = Array.isArray(doctor?.holidayDates)
    ? doctor.holidayDates
    : [];

  return holidayDates.some(
    (holiday) =>
      typeof holiday === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(holiday) &&
      holiday === today
  );
}

function getDaySchedule(schedule, day) {
  if (!schedule || !day) return null;

  return (
    schedule[day] ||
    schedule[day.toLowerCase()] ||
    schedule[day.charAt(0).toLowerCase() + day.slice(1)] ||
    null
  );
}

function getDoctorSlotQueues(doctor, date = new Date()) {
  const today = getTodayKey(date);

  if (isDoctorOnHoliday(doctor, date)) {
    return [];
  }

  const todaySchedule = getDaySchedule(doctor?.schedule, today);

  if (!todaySchedule?.active || !Array.isArray(todaySchedule.slots)) {
    return [];
  }

  return todaySchedule.slots
    .filter((slot) => slot?.active !== false)
    .map((slot) => ({
      slot,
      queueInfo: calculateSlotQueue(doctor, slot, date),
    }));
}

function getDoctorStatus(doctor, now = new Date()) {
  const today = getTodayKey(now);

  if (isDoctorOnHoliday(doctor, now)) {
    return {
      isOpen: false,
      status: "On Holiday",
      timeText: "Doctor on holiday today",
      schedule: getDaySchedule(doctor?.schedule, today),
      currentSlot: null,
      nextSlot: null,
      isHoliday: true,
    };
  }

  const todaySchedule = getDaySchedule(doctor?.schedule, today);

  if (!todaySchedule?.active) {
    return {
      isOpen: false,
      status: "Closed Today",
      timeText: "Not available today",
      schedule: todaySchedule,
      currentSlot: null,
      nextSlot: null,
      isHoliday: false,
    };
  }

  const slots = Array.isArray(todaySchedule.slots)
    ? todaySchedule.slots
        .filter((slot) => slot?.active !== false)
        .map((slot) => ({
          ...slot,
          openMinutes: getMinutes(slot.open),
          closeMinutes: getMinutes(slot.close),
        }))
        .filter(
          (slot) =>
            slot.openMinutes != null &&
            slot.closeMinutes != null &&
            slot.closeMinutes > slot.openMinutes
        )
        .sort((a, b) => a.openMinutes - b.openMinutes)
    : [];

  if (slots.length === 0) {
    return {
      isOpen: false,
      status: "Closed Today",
      timeText: "No active sessions today",
      schedule: todaySchedule,
      currentSlot: null,
      nextSlot: null,
      isHoliday: false,
    };
  }

  const indiaTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);

  const [hour, minute] = indiaTime.split(":").map(Number);
  const currentMinutes = hour * 60 + minute;

  const currentSlot = slots.find(
    (slot) =>
      currentMinutes >= slot.openMinutes &&
      currentMinutes < slot.closeMinutes
  );

  if (currentSlot) {
    return {
      isOpen: true,
      status: "Open Now",
      timeText: `Today: ${formatTime(currentSlot.open)} - ${formatTime(currentSlot.close)}`,
      schedule: todaySchedule,
      currentSlot,
      nextSlot: null,
      isHoliday: false,
    };
  }

  const nextSlot =
    slots.find((slot) => slot.openMinutes > currentMinutes) || null;

  if (nextSlot) {
    return {
      isOpen: false,
      status: "Closed Now",
      timeText: `Opens today at ${formatTime(nextSlot.open)}`,
      schedule: todaySchedule,
      currentSlot: null,
      nextSlot,
      isHoliday: false,
    };
  }

  return {
    isOpen: false,
    status: "Closed Today",
    timeText: "All sessions have ended for today",
    schedule: todaySchedule,
    currentSlot: null,
    nextSlot: null,
    isHoliday: false,
  };
}

function getClinicStatus(doctors, now = new Date()) {
  const availableDoctors = (doctors || []).filter(
    (doctor) => doctor?.isActive !== false
  );

  if (availableDoctors.length === 0) {
    return {
      isOpen: false,
      status: "Closed Today",
      timeText: "No doctors available",
      openDoctors: [],
      doctorStatuses: [],
    };
  }

  const doctorStatuses = availableDoctors.map((doctor) => ({
    doctor,
    status: getDoctorStatus(doctor, now),
  }));

  const openDoctors = doctorStatuses
    .filter((item) => item.status.isOpen)
    .map((item) => item.doctor);

  if (openDoctors.length > 0) {
    return {
      isOpen: true,
      status: "Open Now",
      timeText: `${openDoctors.length} ${
        openDoctors.length === 1 ? "doctor" : "doctors"
      } available now`,
      openDoctors,
      doctorStatuses,
    };
  }

  const hasNonHolidayDoctor = doctorStatuses.some(
    (item) => !item.status.isHoliday
  );

  const nextSlot = doctorStatuses
    .map((item) => item.status.nextSlot)
    .filter(Boolean)
    .sort((a, b) => getMinutes(a.open) - getMinutes(b.open))[0];

  if (nextSlot) {
    return {
      isOpen: false,
      status: "Closed Now",
      timeText: `Opens today at ${formatTime(nextSlot.open)}`,
      openDoctors: [],
      doctorStatuses,
    };
  }

  const allOnHoliday = doctorStatuses.every((item) => item.status.isHoliday);

  return {
    isOpen: false,
    status: "Closed Today",
    timeText: allOnHoliday
      ? "All doctors are on holiday today"
      : hasNonHolidayDoctor
      ? "All doctors have closed for today"
      : "No doctor available today",
    openDoctors: [],
    doctorStatuses,
  };
}

function getDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getBookingDateKey(booking) {
  if (!booking?.date) return "";

  const value = String(booking.date);

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const parsed = new Date(booking.date);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return getDateKey(parsed);
}

function getSlotKey(slot) {
  if (!slot) return "";
  return `${slot.open || ""}-${slot.close || ""}`;
}

function getPriorityRank(booking) {
  return booking?.priority?.toLowerCase() === "emergency" ||
    booking?.patient?.type?.toLowerCase() === "emergency"
    ? 0
    : 1;
}

function sortQueue(bookings) {
  return [...bookings].sort((a, b) => {
    const priorityDifference = getPriorityRank(a) - getPriorityRank(b);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    const sequenceA = Number(a?.sequence);
    const sequenceB = Number(b?.sequence);

    const validA = Number.isFinite(sequenceA);
    const validB = Number.isFinite(sequenceB);

    if (validA && validB && sequenceA !== sequenceB) {
      return sequenceA - sequenceB;
    }

    if (validA !== validB) {
      return validA ? -1 : 1;
    }

    const createdA = new Date(a?.createdAt || 0).getTime();
    const createdB = new Date(b?.createdAt || 0).getTime();

    return createdA - createdB;
  });
}

function getSlotBookings(doctor, dateKey, slot) {
  if (!doctor?.bookings?.length) {
    return [];
  }

  const slotKey = getSlotKey(slot);

  return doctor.bookings.filter((booking) => {
    if (getBookingDateKey(booking) !== dateKey) {
      return false;
    }

    if (booking?.status === "cancelled" || booking?.status === "no-show") {
      return false;
    }

    return getSlotKey(booking.slot) === slotKey;
  });
}

function calculateSlotQueue(doctor, slot, currentDate) {
  const capacity = Number(slot?.capacity ?? doctor?.capacity) || 0;
  const dateKey = getDateKey(currentDate);
  const bookings = getSlotBookings(doctor, dateKey, slot);

  const activeBookings = bookings.filter(
    (booking) =>
      !["completed", "cancelled", "no-show"].includes(
        String(booking.status || "").toLowerCase()
      )
  );

  const queue = sortQueue(activeBookings);

  const completedBookings = bookings.filter(
    (booking) => String(booking.status || "").toLowerCase() === "completed"
  );

  const checkupStart = getMinutes(slot.checkupStartTime || slot.open);
  const closeTime = getMinutes(slot.close);
  const currentMinutes =
    currentDate.getHours() * 60 + currentDate.getMinutes();

  const duration = Math.max(1, Number(doctor.duration) || 20);
  const isToday = dateKey === getDateKey(currentDate);

  const emptyQueue = {
    total: bookings.length,
    capacity,
    peopleAhead: 0,
    waiting: 0,
    serving: null,
    completed: completedBookings.length,
    queue,
    servingIndex: -1,
    isStarted: false,
    isFinished: false,
    nextPatient: null,
    estimatedWait: 0,
  };

  if (checkupStart == null || closeTime == null || !isToday) {
    return {
      ...emptyQueue,
      peopleAhead: queue.length,
      waiting: queue.length,
      nextPatient: queue[0] || null,
    };
  }

  if (currentMinutes >= closeTime) {
    return {
      ...emptyQueue,
      isStarted: true,
      isFinished: true,
    };
  }

  let queueStart = checkupStart;

  const firstBookingTime = queue
    .map((booking) => {
      if (!booking.createdAt) return null;

      const createdAt = new Date(booking.createdAt);

      if (
        Number.isNaN(createdAt.getTime()) ||
        getDateKey(createdAt) !== dateKey
      ) {
        return null;
      }

      return createdAt.getHours() * 60 + createdAt.getMinutes();
    })
    .filter(
      (minutes) =>
        minutes !== null &&
        minutes >= checkupStart &&
        minutes < closeTime
    )
    .sort((a, b) => a - b)[0];

  if (firstBookingTime != null) {
    queueStart = Math.max(checkupStart, firstBookingTime);
  }

  if (currentMinutes < queueStart) {
    return {
      ...emptyQueue,
      peopleAhead: queue.length,
      waiting: queue.length,
      nextPatient: queue[0] || null,
      estimatedWait: queue.length ? queueStart - currentMinutes : 0,
    };
  }

  const calculatedIndex = Math.floor((currentMinutes - queueStart) / duration);

  if (queue.length === 0 || calculatedIndex >= queue.length) {
    return {
      ...emptyQueue,
      isStarted: true,
      servingIndex: -1,
      peopleAhead: 0,
      waiting: 0,
      serving: null,
      nextPatient: null,
      estimatedWait: 0,
    };
  }

  const servingIndex = Math.max(0, calculatedIndex);
  const serving = queue[servingIndex] || null;
  const waiting = Math.max(0, queue.length - servingIndex - 1);

  return {
    ...emptyQueue,
    peopleAhead: waiting,
    waiting,
    serving,
    servingIndex,
    isStarted: true,
    nextPatient: queue[servingIndex + 1] || null,
    estimatedWait: waiting * duration,
  };
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function matchesClinicSearch(clinic, search) {
  const query = normalizeSearchText(search);

  if (!query) return true;

  const clinicName = normalizeSearchText(clinic?.name);
  const location = normalizeSearchText(
    `${clinic?.address || ""} ${clinic?.city || ""} ${clinic?.location || ""}`
  );

  const doctors = Array.isArray(clinic?.doctors)
    ? clinic.doctors
    : [];

  const doctorMatches = doctors.some((doctor) => {
    const doctorName = normalizeSearchText(doctor?.name);
    const specialization = normalizeSearchText(
      doctor?.specialization
    );

    return (
      doctorName.includes(query) ||
      specialization.includes(query)
    );
  });

  return (
    clinicName.includes(query) ||
    location.includes(query) ||
    doctorMatches
  );
}

export default function ClinicsPage() {
  const { data: session, status: sessionStatus } = useSession();

  const [location, setLocation] = useState("Select Location");
  const [search, setSearch] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());

  const [clinicsData, setClinicsData] = useState([]);
  const [filteredClinics, setFilteredClinics] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [distanceLoading, setDistanceLoading] = useState(false);

  const CACHE_TTL = 20_000;
  const REFRESH_INTERVAL = 20_000;

  const sessionId = session?.user?.id;

  const clinicsCacheKey = sessionId
    ? `zeriy-clinics-cache-${sessionId}`
    : null;

  // ------------------------------------
  // LOCATION
  // ------------------------------------

  useEffect(() => {
    function loadLocation() {
      try {
        const saved = localStorage.getItem("Zeriy-location");

        if (!saved) {
          setLocation("Select Location");
          return;
        }

        const parsed = JSON.parse(saved);

        setLocation(
          parsed.name ||
            parsed.address ||
            parsed.location ||
            "Select Location"
        );
      } catch {
        setLocation("Select Location");
      }
    }

    loadLocation();

    window.addEventListener("storage", loadLocation);

    window.addEventListener("locationUpdated", loadLocation);

    return () => {
      window.removeEventListener("storage", loadLocation);
      window.removeEventListener("locationUpdated", loadLocation);
    };
  }, []);

  // ------------------------------------
  // CACHE HELPERS
  // ------------------------------------

  function readCache() {
    if (!clinicsCacheKey) return null;

    const memoryCache = clinicsMemoryCache.get(clinicsCacheKey);

    if (memoryCache && Array.isArray(memoryCache.data)) {
      return memoryCache;
    }

    try {
      const saved = sessionStorage.getItem(clinicsCacheKey);

      if (!saved) return null;

      const parsed = JSON.parse(saved);

      if (
        !Array.isArray(parsed.data) ||
        !Number.isFinite(parsed.cachedAt)
      ) {
        return null;
      }

      clinicsMemoryCache.set(clinicsCacheKey, parsed);

      return parsed;
    } catch (error) {
      console.warn("Cache read error:", error);
      return null;
    }
  }

  function saveCache(data) {
    if (!clinicsCacheKey) return;

    const cache = {
      data,
      cachedAt: Date.now(),
    };

    clinicsMemoryCache.set(clinicsCacheKey, cache);

    try {
      sessionStorage.setItem(
        clinicsCacheKey,
        JSON.stringify(cache)
      );
    } catch (error) {
      console.warn("Cache save error:", error);
    }
  }

  // ------------------------------------
  // FETCH CLINICS
  // ------------------------------------

  useEffect(() => {
    if (sessionStatus === "loading") return;

    if (!sessionId) {
      setClinicsData([]);
      setFilteredClinics([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let inFlight = false;

    const cached = readCache();

    if (cached) {
      // Immediately display previously loaded clinics.
      setClinicsData(cached.data);
      setLoading(false);
      setError(null);
    } else {
      setLoading(true);
    }

    async function fetchClinics() {
      if (cancelled || inFlight) return;

      inFlight = true;

      try {
        const response = await fetch("/api/clinics", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch clinics");
        }

        const result = await response.json();

        if (
          !result.success ||
          !Array.isArray(result.clinics)
        ) {
          throw new Error("Invalid clinics response");
        }

        if (cancelled) return;

        // Update cache and UI only after successful response.
        saveCache(result.clinics);

        setClinicsData(result.clinics);
        setError(null);
      } catch (error) {
        console.error("Clinic fetch error:", error);

        if (!cancelled) {
          // Never remove previously displayed cached data.
          if (!cached) {
            const latestCache = readCache();

            if (latestCache) {
              setClinicsData(latestCache.data);
              setError(null);
            } else {
              setError(
                "Unable to load clinics. Please try again."
              );
            }
          }
        }
      } finally {
        inFlight = false;

        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    const isFresh =
      cached &&
      Date.now() - cached.cachedAt < CACHE_TTL;

    if (!isFresh) {
      fetchClinics();
    }

    const interval = setInterval(
      fetchClinics,
      REFRESH_INTERVAL
    );

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [sessionId, sessionStatus, clinicsCacheKey]);

  // ------------------------------------
  // CURRENT TIME
  // ------------------------------------

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 30_000);

    return () => clearInterval(interval);
  }, []);

  // ------------------------------------
  // USER COORDINATES
  // ------------------------------------

  const userCoordinates = useMemo(() => {
    const latitude = Number(session?.user?.latitude);
    const longitude = Number(session?.user?.longitude);

    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180
    ) {
      return {
        lat: latitude,
        lng: longitude,
      };
    }

    return null;
  }, [
    session?.user?.latitude,
    session?.user?.longitude,
  ]);

  // ------------------------------------
  // FILTER AND CALCULATE CLINIC DETAILS
  // ------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function loadFilteredClinics() {
      const matchingClinics = clinicsData.filter((clinic) =>
        matchesClinicSearch(clinic, search)
      );

      if (matchingClinics.length === 0) {
        setFilteredClinics([]);
        setDistanceLoading(false);
        return;
      }

      setDistanceLoading(Boolean(userCoordinates));

      try {
        const clinicsWithDetails = await Promise.all(
          matchingClinics.map(async (clinic) => {
            let roadDistance = null;

            if (
              userCoordinates &&
              clinic.lat != null &&
              clinic.lng != null
            ) {
              roadDistance = await calculateDistance(
                userCoordinates.lat,
                userCoordinates.lng,
                clinic.lat,
                clinic.lng
              );
            }

            const doctors = Array.isArray(clinic.doctors)
              ? clinic.doctors.filter(
                  (doctor) =>
                    doctor &&
                    doctor.isActive !== false
                )
              : [];

            const doctorsWithStatus = doctors.map(
              (doctor) => {
                const doctorStatus = getDoctorStatus(
                  doctor,
                  currentTime
                );

                const activeSlot = doctorStatus.currentSlot;

                const slotQueues = getDoctorSlotQueues(
                  doctor,
                  currentTime
                );

                const activeQueueInfo = activeSlot
                  ? calculateSlotQueue(
                      doctor,
                      activeSlot,
                      currentTime
                    )
                  : {
                      total: 0,
                      capacity: 0,
                      peopleAhead: 0,
                      waiting: 0,
                      serving: null,
                      completed: 0,
                      queue: [],
                      servingIndex: -1,
                      isStarted: false,
                      isFinished: false,
                      nextPatient: null,
                      estimatedWait: 0,
                    };

                return {
                  ...doctor,
                  id: getDoctorId(doctor),
                  peopleAhead:
                    activeQueueInfo.peopleAhead,
                  activeSlot,
                  activeQueueInfo,
                  slotQueues,
                  status: doctorStatus,
                };
              }
            );

            const clinicStatus = getClinicStatus(
              doctors,
              currentTime
            );

            return {
              ...clinic,
              distance: roadDistance?.distance ?? null,
              duration: roadDistance?.duration ?? null,
              isRoadDistance:
                roadDistance?.isRoadDistance ?? false,
              clinicStatus,
              doctors: doctorsWithStatus,
              doctorsWithStatus,
            };
          })
        );

        if (cancelled) return;

        clinicsWithDetails.sort((a, b) => {
          if (a.distance == null && b.distance == null) {
            return 0;
          }

          if (a.distance == null) return 1;
          if (b.distance == null) return -1;

          return a.distance - b.distance;
        });

        setFilteredClinics(clinicsWithDetails);
      } catch (error) {
        console.error(
          "Clinic processing error:",
          error
        );

        // Keep the previous clinic list if processing fails.
      } finally {
        if (!cancelled) {
          setDistanceLoading(false);
        }
      }
    }

    loadFilteredClinics();

    return () => {
      cancelled = true;
    };
  }, [
    clinicsData,
    search,
    userCoordinates,
    currentTime,
  ]);

  const shortLocation =
    location.split(",")[0].trim() || "Select Location";

  // ------------------------------------
  // RENDER
  // ------------------------------------

  if (sessionStatus === "loading") {
    return <LoadingScreen />;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <Header showBack={true} />

      <section className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">

        {/* PAGE HEADER */}

        <div className="mb-5 sm:mb-6">
          <div className="flex flex-col gap-4">

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
                  Clinics
                </span>

                <span className="text-xs text-gray-400">
                  {filteredClinics.length}{" "}
                  {filteredClinics.length === 1
                    ? "clinic"
                    : "clinics"} nearby
                </span>
              </div>

              <h2 className="mt-3 text-xl font-bold leading-tight text-gray-900 sm:text-2xl">
                Clinics & Doctor Specialists Near You
              </h2>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
                Find nearby clinics, compare doctors,
                check live queues, and book your consultation.
              </p>
            </div>

            {/* SEARCH AND LOCATION */}

            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">

              <div className="relative min-w-0 flex-1">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  placeholder="Search clinics, doctors or specialization..."
                  className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-10 text-sm text-gray-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                />

                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full p-1 text-gray-400 hover:bg-gray-100"
                    aria-label="Clear search"
                  >
                    <X size={17} />
                  </button>
                )}
              </div>

              <Link
                href="/profile"
className="flex h-12 w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-3.5 shadow-sm transition-all duration-150 hover:border-indigo-300 active:scale-95 active:bg-indigo-50 active:border-indigo-400 sm:w-auto sm:min-w-[230px]"              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
                  <MapPin
                    size={17}
                    className="text-indigo-600"
                  />
                </div>

                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800">
                  {shortLocation}
                </p>

                <ChevronRight
                  size={17}
                  className="shrink-0 text-gray-400"
                />
              </Link>
            </div>
          </div>
        </div>

        {/* DISTANCE STATUS */}

        {distanceLoading && filteredClinics.length > 0 && (
          <div className="mb-4 flex items-center gap-2 text-xs text-gray-500">
            <Loader2
              size={14}
              className="animate-spin text-indigo-600"
            />
            Updating clinic distances...
          </div>
        )}

        {/* ERROR */}

        {error && clinicsData.length === 0 && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-12 text-center">
            <h3 className="text-base font-semibold text-red-900">
              Failed to load clinics
            </h3>

            <p className="mt-1 text-sm text-red-600">
              {error}
            </p>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}

        {/* INITIAL LOADING */}

        {loading &&
          clinicsData.length === 0 &&
          !error && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-5 py-16 shadow-sm">
              <Loader2
                size={32}
                className="animate-spin text-indigo-600"
              />

              <h3 className="mt-4 text-base font-semibold text-gray-900">
                Loading clinics...
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Please wait while we retrieve clinic information.
              </p>
            </div>
          )}

        {/* EMPTY DATABASE */}

        {!loading &&
          !error &&
          clinicsData.length === 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white px-5 py-12 text-center">
              <Search
                size={25}
                className="mx-auto text-gray-400"
              />

              <h3 className="mt-4 text-base font-semibold text-gray-900">
                No clinics available
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                No clinics have been registered yet.
              </p>
            </div>
          )}

        {/* NO SEARCH RESULTS */}

        {!loading &&
          clinicsData.length > 0 &&
          filteredClinics.length === 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white px-5 py-12 text-center">
              <Search
                size={25}
                className="mx-auto text-gray-400"
              />

              <h3 className="mt-4 text-base font-semibold text-gray-900">
                No clinics found
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Try another clinic name, doctor or specialization.
              </p>

              <button
                type="button"
                onClick={() => setSearch("")}
                className="mt-4 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Clear Search
              </button>
            </div>
          )}

        {/* CLINIC LIST */}

        {filteredClinics.length > 0 && (
          <div className="space-y-5">
            {filteredClinics.map((clinic) => (
              <div
                key={clinic._id}
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:border-indigo-200 hover:shadow-md"
              >
                {/* CLINIC HEADER */}

                <div className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold tracking-tight text-gray-900">
                          {clinic.name}
                        </h3>

                        {clinic.rating && (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">
                            <Star
                              size={12}
                              fill="currentColor"
                            />
                            {clinic.rating}
                          </span>
                        )}

                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            clinic.clinicStatus?.isOpen
                              ? "bg-green-50 text-green-700"
                              : "bg-red-50 text-red-600"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              clinic.clinicStatus?.isOpen
                                ? "bg-green-500"
                                : "bg-red-500"
                            }`}
                          />

                          {clinic.clinicStatus?.status}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                        <div className="flex min-w-0 items-center gap-1.5 text-xs text-gray-500">
                          <MapPin
                            size={14}
                            className="shrink-0 text-red-500"
                          />

                          <span>
                            {clinic.address}
                          </span>
                        </div>

                        {clinic.distance != null && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-[10px] font-semibold text-gray-600">
                            <MapPin size={10} />

                            {clinic.distance < 1
                              ? `${Math.round(
                                  clinic.distance * 1000
                                )} m away`
                              : `${clinic.distance.toFixed(
                                  1
                                )} km away`}

                            {!clinic.isRoadDistance && (
                              <span className="text-gray-400">
                                (approx.)
                              </span>
                            )}
                          </span>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <div className="inline-flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-2">
                          <Stethoscope
                            size={15}
                            className="text-indigo-600"
                          />

                          <p className="text-xs font-bold text-indigo-800">
                            {clinic.doctors?.length || 0}{" "}
                            Doctors
                          </p>
                        </div>

                        <div
                          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 ${
                            clinic.clinicStatus?.isOpen
                              ? "border-green-100 bg-green-50/70"
                              : "border-red-100 bg-red-50/70"
                          }`}
                        >
                          <Clock size={15} />

                          <p className="text-xs font-semibold">
                            {clinic.clinicStatus?.timeText}
                          </p>
                        </div>
                      </div>
                    </div>

                    <Link
                      href={`/services/clinics/${clinic._id}`}
                      className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-xs font-bold text-white transition hover:bg-indigo-700 sm:w-auto"
                    >
                      View Doctors
                      <ChevronRight size={15} />
                    </Link>
                  </div>
                </div>

                {/* DOCTOR SECTION */}

                <div className="border-t border-gray-100 bg-gray-50/70 p-4 sm:p-5">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-gray-800">
                        Available Doctors
                      </h4>

                      <p className="mt-0.5 text-[10px] text-gray-400">
                        Check live queues and appointment slots
                      </p>
                    </div>

                    <span className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-[10px] font-semibold text-gray-500">
                      {clinic.doctorsWithStatus?.length || 0} Listed
                    </span>
                  </div>

                  {clinic.doctorsWithStatus?.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                      {clinic.doctorsWithStatus.map((doctor) => (
                        <div
                          key={getDoctorId(doctor)}
                          className="min-w-0 rounded-xl border border-gray-200 bg-white p-3.5 sm:p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <div
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                                  doctor.status?.isOpen
                                    ? "bg-green-50 text-green-600"
                                    : "bg-gray-100 text-gray-500"
                                }`}
                              >
                                <Stethoscope size={17} />
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-gray-900">
                                  {doctor.name}
                                </p>

                                <p className="truncate text-[11px] text-gray-500">
                                  {doctor.specialization ||
                                    "General Physician"}
                                </p>
                              </div>
                            </div>

                            <span
                              className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold ${
                                doctor.status?.isOpen
                                  ? "bg-green-50 text-green-700"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {doctor.status?.status}
                            </span>
                          </div>

                          {doctor.slotQueues?.length > 0 ? (
                            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                              {doctor.slotQueues.map(
                                ({ slot, queueInfo }) => {
                                  const isCurrentSlot =
                                    doctor.activeSlot?.open ===
                                      slot.open &&
                                    doctor.activeSlot?.close ===
                                      slot.close;

                                  return (
                                    <div
                                      key={getSlotKey(slot)}
                                      className={`min-w-0 rounded-xl border p-3 ${
                                        isCurrentSlot
                                          ? "border-green-200 bg-green-50/60"
                                          : "border-gray-100 bg-gray-50/70"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5">
                                          <Clock
                                            size={13}
                                            className="text-gray-400"
                                          />

                                          <span className="text-[11px] font-bold text-gray-700">
                                            {formatTime(slot.open)} -{" "}
                                            {formatTime(slot.close)}
                                          </span>
                                        </div>

                                        {isCurrentSlot && (
                                          <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[8px] font-bold text-green-700">
                                            NOW
                                          </span>
                                        )}
                                      </div>

                                      <div className="mt-3 flex items-center justify-between gap-2">
                                        <div className="flex min-w-0 items-center gap-2">
                                          <Users
                                            size={15}
                                            className="shrink-0 text-orange-500"
                                          />

                                          <div>
                                            <p className="text-[11px] font-bold text-gray-700">
                                              {queueInfo.peopleAhead === 0
                                                ? "No one ahead"
                                                : `${queueInfo.peopleAhead} people ahead`}
                                            </p>

                                            <p className="text-[9px] text-gray-400">
                                              {queueInfo.total}/
                                              {queueInfo.capacity} booked
                                            </p>
                                          </div>
                                        </div>

                                        {isCurrentSlot &&
                                          doctor.status?.isOpen &&
                                          !doctor.status?.isHoliday &&
                                          doctor.isEmergency !== true && (
                                            <Link
                                              href={`/services/clinics/${clinic._id}/emergency?doctor=${encodeURIComponent(
                                                getDoctorId(doctor)
                                              )}`}
                                              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-red-600 px-2.5 py-2 text-[9px] font-bold text-white hover:bg-red-700"
                                            >
                                              <Zap size={11} />
                                              Emergency
                                            </Link>
                                          )}
                                      </div>

                                      {isCurrentSlot &&
                                        queueInfo.serving && (
                                          <div className="mt-2 flex items-center gap-2 rounded-lg border border-green-100 bg-white/80 px-2 py-1.5">
                                            <Activity
                                              size={12}
                                              className="text-green-600"
                                            />

                                            <p className="truncate text-[10px] text-green-700">
                                              Serving:{" "}
                                              {getPriorityRank(
                                                queueInfo.serving
                                              ) === 0
                                                ? "Emergency Patient"
                                                : queueInfo.serving
                                                    ?.patient?.name ||
                                                  "Patient"}
                                            </p>
                                          </div>
                                        )}
                                    </div>
                                  );
                                }
                              )}
                            </div>
                          ) : (
                            <div className="mt-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-center">
                              <Clock
                                size={17}
                                className="mx-auto text-gray-400"
                              />

                              <p className="mt-1 text-[11px] font-medium text-gray-500">
                                {doctor.status?.timeText ||
                                  "No active appointment slots"}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-7 text-center">
                      <Stethoscope
                        size={22}
                        className="mx-auto text-gray-300"
                      />

                      <p className="mt-2 text-xs font-semibold text-gray-600">
                        No doctors listed
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <GoUpButton />
    </main>
  );
}