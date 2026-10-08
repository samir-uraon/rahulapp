"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import GoUpButton from "@/components/GoUpButton";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Stethoscope,
  User,
} from "lucide-react";

const dayNames = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

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
              { open: "9:00 AM", close: "12:00 PM" },
              { open: "5:00 PM", close: "8:00 PM" },
            ],
          },
          tuesday: {
            active: true,
            slots: [
              { open: "9:00 AM", close: "12:00 PM" },
              { open: "5:00 PM", close: "8:00 PM" },
            ],
          },
          wednesday: {
            active: false,
            slots: [],
          },
          thursday: {
            active: true,
            slots: [
              { open: "10:00 AM", close: "1:00 PM" },
              { open: "4:00 PM", close: "7:00 PM" },
            ],
          },
          friday: {
            active: true,
            slots: [
              { open: "9:30 AM", close: "12:30 PM" },
              { open: "5:00 PM", close: "8:00 PM" },
            ],
          },
          saturday: {
            active: true,
            slots: [{ open: "10:00 AM", close: "2:00 PM" }],
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
            status: "completed",
          },
          {
            token: "A102",
            date: "2026-10-05",
            slot: {
              open: "9:00 AM",
              close: "12:00 PM",
            },
            patient: {
              name: "Amit Roy",
              type: "self",
            },
            status: "completed",
          },
          {
            token: "A103",
            date: "2026-10-05",
            slot: {
              open: "5:00 PM",
              close: "8:00 PM",
            },
            patient: {
              name: "Sourav Das",
              type: "self",
            },
            status: "completed",
          },
          {
            token: "A104",
            date: "2026-10-05",
            slot: {
              open: "5:00 PM",
              close: "8:00 PM",
            },
            patient: {
              name: "Rakesh Singh",
              type: "self",
            },
            status: "completed",
          },
          {
            token: "A105",
            date: "2026-10-05",
            slot: {
              open: "5:00 PM",
              close: "8:00 PM",
            },
            patient: {
              name: "Ankit Sharma",
              type: "self",
            },
            status: "completed",
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
          },
          {
            token: "A107",
            date: "2026-10-06",
            slot: {
              open: "9:00 AM",
              close: "12:00 PM",
            },
            patient: {
              name: "Riya Sen",
              type: "self",
            },
            status: "serving",
          },
          {
            token: "A108",
            date: "2026-10-06",
            slot: {
              open: "5:00 PM",
              close: "8:00 PM",
            },
            patient: {
              name: "Arijit Roy",
              type: "self",
            },
            status: "waiting",
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
            slots: [{ open: "4:00 PM", close: "7:00 PM" }],
          },
          tuesday: {
            active: true,
            slots: [
              { open: "10:00 AM", close: "1:00 PM" },
              { open: "5:00 PM", close: "8:00 PM" },
            ],
          },
          wednesday: {
            active: true,
            slots: [{ open: "4:00 PM", close: "8:00 PM" }],
          },
          thursday: {
            active: false,
            slots: [],
          },
          friday: {
            active: true,
            slots: [
              { open: "10:00 AM", close: "1:00 PM" },
              { open: "5:00 PM", close: "8:00 PM" },
            ],
          },
          saturday: {
            active: true,
            slots: [{ open: "2:00 PM", close: "6:00 PM" }],
          },
          sunday: {
            active: true,
            slots: [{ open: "10:00 AM", close: "1:00 PM" }],
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
              name: "Mita Roy",
              type: "self",
            },
            status: "completed",
          },
          {
            token: "B102",
            date: "2026-10-05",
            slot: {
              open: "4:00 PM",
              close: "7:00 PM",
            },
            patient: {
              name: "Sneha Das",
              type: "self",
            },
            status: "completed",
          },
          {
            token: "B103",
            date: "2026-10-05",
            slot: {
              open: "4:00 PM",
              close: "7:00 PM",
            },
            patient: {
              name: "Puja Sen",
              type: "self",
            },
            status: "completed",
          },
          {
            token: "B104",
            date: "2026-10-06",
            slot: {
              open: "10:00 AM",
              close: "1:00 PM",
            },
            patient: {
              name: "Ananya Roy",
              type: "self",
            },
            status: "waiting",
          },
          {
            token: "B105",
            date: "2026-10-06",
            slot: {
              open: "5:00 PM",
              close: "8:00 PM",
            },
            patient: {
              name: "Moumita Das",
              type: "self",
            },
            status: "waiting",
          },
          {
            token: "B106",
            date: "2026-10-06",
            slot: {
              open: "5:00 PM",
              close: "8:00 PM",
            },
            patient: {
              name: "Ritu Sharma",
              type: "self",
            },
            status: "waiting",
          },
        ],
      },
    ],
  },
];

function formatTime(time) {
  if (!time) return "";

  const [hour, minute] = time.split(":").map(Number);
  const suffix = hour >= 12 ? "PM" : "AM";
  const formattedHour = hour % 12 || 12;

  return `${formattedHour}:${String(minute).padStart(
    2,
    "0"
  )} ${suffix}`;
}

function parseTime(time) {
  if (!time) return 0;

  const [timePart, period] = time.trim().split(" ");

  let [hour, minute] = timePart.split(":").map(Number);

  if (period === "PM" && hour !== 12) {
    hour += 12;
  }

  if (period === "AM" && hour === 12) {
    hour = 0;
  }

  return hour * 60 + minute;
}

function getTimeString(minutes) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;

  const suffix = hour >= 12 ? "PM" : "AM";
  const formattedHour = hour % 12 || 12;

  return `${formattedHour}:${String(minute).padStart(
    2,
    "0"
  )} ${suffix}`;
}

function formatDate(dateString) {
  if (!dateString) return "";

  const date = new Date(`${dateString}T00:00:00`);

  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTodayString() {
  return getDateValue(new Date());
}

function getAvailableDates(doctor) {
  const dates = [];
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 14; i++) {
    const date = new Date(today);

    date.setDate(today.getDate() + i);

    const value = getDateValue(date);
    const dayKey = dayNames[date.getDay()];

    const doctorSchedule = doctor?.schedule?.[dayKey];

    const isAvailable =
      doctorSchedule?.active === true &&
      Array.isArray(doctorSchedule?.slots) &&
      doctorSchedule.slots.length > 0;

    dates.push({
      value,
      dayKey,
      label: date.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }),
      doctorSchedule,
      isClosed: !isAvailable,
    });
  }

  return dates;
}

function getBookedCountForSlot(
  doctor,
  appointmentDate,
  slot
) {
  if (!doctor?.bookings?.length) {
    return 0;
  }

  return doctor.bookings.filter((booking) => {
    if (booking.date !== appointmentDate) {
      return false;
    }

    if (
      booking.slot?.open !== slot.open ||
      booking.slot?.close !== slot.close
    ) {
      return false;
    }

    return (
      booking.status === "waiting" ||
      booking.status === "serving"
    );
  }).length;
}

export default function ClinicBookingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const clinicId = params.id;
  const doctorId = searchParams.get("doctor");

  const [patientName, setPatientName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [error, setError] = useState("");

  const clinic = useMemo(() => {
    return clinics.find((item) => item.id === clinicId);
  }, [clinicId]);

  const doctor = useMemo(() => {
    if (!clinic) return null;

    return clinic.doctors.find(
      (item) => item.id === doctorId
    );
  }, [clinic, doctorId]);

  const availableDates = useMemo(() => {
    if (!doctor) return [];

    return getAvailableDates(doctor);
  }, [doctor]);

  const selectedDoctorSchedule = useMemo(() => {
    if (!doctor || !appointmentDate) return null;

    const selectedDate = new Date(
      `${appointmentDate}T00:00:00`
    );

    const dayKey = dayNames[selectedDate.getDay()];

    return doctor.schedule?.[dayKey] || null;
  }, [doctor, appointmentDate]);

  const selectedDateInfo = useMemo(() => {
    return availableDates.find(
      (item) => item.value === appointmentDate
    );
  }, [availableDates, appointmentDate]);

const availableTimes = useMemo(() => {
  if (
    !doctor ||
    !appointmentDate ||
    !selectedDoctorSchedule?.active ||
    !selectedDoctorSchedule?.slots?.length
  ) {
    return [];
  }

  return selectedDoctorSchedule.slots.map((slot, index) => ({
    id: `${slot.open}-${slot.close}-${index}`,
    open: slot.open,
    close: slot.close,
    label: `${slot.open} - ${slot.close}`,
  }));
}, [doctor, appointmentDate, selectedDoctorSchedule]);

  const handleDateChange = (event) => {
    const selectedDate = event.target.value;

    setAppointmentDate(selectedDate);
    setAppointmentTime("");
    setError("");
  };

  const handleContinue = () => {
    setError("");

    const trimmedName = patientName.trim();

    if (!trimmedName) {
      setError("Please enter patient name.");
      return;
    }

    if (!age) {
      setError("Please enter patient age.");
      return;
    }

    const numericAge = Number(age);

    if (
      !Number.isInteger(numericAge) ||
      numericAge < 0 ||
      numericAge > 120
    ) {
      setError(
        "Please enter a valid age between 0 and 120."
      );
      return;
    }

    if (!gender) {
      setError("Please select patient gender.");
      return;
    }

    if (!appointmentDate) {
      setError("Please select an appointment date.");
      return;
    }

    if (!selectedDoctorSchedule?.active) {
      setError(
        "The doctor is not available on the selected date."
      );
      return;
    }

    if (!selectedDoctorSchedule?.slots?.length) {
      setError(
        "The doctor has no available slots on the selected date."
      );
      return;
    }

    if (!appointmentTime) {
      setError("Please select an appointment time.");
      return;
    }

    router.push(
      `/services/clinics/${clinic.id}/book/confirm?doctor=${doctorId}&patientName=${encodeURIComponent(
        trimmedName
      )}&age=${numericAge}&gender=${encodeURIComponent(
        gender
      )}&date=${encodeURIComponent(
        appointmentDate
      )}&time=${encodeURIComponent(
        appointmentTime
      )}`
    );
  };

  if (!clinic || !doctor) {
    return (
      <main className="min-h-screen bg-gray-50">
        <Header showBack={false} />

        <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center px-4">
          <div className="w-full rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
              <Stethoscope className="h-6 w-6 text-red-500" />
            </div>

            <h1 className="mt-4 text-xl font-bold text-gray-900">
              Booking Details Not Found
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              The selected doctor could not be found.
            </p>

            <button
              type="button"
              onClick={() => router.back()}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <Header showBack={false} />

      <section className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition hover:text-indigo-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-5 sm:p-7">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
                <CalendarDays className="h-5 w-5 text-indigo-600" />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                  QueueEase
                </p>

                <h1 className="mt-1 text-xl font-bold text-gray-900 sm:text-2xl">
                  Book Appointment
                </h1>
              </div>
            </div>

            <p className="mt-3 text-sm leading-6 text-gray-500">
              Enter the patient details and select an available
              appointment date and time.
            </p>
          </div>

          <div className="space-y-6 p-5 sm:p-7">
            <div className="rounded-2xl bg-indigo-50 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white">
                  <Stethoscope className="h-5 w-5 text-indigo-600" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-800">
                    {doctor.name}
                  </p>

                  <p className="mt-0.5 text-xs text-gray-500">
                    {doctor.specialization} •{" "}
                    {doctor.experience} years experience
                  </p>

                  <p className="mt-2 text-sm text-gray-500">
                    {clinic.name}
                  </p>

                  <p className="mt-1 text-xs text-gray-400">
                    {clinic.address}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-gray-600">
                      <User className="h-3.5 w-3.5 text-indigo-500" />
                      Consultation
                    </span>

                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-gray-600">
                      <Clock className="h-3.5 w-3.5 text-indigo-500" />
                      {doctor.duration} min
                    </span>
                  </div>

                  {appointmentDate && (
                    <div className="mt-3 rounded-xl bg-white px-3 py-2.5">
                      <p className="text-xs text-gray-500">
                        Doctor availability
                      </p>

                      {selectedDoctorSchedule?.active &&
                      selectedDoctorSchedule.slots?.length ? (
                        <div className="mt-1 space-y-1">
                          {selectedDoctorSchedule.slots.map(
                            (slot, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between gap-3"
                              >
                                <p className="text-sm font-semibold text-gray-800">
                                  {slot.open} - {slot.close}
                                </p>

                                <span className="text-[10px] font-semibold text-gray-400">
                                  {doctor.duration} min
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        <p className="mt-1 text-sm font-semibold text-gray-400">
                          Not available
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-base font-bold text-gray-900">
                Patient Information
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                You can book this appointment for yourself or
                another person.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="patientName"
                  className="mb-2 block text-sm font-semibold text-gray-700"
                >
                  Patient Name
                </label>

                <input
                  id="patientName"
                  type="text"
                  value={patientName}
                  onChange={(event) => {
                    setPatientName(event.target.value);
                    setError("");
                  }}
                  placeholder="Enter patient name"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="age"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                  >
                    Age
                  </label>

                  <input
                    id="age"
                    type="number"
                    min="0"
                    max="120"
                    value={age}
                    onChange={(event) => {
                      setAge(event.target.value);
                      setError("");
                    }}
                    placeholder="Enter age"
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                  />
                </div>

                <div>
                  <label
                    htmlFor="gender"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                  >
                    Gender
                  </label>

                  <select
                    id="gender"
                    value={gender}
                    onChange={(event) => {
                      setGender(event.target.value);
                      setError("");
                    }}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-base font-bold text-gray-900">
                Appointment Date
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Select a date based on the doctor's working schedule.
              </p>

              <div className="mt-3">
                <select
                  value={appointmentDate}
                  onChange={handleDateChange}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                >
                  <option value="">
                    Select appointment date
                  </option>

                  {availableDates.map((date) => (
                    <option
                      key={date.value}
                      value={date.value}
                      disabled={date.isClosed}
                    >
                      {date.label}
                      {date.isClosed
                        ? " — Not Available"
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              {selectedDateInfo && (
                <div
                  className={`mt-3 rounded-xl px-4 py-3 ${
                    selectedDateInfo.isClosed
                      ? "border border-red-100 bg-red-50"
                      : "bg-indigo-50"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <CalendarDays
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        selectedDateInfo.isClosed
                          ? "text-red-500"
                          : "text-indigo-600"
                      }`}
                    />

                    <div className="min-w-0">
                      <p
                        className={`text-sm font-semibold ${
                          selectedDateInfo.isClosed
                            ? "text-red-700"
                            : "text-indigo-700"
                        }`}
                      >
                        {formatDate(appointmentDate)}
                      </p>

                      {selectedDateInfo.isClosed ? (
                        <p className="mt-0.5 text-xs text-red-600">
                          Doctor is not available on this day.
                        </p>
                      ) : (
                        <div className="mt-1 space-y-0.5">
                          {selectedDoctorSchedule?.slots?.map(
                            (slot, index) => (
                              <p
                                key={index}
                                className="text-xs text-indigo-600"
                              >
                                {slot.open} - {slot.close}
                              </p>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <h2 className="text-base font-bold text-gray-900">
                Appointment Time
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Select a time based on the doctor's schedule and{" "}
                {doctor.duration}-minute consultation duration.
              </p>

              {!appointmentDate ? (
                <div className="mt-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5 text-center">
                  <Clock className="mx-auto h-6 w-6 text-gray-400" />

                  <p className="mt-2 text-sm font-medium text-gray-500">
                    Select a date first
                  </p>
                </div>
              ) : !selectedDoctorSchedule?.active ? (
                <div className="mt-3 rounded-xl border border-red-100 bg-red-50 p-5 text-center">
                  <Clock className="mx-auto h-6 w-6 text-red-400" />

                  <p className="mt-2 text-sm font-semibold text-red-700">
                    Doctor Not Available
                  </p>

                  <p className="mt-1 text-xs text-red-600">
                    This doctor does not work on the selected day.
                  </p>
                </div>
              ) : !selectedDoctorSchedule?.slots?.length ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
                  <Clock className="mx-auto h-6 w-6 text-amber-500" />

                  <p className="mt-2 text-sm font-semibold text-amber-700">
                    No Schedule Available
                  </p>

                  <p className="mt-1 text-xs text-amber-600">
                    No consultation slots are configured for this day.
                  </p>
                </div>
              ) : availableTimes.length === 0 ? (
  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
    <Clock className="mx-auto h-6 w-6 text-amber-500" />

    <p className="mt-2 text-sm font-semibold text-amber-700">
      No Appointment Slots Available
    </p>

    <p className="mt-1 text-xs text-amber-600">
      There are no consultation slots available for this day.
    </p>
  </div>
) : (
  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
    {availableTimes.map((slot) => {
      const selected =
        appointmentTime === slot.open;

      return (
        <button
          key={slot.id}
          type="button"
          onClick={() => {
            setAppointmentTime(slot.open);
            setError("");
          }}
          className={`rounded-xl border px-4 py-3 text-left transition ${
            selected
              ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
              : "border-gray-200 bg-white text-gray-700 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700"
          }`}
        >
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0" />

            <span className="text-sm font-semibold">
              {slot.label}
            </span>
          </div>

          <p
            className={`mt-1 pl-6 text-xs ${
              selected
                ? "text-indigo-100"
                : "text-gray-400"
            }`}
          >
            {doctor.duration} min consultation
          </p>
        </button>
      );
    })}
  </div>
)}
            </div>

          {appointmentDate && appointmentTime && (
  <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
    <div className="flex items-start gap-3">
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />

      <div>
        <p className="text-sm font-bold text-gray-900">
          Selected Appointment
        </p>

        <p className="mt-1 text-sm text-gray-600">
          {formatDate(appointmentDate)}
        </p>

        <p className="mt-1 text-sm font-semibold text-indigo-700">
          {formatTime(appointmentTime)}
        </p>

        <p className="mt-1 text-xs font-medium text-gray-500">
          Consultation duration: {doctor.duration} minutes
        </p>
      </div>
    </div>
  </div>
)}

            {error && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleContinue}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 hover:shadow-md active:scale-[0.99]"
            >
              <CheckCircle2 className="h-5 w-5" />
              Continue
            </button>
          </div>
        </div>
      </section>

      <GoUpButton />
    </main>
  );
}