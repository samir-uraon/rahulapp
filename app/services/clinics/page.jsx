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
} from "lucide-react";

const clinics = [
  {
    id: "clinic-101",
    name: "Sunrise Family Care Clinic",
    rating: "4.8",
    address: "Salt Lake Sector V, Kolkata",
    lat: 22.5726,
    lng: 88.4331,

    doctors: [
      {
        id: "doctor-101",
        name: "Dr. Arindam Sen",
        specialization: "MBBS, MD",
        experience: 11,
        duration: 30,

        schedule: {
          monday: {
            active: true,
            slots: [
              {
                open: "9:00 AM",
                close: "12:00 PM",
                capacity: 6,
                checkupStartTime: "9:15 AM",
              },
              {
                open: "5:00 PM",
                close: "8:00 PM",
                capacity: 6,
                checkupStartTime: "5:10 PM",
              },
            ],
          },
          tuesday: {
            active: true,
            slots: [
              {
                open: "9:00 AM",
                close: "12:00 PM",
                capacity: 6,
                checkupStartTime: "9:00 AM",
              },
              {
                open: "5:00 PM",
                close: "8:00 PM",
                capacity: 6,
                checkupStartTime: "5:05 PM",
              },
            ],
          },
          wednesday: {
            active: false,
            slots: [],
          },
          thursday: {
            active: true,
            slots: [
              {
                open: "10:00 AM",
                close: "1:00 PM",
                capacity: 6,
                checkupStartTime: "10:15 AM",
              },
              {
                open: "4:00 PM",
                close: "9:00 PM",
                capacity: 6,
                checkupStartTime: "4:15 PM",
              },
            ],
          },
          friday: {
            active: true,
            slots: [
              {
                open: "9:30 AM",
                close: "12:30 PM",
                capacity: 6,
                checkupStartTime: "9:45 AM",
              },
              {
                open: "5:00 PM",
                close: "8:00 PM",
                capacity: 6,
                checkupStartTime: "5:15 PM",
              },
            ],
          },
          saturday: {
            active: true,
            slots: [
              {
                open: "10:00 AM",
                close: "2:00 PM",
                capacity: 8,
                checkupStartTime: "10:15 AM",
              },
            ],
          },
          sunday: {
            active: false,
            slots: [],
          },
        },

        bookings: [
          {
            token: "A101",
            date: "2026-10-05",
            slot: {
              open: "9:00 AM",
              close: "12:00 PM",
            },
            patient: {
              name: "Rahul Das",
              type: "self",
            },
            status: "waiting",
            createdAt: "2026-10-04T08:00:00Z",
          },
          {
            token: "A102",
            date: "2026-10-05",
            slot: {
              open: "9:00 AM",
              close: "12:00 PM",
            },
            patient: {
              name: "Mita Das",
              type: "self",
            },
            status: "waiting",
            createdAt: "2026-10-04T08:05:00Z",
          },
          {
            token: "A103",
            date: "2026-10-05",
            slot: {
              open: "9:00 AM",
              close: "12:00 PM",
            },
            patient: {
              name: "Rohan Das",
              type: "child",
            },
            status: "serving",
            createdAt: "2026-10-04T08:10:00Z",
          },
          {
            token: "A104",
            date: "2026-10-08",
            slot: {
              open: "4:00 PM",
              close: "9:00 PM",
            },
            patient: {
              name: "Ankit Roy",
              type: "self",
            },
            status: "waiting",
            createdAt: "2026-10-04T09:00:00Z",
          },
          {
            token: "A105",
            date: "2026-10-05",
            slot: {
              open: "5:00 PM",
              close: "8:00 PM",
            },
            patient: {
              name: "Priya Roy",
              type: "elderly",
            },
            status: "waiting",
            createdAt: "2026-10-04T09:05:00Z",
          },
          {
            token: "A106",
            date: "2026-10-06",
            slot: {
              open: "9:00 AM",
              close: "12:00 PM",
            },
            patient: {
              name: "Suman Das",
              type: "self",
            },
            status: "waiting",
            createdAt: "2026-10-05T08:00:00Z",
          },
          {
            token: "A107",
            date: "2026-10-06",
            slot: {
              open: "9:00 AM",
              close: "12:00 PM",
            },
            patient: {
              name: "Riya Das",
              type: "child",
            },
            status: "waiting",
            createdAt: "2026-10-05T08:05:00Z",
          },
          {
            token: "A108",
            date: "2026-10-06",
            slot: {
              open: "5:00 PM",
              close: "8:00 PM",
            },
            patient: {
              name: "Amit Sen",
              type: "self",
            },
            status: "waiting",
            createdAt: "2026-10-05T09:00:00Z",
          },
        ],
      },

      {
        id: "doctor-102",
        name: "Dr. Priyanka Roy",
        specialization: "Dermatology",
        experience: 8,
        duration: 20,

        schedule: {
          monday: {
            active: true,
            slots: [
              {
                open: "4:00 PM",
                close: "7:00 PM",
                capacity: 9,
                checkupStartTime: "4:10 PM",
              },
            ],
          },
          tuesday: {
            active: true,
            slots: [
              {
                open: "10:00 AM",
                close: "1:00 PM",
                capacity: 9,
                checkupStartTime: "10:10 AM",
              },
              {
                open: "5:00 PM",
                close: "8:00 PM",
                capacity: 9,
                checkupStartTime: "5:10 PM",
              },
            ],
          },
          wednesday: {
            active: true,
            slots: [
              {
                open: "4:00 PM",
                close: "8:00 PM",
                capacity: 12,
                checkupStartTime: "4:10 PM",
              },
            ],
          },
          thursday: {
            active: false,
            slots: [],
          },
          friday: {
            active: true,
            slots: [
              {
                open: "10:00 AM",
                close: "1:00 PM",
                capacity: 9,
                checkupStartTime: "10:10 AM",
              },
              {
                open: "5:00 PM",
                close: "8:00 PM",
                capacity: 9,
                checkupStartTime: "5:10 PM",
              },
            ],
          },
          saturday: {
            active: true,
            slots: [
              {
                open: "2:00 PM",
                close: "6:00 PM",
                capacity: 12,
                checkupStartTime: "2:10 PM",
              },
            ],
          },
          sunday: {
            active: true,
            slots: [
              {
                open: "10:00 AM",
                close: "1:00 PM",
                capacity: 9,
                checkupStartTime: "10:10 AM",
              },
            ],
          },
        },

        bookings: [
          {
            token: "B101",
            date: "2026-10-05",
            slot: {
              open: "4:00 PM",
              close: "7:00 PM",
            },
            patient: {
              name: "Sneha Roy",
              type: "self",
            },
            status: "waiting",
            createdAt: "2026-10-04T12:00:00Z",
          },
          {
            token: "B102",
            date: "2026-10-05",
            slot: {
              open: "4:00 PM",
              close: "7:00 PM",
            },
            patient: {
              name: "Ayan Roy",
              type: "child",
            },
            status: "waiting",
            createdAt: "2026-10-04T12:05:00Z",
          },
          {
            token: "B103",
            date: "2026-10-05",
            slot: {
              open: "4:00 PM",
              close: "7:00 PM",
            },
            patient: {
              name: "Sourav Ghosh",
              type: "self",
            },
            status: "waiting",
            createdAt: "2026-10-04T12:10:00Z",
          },
          {
            token: "B104",
            date: "2026-10-06",
            slot: {
              open: "10:00 AM",
              close: "1:00 PM",
            },
            patient: {
              name: "Puja Roy",
              type: "self",
            },
            status: "waiting",
            createdAt: "2026-10-05T12:00:00Z",
          },
          {
            token: "B105",
            date: "2026-10-06",
            slot: {
              open: "5:00 PM",
              close: "8:00 PM",
            },
            patient: {
              name: "Ayan Sen",
              type: "self",
            },
            status: "waiting",
            createdAt: "2026-10-05T12:05:00Z",
          },
          {
            token: "B106",
            date: "2026-10-06",
            slot: {
              open: "5:00 PM",
              close: "8:00 PM",
            },
            patient: {
              name: "Moumita Das",
              type: "child",
            },
            status: "waiting",
            createdAt: "2026-10-05T12:10:00Z",
          },
        ],
      },
    ],
  },

  {
    id: "clinic-102",
    name: "Green Valley Medical Centre",
    rating: "4.6",
    address: "New Town, Kolkata",
    lat: 22.5958,
    lng: 88.4797,

    doctors: [
      {
        id: "doctor-103",
        name: "Dr. Sayan Mukherjee",
        specialization: "Orthopedics",
        experience: 14,
        duration: 40,

        schedule: {
          monday: {
            active: true,
            slots: [
              {
                open: "8:30 AM",
                close: "12:30 PM",
                capacity: 6,
                checkupStartTime: "8:45 AM",
              },
              {
                open: "4:00 PM",
                close: "7:00 PM",
                capacity: 4,
                checkupStartTime: "4:15 PM",
              },
            ],
          },
          tuesday: {
            active: true,
            slots: [
              {
                open: "8:30 AM",
                close: "12:30 PM",
                capacity: 6,
                checkupStartTime: "8:45 AM",
              },
            ],
          },
          wednesday: {
            active: true,
            slots: [
              {
                open: "4:00 PM",
                close: "8:00 PM",
                capacity: 6,
                checkupStartTime: "4:15 PM",
              },
            ],
          },
          thursday: {
            active: true,
            slots: [
              {
                open: "9:00 AM",
                close: "1:00 PM",
                capacity: 6,
                checkupStartTime: "9:15 AM",
              },
              {
                open: "5:00 PM",
                close: "8:00 PM",
                capacity: 4,
                checkupStartTime: "5:15 PM",
              },
            ],
          },
          friday: {
            active: false,
            slots: [],
          },
          saturday: {
            active: true,
            slots: [
              {
                open: "9:00 AM",
                close: "1:00 PM",
                capacity: 6,
                checkupStartTime: "9:15 AM",
              },
            ],
          },
          sunday: {
            active: false,
            slots: [],
          },
        },

        bookings: [
          {
            token: "C101",
            date: "2026-10-05",
            slot: {
              open: "8:30 AM",
              close: "12:30 PM",
            },
            patient: {
              name: "Amit Ghosh",
              type: "self",
            },
            status: "completed",
            createdAt: "2026-10-04T07:00:00Z",
          },
          {
            token: "C102",
            date: "2026-10-05",
            slot: {
              open: "8:30 AM",
              close: "12:30 PM",
            },
            patient: {
              name: "Rakesh Roy",
              type: "self",
            },
            status: "serving",
            createdAt: "2026-10-04T07:05:00Z",
          },
          {
            token: "C103",
            date: "2026-10-05",
            slot: {
              open: "8:30 AM",
              close: "12:30 PM",
            },
            patient: {
              name: "Mohan Das",
              type: "elderly",
            },
            status: "waiting",
            createdAt: "2026-10-04T07:10:00Z",
          },
          {
            token: "C104",
            date: "2026-10-06",
            slot: {
              open: "8:30 AM",
              close: "12:30 PM",
            },
            patient: {
              name: "Raj Das",
              type: "self",
            },
            status: "waiting",
            createdAt: "2026-10-05T07:00:00Z",
          },
          {
            token: "C105",
            date: "2026-10-06",
            slot: {
              open: "8:30 AM",
              close: "12:30 PM",
            },
            patient: {
              name: "Sourav Das",
              type: "self",
            },
            status: "waiting",
            createdAt: "2026-10-05T07:05:00Z",
          },
        ],
      },

      {
        id: "doctor-104",
        name: "Dr. Ishita Banerjee",
        specialization: "Gynecology",
        experience: 9,
        duration: 25,

        schedule: {
          monday: {
            active: true,
            slots: [
              {
                open: "3:00 PM",
                close: "6:00 PM",
                capacity: 7,
                checkupStartTime: "3:10 PM",
              },
            ],
          },
          tuesday: {
            active: true,
            slots: [
              {
                open: "3:00 PM",
                close: "6:00 PM",
                capacity: 7,
                checkupStartTime: "3:10 PM",
              },
            ],
          },
          wednesday: {
            active: true,
            slots: [
              {
                open: "10:00 AM",
                close: "1:00 PM",
                capacity: 7,
                checkupStartTime: "10:10 AM",
              },
              {
                open: "4:00 PM",
                close: "7:00 PM",
                capacity: 7,
                checkupStartTime: "4:10 PM",
              },
            ],
          },
          thursday: {
            active: false,
            slots: [],
          },
          friday: {
            active: true,
            slots: [
              {
                open: "3:00 PM",
                close: "8:00 PM",
                capacity: 12,
                checkupStartTime: "3:10 PM",
              },
            ],
          },
          saturday: {
            active: true,
            slots: [
              {
                open: "10:00 AM",
                close: "2:00 PM",
                capacity: 9,
                checkupStartTime: "10:10 AM",
              },
            ],
          },
          sunday: {
            active: true,
            slots: [
              {
                open: "11:00 AM",
                close: "2:00 PM",
                capacity: 7,
                checkupStartTime: "11:10 AM",
              },
            ],
          },
        },

        bookings: [
          {
            token: "D101",
            date: "2026-10-05",
            slot: {
              open: "3:00 PM",
              close: "6:00 PM",
            },
            patient: {
              name: "Puja Sen",
              type: "self",
            },
            status: "waiting",
            createdAt: "2026-10-04T10:00:00Z",
          },
          {
            token: "D102",
            date: "2026-10-05",
            slot: {
              open: "3:00 PM",
              close: "6:00 PM",
            },
            patient: {
              name: "Riya Sen",
              type: "self",
            },
            status: "waiting",
            createdAt: "2026-10-04T10:05:00Z",
          },
          {
            token: "D103",
            date: "2026-10-05",
            slot: {
              open: "3:00 PM",
              close: "6:00 PM",
            },
            patient: {
              name: "Ananya Sen",
              type: "child",
            },
            status: "waiting",
            createdAt: "2026-10-04T10:10:00Z",
          },
          {
            token: "D104",
            date: "2026-10-06",
            slot: {
              open: "3:00 PM",
              close: "6:00 PM",
            },
            patient: {
              name: "Riya Das",
              type: "self",
            },
            status: "waiting",
            createdAt: "2026-10-05T10:00:00Z",
          },
          {
            token: "D105",
            date: "2026-10-06",
            slot: {
              open: "3:00 PM",
              close: "6:00 PM",
            },
            patient: {
              name: "Ananya Roy",
              type: "child",
            },
            status: "waiting",
            createdAt: "2026-10-05T10:05:00Z",
          },
        ],
      },
    ],
  },
];

// Handles queue order, placing emergency/priority cases ahead while adhering to doctor-defined slots
function getNextPatient(doctor, date, slot) {
  const bookings = (doctor.bookings || []).filter(
    (booking) =>
      booking.date === date &&
      booking.slot?.open === slot.open &&
      booking.slot?.close === slot.close &&
      booking.status !== "completed"
  );

  const serving = bookings.find((booking) => booking.status === "serving");
  if (serving) return serving;

  const waitingPatients = bookings.filter(
    (booking) => booking.status === "waiting"
  );

  // Emergency or priority cases jump to the front of the queue
  const emergencyPatients = waitingPatients.filter(
    (booking) =>
      booking.priority === "emergency" || booking.patient?.type === "emergency"
  );

  if (emergencyPatients.length > 0) {
    return emergencyPatients.sort(
      (a, b) =>
        new Date(a.createdAt || 0).getTime() -
        new Date(b.createdAt || 0).getTime()
    )[0];
  }

  const priorityPatients = waitingPatients.filter(
    (booking) => booking.patient?.type === "elderly"
  );

  if (priorityPatients.length > 0) {
    return priorityPatients.sort(
      (a, b) =>
        new Date(a.createdAt || 0).getTime() -
        new Date(b.createdAt || 0).getTime()
    )[0];
  }

  const normalPatients = waitingPatients.sort(
    (a, b) =>
      new Date(a.createdAt || 0).getTime() -
      new Date(b.createdAt || 0).getTime()
  );

  return normalPatients[0] || null;
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  const earthRadius = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

function formatTime(time) {
  if (!time) return "";

  const [timePart, period] = time.trim().split(/\s+/);
  let [hour, minute] = timePart.split(":").map(Number);

  if (period === "AM" && hour === 12) hour = 0;
  if (period === "PM" && hour !== 12) hour += 12;

  const suffix = hour >= 12 ? "PM" : "AM";
  const formattedHour = hour % 12 || 12;

  return `${formattedHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function getMinutes(time) {
  if (!time) return null;

  const [timePart, period] = time.trim().split(/\s+/);
  let [hour, minute] = timePart.split(":").map(Number);

  if (period === "AM" && hour === 12) hour = 0;
  if (period === "PM" && hour !== 12) hour += 12;

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
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDoctorQueue(doctor, date = new Date(), selectedSlot = null) {
  if (!doctor?.bookings?.length || !selectedSlot) return 0;

  const dateKey = getDateKey(date);

  return doctor.bookings.filter((booking) => {
    if (booking.date !== dateKey) return false;
    if (
      booking.slot?.open !== selectedSlot.open ||
      booking.slot?.close !== selectedSlot.close
    )
      return false;

    return booking.status === "waiting" || booking.status === "serving";
  }).length;
}

function getDoctorSlotQueues(doctor, date = new Date()) {
  const today = getTodayKey(date);
  const todaySchedule = doctor?.schedule?.[today];

  if (!todaySchedule?.active || !Array.isArray(todaySchedule.slots)) {
    return [];
  }

  return todaySchedule.slots.map((slot) => ({
    slot,
    peopleAhead: getDoctorQueue(doctor, date, slot),
  }));
}

function getDoctorStatus(schedule, now = new Date()) {
  const today = getTodayKey(now);
  const todaySchedule = schedule?.[today];

  if (!todaySchedule?.active) {
    return {
      isOpen: false,
      status: "Closed Today",
      timeText: "Closed Today",
      schedule: todaySchedule || null,
      currentSlot: null,
      nextSlot: null,
    };
  }

  const slots = Array.isArray(todaySchedule.slots) ? todaySchedule.slots : [];
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

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const currentSlot = slots.find((slot) => {
    const openMinutes = getMinutes(slot.open);
    const closeMinutes = getMinutes(slot.close);
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  });

  if (currentSlot) {
    return {
      isOpen: true,
      status: "Open Now",
      timeText: `Today: ${formatTime(currentSlot.open)} - ${formatTime(
        currentSlot.close
      )}`,
      schedule: todaySchedule,
      currentSlot,
      nextSlot: null,
    };
  }

  const upcomingSlots = slots
    .filter((slot) => getMinutes(slot.open) > currentMinutes)
    .sort((a, b) => getMinutes(a.open) - getMinutes(b.open));

  if (upcomingSlots.length > 0) {
    const nextSlot = upcomingSlots[0];
    return {
      isOpen: false,
      status: "Closed Now",
      timeText: `Opens today at ${formatTime(nextSlot.open)}`,
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

function getClinicStatus(doctors, now = new Date()) {
  if (!doctors?.length) {
    return {
      isOpen: false,
      status: "Closed Today",
      timeText: "No doctors available",
      openDoctors: [],
      doctorStatuses: [],
    };
  }

  const doctorStatuses = doctors.map((doctor) => ({
    doctor,
    status: getDoctorStatus(doctor.schedule, now),
  }));

  const openDoctors = doctorStatuses.filter((item) => item.status.isOpen);

  if (openDoctors.length > 0) {
    return {
      isOpen: true,
      status: "Open Now",
      timeText: `${openDoctors.length} ${
        openDoctors.length === 1 ? "doctor" : "doctors"
      } available now`,
      openDoctors: openDoctors.map((item) => item.doctor),
      doctorStatuses,
    };
  }

  const today = getTodayKey(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const upcomingDoctors = doctorStatuses
    .map((item) => {
      const schedule = item.doctor.schedule?.[today];
      if (!schedule?.active) return null;

      const slots = Array.isArray(schedule.slots) ? schedule.slots : [];
      const upcomingSlots = slots
        .filter((slot) => getMinutes(slot.open) > currentMinutes)
        .sort((a, b) => getMinutes(a.open) - getMinutes(b.open));

      if (upcomingSlots.length === 0) return null;

      return {
        ...item,
        nextSlot: upcomingSlots[0],
      };
    })
    .filter(Boolean)
    .sort((a, b) => getMinutes(a.nextSlot.open) - getMinutes(b.nextSlot.open));

  if (upcomingDoctors.length > 0) {
    const nextDoctor = upcomingDoctors[0];
    return {
      isOpen: false,
      status: "Closed Now",
      timeText: `Opens today at ${formatTime(nextDoctor.nextSlot.open)}`,
      openDoctors: [],
      doctorStatuses,
    };
  }

  const hasTodaySchedule = doctorStatuses.some((item) => {
    const schedule = item.doctor.schedule?.[today];
    return (
      schedule?.active &&
      Array.isArray(schedule.slots) &&
      schedule.slots.length > 0
    );
  });

  if (hasTodaySchedule) {
    return {
      isOpen: false,
      status: "Closed Today",
      timeText: "All doctors have closed for today",
      openDoctors: [],
      doctorStatuses,
    };
  }

  return {
    isOpen: false,
    status: "Closed Today",
    timeText: "No doctor available today",
    openDoctors: [],
    doctorStatuses,
  };
}

export default function ClinicsPage() {
  const { data: session } = useSession();

  const [location, setLocation] = useState("Select Location");
  const [search, setSearch] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const savedLocation = localStorage.getItem("queueease-location");
    if (!savedLocation) return;

    try {
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
      setLocation(savedLocation);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  const userCoordinates = useMemo(() => {
    const latitude = Number(session?.user?.latitude);
    const longitude = Number(session?.user?.longitude);

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { lat: latitude, lng: longitude };
    }

    return null;
  }, [session?.user?.latitude, session?.user?.longitude]);

  const filteredClinics = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return clinics
      .map((clinic) => {
        const distance = userCoordinates
          ? calculateDistance(
              userCoordinates.lat,
              userCoordinates.lng,
              clinic.lat,
              clinic.lng
            )
          : null;

        const doctorsWithStatus = clinic.doctors.map((doctor) => {
          const doctorStatus = getDoctorStatus(doctor.schedule, currentTime);
          const activeSlot = doctorStatus.currentSlot;
          const slotQueues = getDoctorSlotQueues(doctor, currentTime);
          const peopleAhead = activeSlot
            ? getDoctorQueue(doctor, currentTime, activeSlot)
            : 0;

          return {
            ...doctor,
            peopleAhead,
            activeSlot,
            slotQueues,
            status: doctorStatus,
          };
        });

        const clinicStatus = getClinicStatus(clinic.doctors, currentTime);

        return {
          ...clinic,
          distance,
          clinicStatus,
          doctorsWithStatus,
        };
      })
      .filter((clinic) => clinic.name.toLowerCase().includes(searchText))
      .sort((a, b) => {
        if (a.distance === null && b.distance === null) return 0;
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
  }, [search, userCoordinates, currentTime]);

  const shortLocation = location.split(",")[0].trim() || "Select Location";

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
                  {filteredClinics.length}{" "}
                  {filteredClinics.length === 1 ? "clinic" : "clinics"} nearby
                </span>
              </div>

              <h2 className="mt-3 text-xl font-bold leading-tight text-gray-900 sm:text-2xl">
                Clinics & Doctor Specialists Near You
              </h2>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
                Find nearby clinics, compare doctors, check live queues, and book
                your consultation without waiting in long queues.
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
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search clinic by name..."
                  className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-10 text-sm text-gray-800 shadow-sm outline-none transition-all duration-200 placeholder:text-gray-400 hover:border-gray-300 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
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
                    <MapPin size={17} className="text-indigo-600" />
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

                {location !== "Select Location" && (
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

        {filteredClinics.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-12 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <Search size={21} className="text-gray-400" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-gray-900">
              No clinics found
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Try searching with a different clinic name.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredClinics.map((clinic) => (
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
                        ★ {clinic.rating}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          clinic.clinicStatus.isOpen
                            ? "bg-green-50 text-green-700"
                            : "bg-red-50 text-red-600"
                        }`}
                      >
                        {clinic.clinicStatus.status}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <MapPin size={16} className="text-red-500 shrink-0" />
                        <span>{clinic.address}</span>
                      </div>
                      {clinic.distance !== null && (
                        <span className="rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                          {clinic.distance < 1
                            ? `${Math.round(clinic.distance * 1000)} m away`
                            : `${clinic.distance.toFixed(1)} km away`}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
                        <Stethoscope size={15} />
                        <span>
                          {clinic.doctors.length}{" "}
                          {clinic.doctors.length === 1 ? "Doctor" : "Doctors"}
                        </span>
                      </div>

                      <div
                        className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                          clinic.clinicStatus.isOpen
                            ? "bg-green-50 text-green-700"
                            : "bg-red-50 text-red-600"
                        }`}
                      >
                        <Clock size={15} />
                        <span>{clinic.clinicStatus.timeText}</span>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {clinic.doctorsWithStatus.map((doctor) => (
                        <div
                          key={doctor.id}
                          className="rounded-xl border border-gray-100 bg-gray-50 p-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                                  doctor.status.isOpen
                                    ? "bg-green-500"
                                    : "bg-gray-400"
                                }`}
                              />
                              <p className="truncate text-xs font-bold text-gray-800">
                                {doctor.name}
                              </p>
                            </div>
                            <span className="text-[11px] font-medium text-gray-500">
                              {doctor.specialization}
                            </span>
                          </div>

                          {doctor.slotQueues.length > 0 ? (
                            <div className="mt-2 space-y-1.5">
                              {doctor.slotQueues.map(
                                ({ slot, peopleAhead }) => {
                                  const isCurrentSlot =
                                    doctor.activeSlot?.open === slot.open &&
                                    doctor.activeSlot?.close === slot.close;

                                  return (
                                    <div
                                      key={`${slot.open}-${slot.close}`}
                                      className={`rounded-lg border px-2.5 py-1.5 ${
                                        isCurrentSlot
                                          ? "border-green-200 bg-green-50/60"
                                          : "border-gray-200 bg-white"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-medium text-gray-600">
                                          {formatTime(slot.open)} -{" "}
                                          {formatTime(slot.close)}
                                        </span>
                                        {isCurrentSlot && (
                                          <span className="rounded bg-green-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                                            NOW
                                          </span>
                                        )}
                                      </div>

                                      <p
                                        className={`mt-0.5 text-[11px] font-semibold ${
                                          peopleAhead > 0
                                            ? "text-orange-600"
                                            : "text-green-600"
                                        }`}
                                      >
                                        {peopleAhead === 0
                                          ? "No one ahead"
                                          : `${peopleAhead} ${
                                              peopleAhead === 1
                                                ? "person"
                                                : "people"
                                            } ahead`}
                                      </p>
                                    </div>
                                  );
                                }
                              )}
                            </div>
                          ) : (
                            <p className="mt-2 text-[11px] font-medium text-red-500">
                              {doctor.status.status}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="w-full lg:w-auto lg:shrink-0 lg:self-center">
                    <Link
                      href={`/services/clinics/${clinic.id}`}
                      className="flex h-11 w-full items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-indigo-700 hover:shadow-md active:scale-[0.98] lg:w-auto"
                    >
                      View Doctors
                      <span className="ml-2">→</span>
                    </Link>
                  </div>
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