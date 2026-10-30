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

  const [latitude1, longitude1, latitude2, longitude2] =
    coordinates;

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

function formatTime(time) {
  if (!time) return "";

  const value = String(time).trim();

  if (!value.includes("AM") && !value.includes("PM")) {
    const parts = value.split(":");
    let hour = Number(parts[0]);
    const minute = Number(parts[1] || 0);

    const suffix = hour >= 12 ? "PM" : "AM";

    hour = hour % 12 || 12;

    return `${hour}:${String(minute).padStart(
      2,
      "0"
    )} ${suffix}`;
  }

  const [timePart, period] = value.split(/\s+/);

  let [hour, minute] = timePart
    .split(":")
    .map(Number);

  if (period === "AM" && hour === 12) {
    hour = 0;
  }

  if (period === "PM" && hour !== 12) {
    hour += 12;
  }

  const suffix = hour >= 12 ? "PM" : "AM";
  const formattedHour = hour % 12 || 12;

  return `${formattedHour}:${String(minute).padStart(
    2,
    "0"
  )} ${suffix}`;
}

function getMinutes(time) {
  if (!time) return null;

  const value = String(time).trim().toUpperCase();

  const match = value.match(
    /^(\d{1,2})(?::(\d{1,2}))?\s*(AM|PM)?$/
  );

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

  // Only today's active holiday matters.
  // Past holiday dates are automatically ignored.
  return holidayDates.some(
    (holiday) =>
      typeof holiday === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(holiday) &&
      holiday === today
  );
}

function getDaySchedule(schedule, day) {
  if (!schedule || !day) return null;

  // Supports both Monday and monday in MongoDB.
  return (
    schedule[day] ||
    schedule[day.toLowerCase()] ||
    schedule[
      day.charAt(0).toLowerCase() + day.slice(1)
    ] ||
    null
  );
}

function getDoctorSlotQueues(doctor, date = new Date()) {
  const today = getTodayKey(date);
  
  if (isDoctorOnHoliday(doctor, date)) {
    return [];
  }

    const todaySchedule = getDaySchedule(doctor?.schedule, today);

  if (
    !todaySchedule?.active ||
    !Array.isArray(todaySchedule.slots)
  ) {
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
  const todayKey = getIndiaDateKey(now);

  // 1. Holiday check takes priority over the weekly schedule.
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

  // 2. Check the weekly schedule.
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

  // 3. Get today's active sessions.
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

  // Use Indian local time for the session comparison.
  const indiaTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);

  const [hour, minute] = indiaTime.split(":").map(Number);
  const currentMinutes = hour * 60 + minute;

  // 4. Open only while an active session is running.
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

  // 5. Find the next session today.
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
    .sort(
      (a, b) => getMinutes(a.open) - getMinutes(b.open)
    )[0];

  if (nextSlot) {
    return {
      isOpen: false,
      status: "Closed Now",
      timeText: `Opens today at ${formatTime(nextSlot.open)}`,
      openDoctors: [],
      doctorStatuses,
    };
  }

  const allOnHoliday = doctorStatuses.every(
    (item) => item.status.isHoliday
  );

  return {
    isOpen: false,
    status: allOnHoliday
      ? "Closed Today"
      : "Closed Today",
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
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    date.getDate()
  ).padStart(2, "0");

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



function getSequence(booking) {
  const sequence = Number(booking?.sequence);

  if (Number.isFinite(sequence)) {
    return sequence;
  }

  return Number.MAX_SAFE_INTEGER;
}

function getCreatedAt(booking) {
  if (!booking?.createdAt) {
    return 0;
  }

  const time = new Date(
    booking.createdAt
  ).getTime();

  return Number.isFinite(time) ? time : 0;
}

function sortQueue(bookings) {
  return [...bookings].sort((a, b) => {
    const priorityDifference =
      getPriorityRank(a) -
      getPriorityRank(b);

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

    const createdA = new Date(
      a?.createdAt || 0
    ).getTime();

    const createdB = new Date(
      b?.createdAt || 0
    ).getTime();

    return createdA - createdB;
  });
}

function getSlotBookings(
  doctor,
  dateKey,
  slot
) {
  if (!doctor?.bookings?.length) {
    return [];
  }

  const slotKey = getSlotKey(slot);

  return doctor.bookings.filter(
    (booking) => {
      if (
        getBookingDateKey(booking) !==
        dateKey
      ) {
        return false;
      }

      if (
        booking?.status === "cancelled"
      ) {
        return false;
      }

      if (
        booking?.status === "no-show"
      ) {
        return false;
      }

      return (
        getSlotKey(booking.slot) ===
        slotKey
      );
    }
  );
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
    (booking) =>
      String(booking.status || "").toLowerCase() === "completed"
  );

  const checkupStart = getMinutes(
    slot.checkupStartTime || slot.open
  );

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

  if (checkupStart == null || closeTime == null) {
    return {
      ...emptyQueue,
      peopleAhead: queue.length,
      waiting: queue.length,
      nextPatient: queue[0] || null,
    };
  }

  if (!isToday) {
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

  // Start from the slot opening/checkup time, unless the first
  // booking was made later during today's slot.
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

      return (
        createdAt.getHours() * 60 +
        createdAt.getMinutes()
      );
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
      estimatedWait: queue.length
        ? queueStart - currentMinutes
        : 0,
    };
  }

  
  const calculatedIndex = Math.floor(
    (currentMinutes - queueStart) / duration
  );

  // Never show a serving patient when there are no active bookings.
  if (queue.length === 0) {
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

  if (calculatedIndex >= queue.length) {
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
  const waiting = Math.max(
    0,
    queue.length - servingIndex - 1
  );

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



export default function ClinicsPage() {
  const { data: session } =
    useSession();

  const [location, setLocation] =
    useState("Select Location");

  const [search, setSearch] =
    useState("");

  const [currentTime, setCurrentTime] =
    useState(new Date());

  const [clinicsData, setClinicsData] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState(null);

    const [filteredClinics, setFilteredClinics] = useState([]);
const [distanceLoading, setDistanceLoading] = useState(false);

  const CLINICS_CACHE_TTL = 20_000; // 20 seconds

let clinicsMemoryCache = new Map();

function getClinicsCacheKey(sessionId) {
  return `zeric-clinics-cache-${sessionId}`;
}

const sessionId = session?.user?.id;

const clinicsCacheKey = sessionId
  ? getClinicsCacheKey(sessionId)
  : null;

useEffect(() => {
  if (!clinicsCacheKey) {
    // Don't reuse one user's cache for another user or a guest.
    setClinicsData([]);
    setLoading(false);
    return;
  }

  let cancelled = false;
  let inFlight = false;
  let hasDisplayedData = false;

  function readCache() {
    const memoryCache = clinicsMemoryCache.get(clinicsCacheKey);

    if (memoryCache) {
      return memoryCache;
    }

    try {
      const saved = sessionStorage.getItem(clinicsCacheKey);

      if (saved) {
        const parsed = JSON.parse(saved);

        if (
          Array.isArray(parsed.data) &&
          Number.isFinite(parsed.cachedAt)
        ) {
          clinicsMemoryCache.set(clinicsCacheKey, parsed);
          return parsed;
        }
      }
    } catch (error) {
      console.warn("Unable to read clinic cache:", error);
    }

    return null;
  }

  async function fetchClinics() {
    if (cancelled || inFlight) return;

    inFlight = true;

    try {
      const response = await fetch("/api/clinics", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch clinics");
      }

      const result = await response.json();
   
      

      if (!result.success || !Array.isArray(result.clinics)) {
        throw new Error("Invalid clinics response");
      }

     
      

      if (cancelled) return;

      const cache = {
        data: result.clinics,
        cachedAt: Date.now(),
      };

      setClinicsData(cache.data);
      clinicsMemoryCache.set(clinicsCacheKey, cache);
      hasDisplayedData = true;
      setError(null);

      try {
        sessionStorage.setItem(
          clinicsCacheKey,
          JSON.stringify(cache)
        );
      } catch (error) {
        console.warn("Unable to save clinic cache:", error);
      }
    } catch (error) {
      console.error("Error fetching clinics:", error);

      if (!cancelled && !hasDisplayedData) {
        setError("An error occurred while loading clinics.");
      }
    } finally {
      inFlight = false;

      if (!cancelled) setLoading(false);
    }
  }

  const cached = readCache();

  if (cached) {
    setClinicsData(cached.data);
    setLoading(false);
    hasDisplayedData = true;
  }

  const cacheIsFresh =
    cached &&
    Date.now() - cached.cachedAt < CLINICS_CACHE_TTL;

  if (!cacheIsFresh) {
    fetchClinics();
  }

  const timer = setInterval(fetchClinics, 20_000);

  return () => {
    cancelled = true;
    clearInterval(timer);
  };
}, [clinicsCacheKey]);

  useEffect(() => {
    const savedLocation =
      localStorage.getItem(
        "Zeric-location"
      );

    if (!savedLocation) return;

    try {
      const parsed =
        JSON.parse(savedLocation);


      if (
        parsed &&
        typeof parsed === "object"
      ) {
        setLocation(
          parsed.name ||
            parsed.address ||
            parsed.location ||
            parsed.display_name ||
            "Selected Location"
        );
      } else {
        setLocation(
          String(savedLocation)
        );
      }
    } catch {
      setLocation(savedLocation);
    }
  }, []);

  useEffect(() => {
    const timer =
      setInterval(() => {
        setCurrentTime(
          new Date()
        );
      }, 1000);

    return () =>
      clearInterval(timer);
  }, []);

  const userCoordinates =
    useMemo(() => {
      const latitude = Number(
        session?.user?.latitude
      );

      const longitude = Number(
        session?.user?.longitude
      );

      if (
        Number.isFinite(
          latitude
        ) &&
        Number.isFinite(
          longitude
        )
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

useEffect(() => {
  let cancelled = false;

  async function loadFilteredClinics() {
    const searchText = search.trim().toLowerCase();

    // Filter clinics by clinic name or doctor name first.
    const matchingClinics = clinicsData.filter((clinic) => {
      if (!searchText) return true;

      const clinicName = clinic.name?.toLowerCase() || "";

      const doctorMatches = (clinic.doctors || []).some((doctor) =>
        doctor.name?.toLowerCase().includes(searchText)
      );

      return clinicName.includes(searchText) || doctorMatches;
    });

    if (cancelled) return;

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
              Number(clinic.lat),
              Number(clinic.lng)
            );
          }

          // Keep your existing doctor status and queue calculations.
          const doctors = Array.isArray(clinic.doctors)
            ? clinic.doctors.filter(
                (doctor) => doctor && doctor.isActive !== false
              )
            : [];

          const doctorsWithStatus = doctors.map((doctor) => {
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
              peopleAhead: activeQueueInfo.peopleAhead,
              activeSlot,
              activeQueueInfo,
              slotQueues,
              status: doctorStatus,
            };
          });

          const clinicStatus = getClinicStatus(
            doctors,
            currentTime
          );

          return {
            ...clinic,

            // Road distance, not straight-line distance.
            distance: roadDistance?.distance ?? null,
            duration: roadDistance?.duration ?? null,

            clinicStatus,
            doctorsWithStatus,
          };
        })
      );

      if (cancelled) return;

      // Sort nearest clinics first using road distance.
      clinicsWithDetails.sort((a, b) => {
        if (a.distance == null && b.distance == null) return 0;
        if (a.distance == null) return 1;
        if (b.distance == null) return -1;

        return a.distance - b.distance;
      });

      setFilteredClinics(clinicsWithDetails);
    } catch (error) {
      console.error("Error calculating clinic distances:", error);

      if (!cancelled) {
        setFilteredClinics([]);
      }
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
    location
      .split(",")[0]
      .trim() ||
    "Select Location";

  return (
    <main className="min-h-screen bg-gray-50">
      <Header showBack={true} />

      <section className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-5 sm:mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
                  Clinics
                </span>

                <span className="text-xs text-gray-400">
                  {
                    filteredClinics.length
                  }{" "}
                  {filteredClinics.length ===
                  1
                    ? "clinic"
                    : "clinics"}{" "}
                  nearby
                </span>
              </div>

              <h2 className="mt-3 text-xl font-bold leading-tight text-gray-900 sm:text-2xl">
                Clinics & Doctor
                Specialists Near You
              </h2>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
                Find nearby clinics,
                compare doctors, check
                live queues, and book
                your consultation
                without waiting in long
                queues.
              </p>
            </div>

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
                    setSearch(
                      e.target.value
                    )
                  }
                  placeholder="Search here..."
                  className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-10 text-sm text-gray-800 shadow-sm outline-none transition-all duration-200 placeholder:text-gray-400 hover:border-gray-300 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                />

                {search && (
                  <button
                    type="button"
                    onClick={() =>
                      setSearch("")
                    }
                    className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                    aria-label="Clear search"
                  >
                    <X size={17} />
                  </button>
                )}
              </div>

              <div className="group relative w-full sm:w-auto">
                <Link
                  href="/profile"
                  className="flex h-12 w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-3.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md active:translate-y-0 sm:min-w-[230px]"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
                    <MapPin
                      size={17}
                      className="text-indigo-600"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-800">
                      {shortLocation}
                    </p>
                  </div>

                  <ChevronRight
                    size={17}
                    className="shrink-0 text-gray-400 transition-all duration-200 group-hover:translate-x-1 group-hover:text-indigo-500"
                  />
                </Link>

                {location !==
                  "Select Location" && (
                  <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden -translate-x-1/2 translate-y-1 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 sm:block">
                    <div className="relative max-w-[280px] whitespace-normal break-words rounded-lg bg-gray-900 px-3 py-2 text-center text-xs font-medium leading-5 text-white shadow-lg">
                      {location}

                      <div className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 bg-gray-900" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-12 text-center shadow-sm">
            <h3 className="text-base font-semibold text-red-900">
              Failed to load clinics
            </h3>

            <p className="mt-1 text-sm text-red-600">
              {error}
            </p>
          </div>
        ) : filteredClinics.length ===
          0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-12 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <Search
                size={21}
                className="text-gray-400"
              />
            </div>

            <h3 className="mt-4 text-base font-semibold text-gray-900">
              No clinics found
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              Try searching with a
              different clinic name.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredClinics.map(
              (clinic) => (
                <div
                  key={clinic._id}
                  className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:border-indigo-200 hover:shadow-md sm:p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-gray-900 sm:text-lg">
                          {clinic.name}
                        </h3>

                      {clinic.rating &&  (<span className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          ★{" "}
                          {clinic.rating}
                        </span>)
                        }

                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            clinic
                              .clinicStatus
                              .isOpen
                              ? "bg-green-50 text-green-700"
                              : "bg-red-50 text-red-600"
                          }`}
                        >
                          {
                            clinic
                              .clinicStatus
                              .status
                          }
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <MapPin
                            size={16}
                            className="shrink-0 text-red-500"
                          />

                          <span>
                            {clinic.address}
                          </span>
                        </div>

                        {clinic.distance !==
                          null && (
                          <span className="rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                            {clinic.distance <
                            1
                              ? `${Math.round(
                                  clinic.distance *
                                    1000
                                )} m away`
                              : `${clinic.distance.toFixed(
                                  1
                                )} km away`}
                          </span>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
                          <Stethoscope
                            size={15}
                          />

                          <span>
                            {clinic
                              .doctors
                              ?.length ||
                              0}{" "}
                            {clinic
                              .doctors
                              ?.length ===
                            1
                              ? "Doctor"
                              : "Doctors"}
                          </span>
                        </div>

                        <div
                          className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                            clinic
                              .clinicStatus
                              .isOpen
                              ? "bg-green-50 text-green-700"
                              : "bg-red-50 text-red-600"
                          }`}
                        >
                          <Clock
                            size={15}
                          />

                          <span>
                            {
                              clinic
                                .clinicStatus
                                .timeText
                            }
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {clinic.doctorsWithStatus.map(
                          (doctor) => (
                            <div
                            
key={getDoctorId(doctor)}

                              className="rounded-xl border border-gray-100 bg-gray-50 p-3"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span
                                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                                      doctor
                                        .status
                                        .isOpen
                                        ? "bg-green-500"
                                        : "bg-gray-400"
                                    }`}
                                  />

                                  <p className="truncate text-xs font-bold text-gray-800">
                                    {
                                      doctor.name
                                    }
                                  </p>
                                </div>

                                <span className="max-w-[120px] truncate text-[11px] font-medium text-gray-500">
                                  {
                                    doctor.specialization
                                  }
                                </span>
                              </div>

                              {doctor.slotQueues
                                .length >
                              0 ? (
                                <div className="mt-2 space-y-1.5">
                                  {doctor.slotQueues.map(
                                    ({
                                      slot,
                                      queueInfo,
                                    }) => {
                                      const isCurrentSlot =
                                        doctor
                                          .activeSlot
                                          ?.open ===
                                          slot.open &&
                                        doctor
                                          .activeSlot
                                          ?.close ===
                                          slot.close;

                                      return (
                                        <div
                                          key={`${slot.open}-${slot.close}`}
                                          className={`rounded-lg border px-2.5 py-2 ${
                                            isCurrentSlot
                                              ? "border-green-200 bg-green-50/60"
                                              : "border-gray-200 bg-white"
                                          }`}
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="text-[11px] font-medium text-gray-600">
                                              {formatTime(
                                                slot.open
                                              )}{" "}
                                              -
                                              {" "}
                                              {formatTime(
                                                slot.close
                                              )}
                                            </span>

                                            {isCurrentSlot && (
                                              <span className="rounded bg-green-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                                                NOW
                                              </span>
                                            )}
                                          </div>

                                        <div className="mt-1 flex items-center justify-between gap-2">
  <p
    className={`text-[11px] font-semibold ${
      queueInfo.peopleAhead > 0
        ? "text-orange-600"
        : "text-green-600"
    }`}
  >
    {queueInfo.peopleAhead === 0
      ? "No one ahead"
      : `${queueInfo.peopleAhead} ${
          queueInfo.peopleAhead === 1
            ? "person"
            : "people"
        } ahead`}
  </p>

{isCurrentSlot &&
  doctor.status.isOpen &&
  !doctor.status.isHoliday && (

<Link
  href={`/services/clinics/${clinic._id}/emergency?doctor=${encodeURIComponent(
    getDoctorId(doctor)
  )}`}
  className="rounded-md bg-red-600 relative -top-3 left-2 px-2.5 py-1.5 text-[10px] font-bold text-white transition hover:bg-red-700 active:scale-95"
>
  Emergency Book
</Link>

)}

  <span className="text-[10px] text-gray-400">
    {queueInfo.total}/{queueInfo.capacity} booked
  </span>
</div>

                                          {isCurrentSlot &&
                                            queueInfo.serving && (
                                              <div className="mt-1.5 text-[10px] font-medium text-green-700">
                                                Serving:
                                                {" "}
                                                {
                                                  queueInfo
                                                    .serving
                                                    ?.patient
                                                    ?.name
                                                }
                                              </div>
                                            )}

                                          {isCurrentSlot &&
                                            queueInfo.estimatedWait >
                                              0 && (
                                              <div className="mt-1 text-[10px] font-medium text-gray-500">
                                                Estimated wait:
                                                {" "}
                                                {
                                                  queueInfo.estimatedWait
                                                }{" "}
                                                min
                                              </div>
                                            )}

                                        
                                        </div>
                                      );
                                    }
                                  )}
                                </div>
                              ) : (
                                <p className="mt-2 text-[11px] font-medium text-red-500">
                                  {
                                    doctor
                                      .status
                                      .status
                                  }
                                </p>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    <div className="w-full lg:w-auto lg:shrink-0 lg:self-center">
                      <Link
                        href={`/services/clinics/${clinic._id}`}
                        className="flex h-11 w-full items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-indigo-700 hover:shadow-md active:scale-[0.98] lg:w-auto"
                      >
                        View Doctors
                        <span className="ml-2">
                          →
                        </span>
                      </Link>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </section>

      <GoUpButton />
    </main> 
  );
}