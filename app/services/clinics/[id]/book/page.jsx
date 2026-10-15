
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Header from "@/components/Header";
import GoUpButton from "@/components/GoUpButton";
import LoadingScreen from "@/components/LoadingScreen";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  LoaderCircle,
  MapPin,
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

function getDateValue(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatDate(dateString) {
  if (!dateString) return "";

  const [year, month, day] = dateString.split("-").map(Number);

  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function parseSlotMinutes(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const match =
    /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i.exec(
      String(value).trim()
    );

  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3]?.toUpperCase();

  if (minute > 59) return null;

  if (period) {
    if (hour < 1 || hour > 12) return null;

    if (period === "AM" && hour === 12) hour = 0;
    if (period === "PM" && hour !== 12) hour += 12;
  } else if (hour > 23) {
    return null;
  }

  return hour * 60 + minute;
}

function formatTime(time) {
  if (!time) return "";

  const minutes = parseSlotMinutes(time);

  if (minutes === null) return String(time);

  const date = new Date();

  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);

  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getIndiaDateTime() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const getPart = (type) =>
    parts.find((part) => part.type === type)?.value;

  return {
    date: `${getPart("year")}-${getPart("month")}-${getPart("day")}`,
    minutes:
      Number(getPart("hour")) * 60 +
      Number(getPart("minute")),
  };
}

function normalizeDate(value) {
  if (!value) return "";

  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }

    const parsed = new Date(value);

    if (!Number.isNaN(parsed.getTime())) {
      return getDateValue(parsed);
    }
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return getDateValue(value);
  }

  return "";
}

function getBookingSlot(booking) {
  const slot = booking?.slot || {};

  return {
    open:
      slot.open ??
      booking?.slotOpen ??
      booking?.time ??
      "",
    close:
      slot.close ??
      booking?.slotClose ??
      "",
  };
}

function isBookingCountable(booking) {
  const status = String(booking?.status || "").toLowerCase();

  const paymentStatus = String(
    booking?.paymentStatus || ""
  ).toLowerCase();

  if (
    [
      "cancelled",
      "canceled",
      "no-show",
      "noshow",
      "rejected",
    ].includes(status)
  ) {
    return false;
  }

  if (
    ["failed", "unpaid", "refunded"].includes(paymentStatus)
  ) {
    return false;
  }

  return true;
}

function getSlotCapacityInfo(
  slot,
  doctor,
  appointmentDate,
  clinicId,
  doctorId
) {
  const capacity = Number(slot.capacity);

  const bookings = Array.isArray(doctor?.bookings)
    ? doctor.bookings
    : [];

  const bookedCount = bookings.filter((booking) => {
    if (!isBookingCountable(booking)) return false;

    const bookingClinicId =
      booking.clinicId ?? booking.clinic?.id;

    const bookingDoctorId =
      booking.doctorId ?? booking.doctor?.id;

    const bookingDate = normalizeDate(
      booking.date ??
        booking.appointmentDate ??
        booking.bookingDate
    );

    const bookingSlot = getBookingSlot(booking);

    const sameClinic =
      bookingClinicId == null ||
      String(bookingClinicId) === String(clinicId);

    const sameDoctor =
      bookingDoctorId == null ||
      String(bookingDoctorId) === String(doctorId);

    const sameDate = bookingDate === appointmentDate;

    const bookingOpen = parseSlotMinutes(bookingSlot.open);
    const bookingClose = parseSlotMinutes(bookingSlot.close);
    const slotOpen = parseSlotMinutes(slot.open);
    const slotClose = parseSlotMinutes(slot.close);

    const sameSlot =
      bookingOpen !== null &&
      bookingClose !== null &&
      bookingOpen === slotOpen &&
      bookingClose === slotClose;

    return sameClinic && sameDoctor && sameDate && sameSlot;
  }).length;

  const configured =
    Number.isFinite(capacity) &&
    Number.isInteger(capacity) &&
    capacity > 0;

  const remaining = configured
    ? Math.max(0, capacity - bookedCount)
    : 0;

  return {
    capacity,
    bookedCount,
    remaining,
    configured,
    isFull: !configured || bookedCount >= capacity,
  };
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

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const scriptUrl =
      "https://checkout.razorpay.com/v1/checkout.js";

    const existingScript = document.querySelector(
      `script[src="${scriptUrl}"]`
    );

    if (existingScript) {
      if (existingScript.dataset.loaded === "true") {
        resolve(true);
        return;
      }

      existingScript.addEventListener(
        "load",
        () => resolve(true),
        { once: true }
      );

      existingScript.addEventListener(
        "error",
        () => resolve(false),
        { once: true }
      );

      return;
    }

    const script = document.createElement("script");

    script.src = scriptUrl;
    script.async = true;

    script.onload = () => {
      script.dataset.loaded = "true";
      resolve(true);
    };

    script.onerror = () => resolve(false);

    document.body.appendChild(script);
  });
}

export default function ClinicBookingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const { data: session, status } = useSession();

  const clinicId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const doctorId = searchParams.get("doctor");

  const [clinics, setClinics] = useState([]);
  const [loadingClinics, setLoadingClinics] = useState(true);
  const [clinicError, setClinicError] = useState("");

  const [patientName, setPatientName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);

  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");

  const [error, setError] = useState("");
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchClinics() {
      setLoadingClinics(true);
      setClinicError("");

      try {
        const response = await fetch("/api/clinics", {
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Failed to load clinics."
          );
        }

        if (!cancelled) {
          setClinics(
            Array.isArray(data.clinics) ? data.clinics : []
          );
        }
      } catch (err) {
        if (!cancelled) {
          setClinicError(
            err.message ||
              "Could not load clinic details. Please try again."
          );
        }
      } finally {
        if (!cancelled) setLoadingClinics(false);
      }
    }

    fetchClinics();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      setProfileLoading(false);
      router.replace("/login");
      return;
    }

    let cancelled = false;

    async function loadProfile() {
      setProfileLoading(true);

      try {
        const response = await fetch("/api/profile", {
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Could not load your profile."
          );
        }

        if (cancelled) return;

        const profile = data.profile ?? data.user ?? data;

        setPatientName(
          (current) =>
            current ||
            profile.name ||
            profile.fullName ||
            session?.user?.name ||
            ""
        );

        if (
          profile.age !== undefined &&
          profile.age !== null &&
          profile.age !== ""
        ) {
          setAge((current) =>
            current === "" ? String(profile.age) : current
          );
        }

        if (profile.gender) {
          setGender((current) => current || profile.gender);
        }
      } catch {
        if (!cancelled) {
          setPatientName(
            (current) => current || session?.user?.name || ""
          );
        }
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.name, router]);

  const clinic = useMemo(
    () =>
      clinics.find(
        (item) => String(item.id) === String(clinicId)
      ),
    [clinics, clinicId]
  );

  const doctor = useMemo(
    () =>
      clinic?.doctors?.find(
        (item) => String(item.id) === String(doctorId)
      ) || null,
    [clinic, doctorId]
  );

  const availableDates = useMemo(
    () => (doctor ? getAvailableDates(doctor) : []),
    [doctor]
  );

  const selectedDateInfo = useMemo(
    () =>
      availableDates.find(
        (item) => item.value === appointmentDate
      ),
    [availableDates, appointmentDate]
  );

  const selectedDoctorSchedule = useMemo(() => {
    if (!doctor || !appointmentDate) return null;

    const [year, month, day] = appointmentDate
      .split("-")
      .map(Number);

    const selectedDate = new Date(year, month - 1, day);
    const dayKey = dayNames[selectedDate.getDay()];

    return doctor.schedule?.[dayKey] || null;
  }, [doctor, appointmentDate]);

  const availableTimes = useMemo(() => {
    if (
      !appointmentDate ||
      !selectedDoctorSchedule?.active ||
      !Array.isArray(selectedDoctorSchedule.slots)
    ) {
      return [];
    }

    const { date: today, minutes: currentMinutes } =
      getIndiaDateTime();

    const isToday = appointmentDate === today;

    return selectedDoctorSchedule.slots
      .filter((slot) => {
        const slotStart = parseSlotMinutes(slot.open);
        const slotEnd = parseSlotMinutes(slot.close);

        if (slotStart === null || slotEnd === null) {
          return false;
        }

        if (slotEnd <= slotStart) return false;

        if (!isToday) return true;

        return slotEnd > currentMinutes;
      })
      .map((slot, index) => {
        const capacityInfo = getSlotCapacityInfo(
          slot,
          doctor,
          appointmentDate,
          clinicId,
          doctorId
        );

        return {
          id: `${slot.open}-${slot.close}-${index}`,
          open: slot.open,
          close: slot.close,
          label: `${formatTime(slot.open)} - ${formatTime(slot.close)}`,
          ...capacityInfo,
        };
      });
  }, [
    appointmentDate,
    selectedDoctorSchedule,
    doctor,
    clinicId,
    doctorId,
  ]);

  useEffect(() => {
    if (!appointmentTime) return;

    const stillAvailable = availableTimes.some(
      (slot) =>
        slot.open === appointmentTime &&
        slot.configured &&
        !slot.isFull
    );

    if (!stillAvailable) {
      setAppointmentTime("");
    }
  }, [availableTimes, appointmentTime]);

  const selectedSlot = availableTimes.find(
    (slot) => slot.open === appointmentTime
  );

  const isSlotUnavailable =
    !appointmentDate ||
    !appointmentTime ||
    !selectedSlot ||
    !selectedSlot.configured ||
    selectedSlot.isFull;

  const bookingCharge = Number(
    doctor?.bookingCharge ?? doctor?.fee ?? 0
  );

  const isPageLoading =
    status === "loading" ||
    loadingClinics ||
    profileLoading;

  const handleDateChange = (event) => {
    setAppointmentDate(event.target.value);
    setAppointmentTime("");
    setError("");
  };

  const validateForm = () => {
    setError("");

    if (status !== "authenticated") {
      setError("Please log in before booking an appointment.");
      return false;
    }

    if (!clinic || !doctor) {
      setError("Clinic or doctor details could not be found.");
      return false;
    }

    if (!patientName.trim()) {
      setError("Please enter the patient name.");
      return false;
    }

    if (age === "") {
      setError("Please enter the patient age.");
      return false;
    }

    const numericAge = Number(age);

    if (
      !Number.isInteger(numericAge) ||
      numericAge < 0 ||
      numericAge > 120
    ) {
      setError("Please enter a valid age between 0 and 120.");
      return false;
    }

    if (!gender) {
      setError("Please select the patient's gender.");
      return false;
    }

    if (!appointmentDate) {
      setError("Please select an appointment date.");
      return false;
    }

    if (
      !selectedDoctorSchedule?.active ||
      !Array.isArray(selectedDoctorSchedule.slots) ||
      selectedDoctorSchedule.slots.length === 0
    ) {
      setError(
        "The doctor is not available on the selected date."
      );
      return false;
    }

    if (!appointmentTime) {
      setError("Please select an appointment time.");
      return false;
    }

    const currentSlot = availableTimes.find(
      (slot) => slot.open === appointmentTime
    );

    if (!currentSlot) {
      setAppointmentTime("");
      setError(
        "This appointment slot is no longer available. Please select another slot."
      );
      return false;
    }

    if (!currentSlot.configured) {
      setError(
        "Capacity is not configured for this slot. Please contact the clinic."
      );
      return false;
    }

    if (currentSlot.isFull) {
      setAppointmentTime("");
      setError(
        "This appointment slot is full. Please select another slot."
      );
      return false;
    }

    if (!Number.isFinite(bookingCharge) || bookingCharge <= 0) {
      setError(
        "The booking charge is not configured for this doctor. Please contact the clinic."
      );
      return false;
    }

    return true;
  };

  const handlePayment = async () => {
    if (isPaying || isPageLoading || !validateForm()) return;

    const currentSlot = availableTimes.find(
      (slot) => slot.open === appointmentTime
    );

    if (
      !currentSlot ||
      !currentSlot.configured ||
      currentSlot.isFull
    ) {
      setAppointmentTime("");
      setError(
        "This slot is full or unavailable. Please select another slot."
      );
      return;
    }

    setIsPaying(true);
    setError("");

    try {
      const orderResponse = await fetch(
        "/api/payment/create-order",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            clinicId,
            doctorId,
            patientName: patientName.trim(),
            age: Number(age),
            gender,
            date: appointmentDate,
            time: appointmentTime,
            slot: {
              open: currentSlot.open,
              close: currentSlot.close,
            },
          }),
        }
      );

      const orderData = await orderResponse.json();

      if (!orderResponse.ok || !orderData.success) {
        throw new Error(
          orderData.message || "Could not create payment order."
        );
      }

      const scriptLoaded = await loadRazorpayScript();

      if (!scriptLoaded || !window.Razorpay) {
        throw new Error(
          "Razorpay Checkout could not be loaded. Please check your connection and try again."
        );
      }

      const checkout = new window.Razorpay({
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Zeric",
        description: `Clinic booking charge - ${doctor.name}`,
        order_id: orderData.orderId,

        prefill: {
          name: patientName.trim(),
          email: session?.user?.email || "",
        },

        notes: {
          clinicId,
          doctorId,
          appointmentDate,
        },

        theme: {
          color: "#4f46e5",
        },

        modal: {
          ondismiss: () => {
            setIsPaying(false);
          },
        },

        handler: async (paymentResponse) => {
          try {
            const verifyResponse = await fetch(
              "/api/payment/verify",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(paymentResponse),
              }
            );

            const verifyData = await verifyResponse.json();

            if (!verifyResponse.ok || !verifyData.success) {
              setError(
                verifyData.message ||
                  "Payment verification failed. Please check My Bookings before trying again."
              );

              setIsPaying(false);
              return;
            }

            router.push("/my-bookings");
          } catch {
            setError(
              "Payment was submitted, but verification could not be confirmed. Check My Bookings before attempting another payment."
            );

            setIsPaying(false);
          }
        },
      });

      checkout.on("payment.failed", (response) => {
        setError(
          response?.error?.description ||
            "Payment failed. Please try again."
        );

        setIsPaying(false);
      });

      checkout.open();
    } catch (err) {
      setError(
        err.message || "Something went wrong. Please try again."
      );

      setIsPaying(false);
    }
  };

  if (isPageLoading) {
    return <LoadingScreen />;
  }

  if (status === "unauthenticated") {
    return (
      <main className="min-h-screen bg-gray-50">
        <Header showBack={false} />

        <div className="flex min-h-[65vh] items-center justify-center text-sm text-gray-500">
          Redirecting to login...
        </div>
      </main>
    );
  }

  if (clinicError || !clinic || !doctor) {
    return (
      <main className="min-h-screen bg-gray-50">
        <Header showBack={false} />

        <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center px-4">
          <div className="w-full rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
              <Stethoscope className="h-6 w-6 text-red-500" />
            </div>

            <h1 className="mt-4 text-xl font-bold text-gray-900">
              {clinicError
                ? "Unable to Load Clinic"
                : "Booking Details Not Found"}
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              {clinicError ||
                "The selected clinic or doctor could not be found. Please return and select a doctor again."}
            </p>

          <button
  type="button"
  onClick={() => router.push(`/clinics/${clinicId}`)}
  className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition hover:text-indigo-600"
>
  <ArrowLeft className="h-4 w-4" />
  Back
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
                <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
                  Book Appointment
                </h1>

                <p className="mt-1 text-xs text-gray-500">
                  Signed in as{" "}
                  {session?.user?.email || session?.user?.name}
                </p>
              </div>
            </div>

            <p className="mt-3 text-sm leading-6 text-gray-500">
              Your account details are filled in automatically where
              available. You can edit them if you are booking for
              another person.
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
                    {doctor.specialization}
                    {doctor.experience != null &&
                      ` • ${doctor.experience} years experience`}
                  </p>

                  <p className="mt-2 text-sm text-gray-600">
                    {clinic.name}
                  </p>

                  <p className="mt-1 flex items-start gap-1 text-xs text-gray-500">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {clinic.address}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-gray-600">
                      <User className="h-3.5 w-3.5 text-indigo-500" />
                      Consultation
                    </span>

                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-gray-600">
                      <Clock className="h-3.5 w-3.5 text-indigo-500" />
                      {doctor.duration || 30} min
                    </span>
                  </div>

                  <div className="mt-3 rounded-xl bg-white px-3 py-3">
                    <p className="text-xs text-gray-500">
                      Booking charge
                    </p>

                    <p className="mt-1 text-xl font-bold text-indigo-700">
                      ₹{bookingCharge.toLocaleString("en-IN")}
                    </p>

                    <p className="mt-1 text-xs text-gray-400">
                      Confirm the final amount in Razorpay Checkout.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-base font-bold text-gray-900">
                Patient Information
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Details from your profile are prefilled when available.
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
                  autoComplete="name"
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
                  <option value="">Select appointment date</option>

                  {availableDates.map((date) => (
                    <option
                      key={date.value}
                      value={date.value}
                      disabled={date.isClosed}
                    >
                      {date.label}
                      {date.isClosed ? " — Not Available" : ""}
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
                      ) : availableTimes.length > 0 ? (
                        <div className="mt-1 space-y-0.5">
                          {availableTimes.map((slot) => (
                            <p
                              key={slot.id}
                              className="text-xs text-indigo-600"
                            >
                              {slot.label} —{" "}
                              {!slot.configured
                                ? "Capacity not configured"
                                : slot.isFull
                                  ? "Full"
                                  : `${slot.remaining} seats left`}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-indigo-600">
                          All appointment slots for this date have closed.
                        </p>
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
                Choose an available schedule block for your consultation.
              </p>

              {!appointmentDate ? (
                <div className="mt-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5 text-center">
                  <Clock className="mx-auto h-6 w-6 text-gray-400" />

                  <p className="mt-2 text-sm font-medium text-gray-500">
                    Select a date first
                  </p>
                </div>
              ) : !selectedDoctorSchedule?.active ||
                !selectedDoctorSchedule?.slots?.length ? (
                <div className="mt-3 rounded-xl border border-red-100 bg-red-50 p-5 text-center">
                  <Clock className="mx-auto h-6 w-6 text-red-400" />

                  <p className="mt-2 text-sm font-semibold text-red-700">
                    Doctor Not Available
                  </p>

                  <p className="mt-1 text-xs text-red-600">
                    This doctor has no schedule on the selected day.
                  </p>
                </div>
              ) : availableTimes.length === 0 ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
                  <Clock className="mx-auto h-6 w-6 text-amber-500" />

                  <p className="text-sm font-semibold text-amber-700">
                    No appointment slots available
                  </p>

                  <p className="mt-1 text-xs text-amber-600">
                    All slots for the selected date have already closed.
                    Please choose another date.
                  </p>
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {availableTimes.map((slot) => {
                    const selected = appointmentTime === slot.open;

                    const disabled =
                      !slot.configured || slot.isFull;

                    return (
                      <button
                        key={slot.id}
                        type="button"
                        aria-pressed={selected}
                        disabled={disabled}
                        onClick={() => {
                          setAppointmentTime(slot.open);
                          setError("");
                        }}
                        className={`rounded-xl border px-4 py-3 text-left transition disabled:cursor-not-allowed ${
                          disabled
                            ? "border-gray-200 bg-gray-100 text-gray-400 opacity-80"
                            : selected
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
                            selected && !disabled
                              ? "text-indigo-100"
                              : "text-gray-500"
                          }`}
                        >
                          {doctor.duration || 30} min consultation
                        </p>

                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className="text-xs font-medium">
                            {slot.configured
                              ? `${Math.min(
                                  slot.bookedCount,
                                  slot.capacity
                                )}/${slot.capacity} booked`
                              : "Capacity not configured"}
                          </span>

                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                              !slot.configured || slot.isFull
                                ? "bg-red-100 text-red-700"
                                : slot.remaining <= 2
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-green-100 text-green-700"
                            }`}
                          >
                            {!slot.configured
                              ? "Unavailable"
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
            </div>

            {appointmentDate && appointmentTime && (
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />

                  <div className="min-w-0 flex-1">
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
                      Consultation duration: {doctor.duration || 30} minutes
                    </p>

                    {!selectedSlot ? (
                      <p className="mt-3 text-sm font-semibold text-red-600">
                        Slot unavailable. Please select another slot.
                      </p>
                    ) : (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-3">
                        <div>
                          <p className="text-xs text-gray-500">
                            Slot Capacity
                          </p>

                          <p className="mt-1 text-sm font-bold text-gray-800">
                            {selectedSlot.configured
                              ? `${Math.min(
                                  selectedSlot.bookedCount,
                                  selectedSlot.capacity
                                )}/${selectedSlot.capacity} booked`
                              : "Not configured"}
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                            !selectedSlot.configured ||
                            selectedSlot.isFull
                              ? "bg-red-100 text-red-700"
                              : selectedSlot.remaining <= 2
                                ? "bg-amber-100 text-amber-700"
                                : "bg-green-100 text-green-700"
                          }`}
                        >
                          {!selectedSlot.configured
                            ? "Unavailable"
                            : selectedSlot.isFull
                              ? "Slot Full"
                              : `${selectedSlot.remaining} seats left`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600"
              >
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handlePayment}
              disabled={
                isPageLoading ||
                isPaying ||
                isSlotUnavailable ||
                !clinic ||
                !doctor ||
                !patientName.trim() ||
                age === "" ||
                !Number.isInteger(Number(age)) ||
                Number(age) < 0 ||
                Number(age) > 120 ||
                !gender ||
                !Number.isFinite(bookingCharge) ||
                bookingCharge <= 0
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-gray-400 disabled:shadow-none disabled:opacity-70"
            >
              {isPaying ? (
                <>
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                  Processing Payment...
                </>
              ) : isSlotUnavailable ? (
                <>
                  <Clock className="h-5 w-5" />
                  {!appointmentDate || !appointmentTime
                    ? "Select Appointment Slot"
                    : "Slot Full / Unavailable"}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  Pay ₹{bookingCharge.toLocaleString("en-IN")} & Book
                </>
              )}
            </button>

            <p className="text-center text-xs text-gray-400">
              Your appointment is confirmed only after the payment is verified.
            </p>
          </div>
        </div>
      </section>

      <GoUpButton />
    </main>
  );
}
