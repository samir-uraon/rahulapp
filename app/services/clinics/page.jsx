"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Header from "@/components/Header";
import GoUpButton from "@/components/GoUpButton";

import {
  MapPin,
  Search,
  ChevronRight,
  X,
  Clock,
  Stethoscope,
  Loader2,
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

  const earthRadius = 6371;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  const c =
    2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
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

function getTodayKey(date = new Date()) {
  const days = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];

  return days[date.getDay()];
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

  if (calculatedIndex >= queue.length) {
    return {
      ...emptyQueue,
      isStarted: true,
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

function getDoctorSlotQueues(
  doctor,
  date = new Date()
) {
  const today =
    getTodayKey(date);

  const todaySchedule =
    doctor?.schedule?.[today];

  if (
    !todaySchedule?.active ||
    !Array.isArray(
      todaySchedule.slots
    )
  ) {
    return [];
  }

  return todaySchedule.slots.map(
    (slot) => ({
      slot,
      queueInfo:
        calculateSlotQueue(
          doctor,
          slot,
          date
        ),
    })
  );
}

function getDoctorStatus(
  schedule,
  now = new Date()
) {
  const today =
    getTodayKey(now);

  const todaySchedule =
    schedule?.[today];

  if (!todaySchedule?.active) {
    return {
      isOpen: false,
      status: "Closed Today",
      timeText: "Closed Today",
      schedule:
        todaySchedule || null,
      currentSlot: null,
      nextSlot: null,
    };
  }

  const slots =
    Array.isArray(
      todaySchedule.slots
    )
      ? todaySchedule.slots
      : [];

  if (slots.length === 0) {
    return {
      isOpen: false,
      status: "Closed Today",
      timeText: "Closed Today",
      schedule: todaySchedule,
      currentSlot: null,
      nextSlot: null,
    };
  }

  const currentMinutes =
    now.getHours() * 60 +
    now.getMinutes();

  const currentSlot =
    slots.find((slot) => {
      const openMinutes =
        getMinutes(slot.open);

      const closeMinutes =
        getMinutes(slot.close);

      if (
        openMinutes == null ||
        closeMinutes == null
      ) {
        return false;
      }

      return (
        currentMinutes >=
          openMinutes &&
        currentMinutes <
          closeMinutes
      );
    });

  if (currentSlot) {
    return {
      isOpen: true,
      status: "Open Now",
      timeText: `Today: ${formatTime(
        currentSlot.open
      )} - ${formatTime(
        currentSlot.close
      )}`,
      schedule: todaySchedule,
      currentSlot,
      nextSlot: null,
    };
  }

  const upcomingSlots =
    slots
      .filter((slot) => {
        const open =
          getMinutes(slot.open);

        return (
          open != null &&
          open > currentMinutes
        );
      })
      .sort(
        (a, b) =>
          getMinutes(a.open) -
          getMinutes(b.open)
      );

  if (upcomingSlots.length > 0) {
    const nextSlot =
      upcomingSlots[0];

    return {
      isOpen: false,
      status: "Closed Now",
      timeText: `Opens today at ${formatTime(
        nextSlot.open
      )}`,
      schedule: todaySchedule,
      currentSlot: null,
      nextSlot,
    };
  }

  return {
    isOpen: false,
    status: "Closed Now",
    timeText: "Closed Now",
    schedule: todaySchedule,
    currentSlot: null,
    nextSlot: null,
  };
}

function getClinicStatus(
  doctors,
  now = new Date()
) {
  if (!doctors?.length) {
    return {
      isOpen: false,
      status: "Closed Today",
      timeText:
        "No doctors available",
      openDoctors: [],
      doctorStatuses: [],
    };
  }

  const doctorStatuses =
    doctors.map((doctor) => ({
      doctor,
      status: getDoctorStatus(
        doctor.schedule,
        now
      ),
    }));

  const openDoctors =
    doctorStatuses.filter(
      (item) =>
        item.status.isOpen
    );

  if (openDoctors.length > 0) {
    return {
      isOpen: true,
      status: "Open Now",
      timeText: `${openDoctors.length} ${
        openDoctors.length === 1
          ? "doctor"
          : "doctors"
      } available now`,
      openDoctors:
        openDoctors.map(
          (item) => item.doctor
        ),
      doctorStatuses,
    };
  }

  const today =
    getTodayKey(now);

  const currentMinutes =
    now.getHours() * 60 +
    now.getMinutes();

  const upcomingDoctors =
    doctorStatuses
      .map((item) => {
        const schedule =
          item.doctor.schedule?.[
            today
          ];

        if (!schedule?.active) {
          return null;
        }

        const slots =
          Array.isArray(
            schedule.slots
          )
            ? schedule.slots
            : [];

        const upcomingSlots =
          slots
            .filter((slot) => {
              const open =
                getMinutes(
                  slot.open
                );

              return (
                open != null &&
                open >
                  currentMinutes
              );
            })
            .sort(
              (a, b) =>
                getMinutes(a.open) -
                getMinutes(b.open)
            );

        if (
          upcomingSlots.length === 0
        ) {
          return null;
        }

        return {
          ...item,
          nextSlot:
            upcomingSlots[0],
        };
      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          getMinutes(
            a.nextSlot.open
          ) -
          getMinutes(
            b.nextSlot.open
          )
      );

  if (
    upcomingDoctors.length > 0
  ) {
    const nextDoctor =
      upcomingDoctors[0];

    return {
      isOpen: false,
      status: "Closed Now",
      timeText: `Opens today at ${formatTime(
        nextDoctor.nextSlot.open
      )}`,
      openDoctors: [],
      doctorStatuses,
    };
  }

  const hasTodaySchedule =
    doctorStatuses.some(
      (item) => {
        const schedule =
          item.doctor.schedule?.[
            today
          ];

        return (
          schedule?.active &&
          Array.isArray(
            schedule.slots
          ) &&
          schedule.slots.length > 0
        );
      }
    );

  if (hasTodaySchedule) {
    return {
      isOpen: false,
      status: "Closed Today",
      timeText:
        "All doctors have closed for today",
      openDoctors: [],
      doctorStatuses,
    };
  }

  return {
    isOpen: false,
    status: "Closed Today",
    timeText:
      "No doctor available today",
    openDoctors: [],
    doctorStatuses: [],
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
    useState(true);

  const [error, setError] =
    useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchClinics() {
      try {
        const res =
          await fetch(
            "/api/clinics",
            {
              method: "GET",
              cache: "no-store",
            }
          );

        if (!res.ok) {
          throw new Error(
            "Failed to fetch clinics"
          );
        }

        const data =
          await res.json();

        if (
          !cancelled &&
          data.success
        ) {
          setClinicsData(
            data.clinics || []
          );
          setError(null);
        }

        if (
          !cancelled &&
          !data.success
        ) {
          setError(
            data.message ||
              "Failed to fetch clinics"
          );
        }
      } catch (err) {
        console.error(
          "Error fetching clinics:",
          err
        );

        if (!cancelled) {
          setError(
            "An error occurred while loading clinics."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchClinics();

    const refreshTimer =
      setInterval(
        fetchClinics,
        20000
      );

    return () => {
      cancelled = true;
      clearInterval(
        refreshTimer
      );
    };
  }, []);

  useEffect(() => {
    const savedLocation =
      localStorage.getItem(
        "queueease-location"
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

  const filteredClinics =
    useMemo(() => {
      const searchText =
        search
          .trim()
          .toLowerCase();

      return clinicsData
        .map((clinic) => {
          const distance =
            userCoordinates &&
            clinic.lat != null &&
            clinic.lng != null
              ? calculateDistance(
                  userCoordinates.lat,
                  userCoordinates.lng,
                  Number(clinic.lat),
                  Number(clinic.lng)
                )
              : null;

          const doctorsWithStatus =
            (
              clinic.doctors ||
              []
            ).map((doctor) => {
              const doctorStatus =
                getDoctorStatus(
                  doctor.schedule,
                  currentTime
                );

              const activeSlot =
                doctorStatus.currentSlot;

              const slotQueues =
                getDoctorSlotQueues(
                  doctor,
                  currentTime
                );

              const activeQueueInfo =
                activeSlot
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
                      servingIndex:
                        -1,
                      isStarted: false,
                      isFinished: false,
                      nextPatient: null,
                      estimatedWait: 0,
                    };

              return {
                ...doctor,
                peopleAhead:
                  activeQueueInfo.peopleAhead,
                activeSlot,
                activeQueueInfo,
                slotQueues,
                status:
                  doctorStatus,
              };
            });

          const clinicStatus =
            getClinicStatus(
              clinic.doctors,
              currentTime
            );

          return {
            ...clinic,
            distance,
            clinicStatus,
            doctorsWithStatus,
          };
        })
        .filter((clinic) => {
  if (!searchText) return true;

  const clinicName = clinic.name?.toLowerCase() || "";

  const doctorMatches = (clinic.doctors || []).some((doctor) =>
    doctor.name?.toLowerCase().includes(searchText)
  );

  return clinicName.includes(searchText) || doctorMatches;
})
        .sort((a, b) => {
          if (
            a.distance === null &&
            b.distance === null
          ) {
            return 0;
          }

          if (a.distance === null) {
            return 1;
          }

          if (b.distance === null) {
            return -1;
          }

          return (
            a.distance -
            b.distance
          );
        });
    }, [
      search,
      userCoordinates,
      currentTime,
      clinicsData,
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

        {loading ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-5 py-16 shadow-sm">
            <Loader2
              size={32}
              className="animate-spin text-indigo-600"
            />

            <h3 className="mt-4 text-base font-semibold text-gray-900">
              Loading clinics...
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              Please wait while we
              retrieve the latest clinic
              information.
            </p>
          </div>
        ) : error ? (
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
                  key={clinic.id}
                  className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:border-indigo-200 hover:shadow-md sm:p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-gray-900 sm:text-lg">
                          {clinic.name}
                        </h3>

                        <span className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          ★{" "}
                          {clinic.rating}
                        </span>

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
                              key={
                                doctor.id
                              }
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

{isCurrentSlot && (
  <Link
    href={`/services/clinics/${clinic.id}/emergency?doctor=${encodeURIComponent(
      doctor.id
    )}`}
    className="rounded-md bg-red-600 px-2.5 py-1.5 text-[10px] font-bold text-white transition hover:bg-red-700 active:scale-95"
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
                        href={`/services/clinics/${clinic.id}`}
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