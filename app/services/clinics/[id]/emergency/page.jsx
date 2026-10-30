"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useParams,
  useRouter,
  useSearchParams,
} from "next/navigation";
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
  AlertCircle,
  ShieldCheck,
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

const CATEGORIES = {
  clinic: "clinics",
  saloon: "saloons",
  "beauty-parlour": "parlour",
  "diagnostic-centre": "diagnostic",
};

function getDoctorId(doctor) {
  const value = doctor?._id ?? doctor?.id;

  if (value === undefined || value === null || value === "") {
    return "";
  }

  if (typeof value === "object") {
    if (typeof value.toHexString === "function") {
      return value.toHexString();
    }

    if (typeof value.$oid === "string") {
      return value.$oid;
    }

    return String(value);
  }

  return String(value);
}

function getDoctorDaySchedule(doctor, dayKey) {
  const schedule = doctor?.schedule;

  if (!schedule || typeof schedule !== "object") {
    return null;
  }

  const matchingKey = Object.keys(schedule).find(
    (key) => key.toLowerCase() === dayKey.toLowerCase()
  );

  return matchingKey ? schedule[matchingKey] : null;
}

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

  return new Date(year, month - 1, day).toLocaleDateString(
    "en-IN",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  );
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

function formatTime(value) {
  if (!value) return "";

  const minutes = parseSlotMinutes(value);

  if (minutes === null) return String(value);

  const date = new Date(2000, 0, 1);
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
      booking?.appointmentTime ??
      "",
    close:
      slot.close ??
      booking?.slotClose ??
      "",
  };
}

function getBookingClinicId(booking) {
  return (
    booking?.clinicId ??
    booking?.businessId ??
    booking?.clinic?.id ??
    booking?.clinic?._id ??
    null
  );
}

function getBookingDoctorId(booking) {
  const value =
    booking?.doctorId ??
    booking?.doctor?._id ??
    booking?.doctor?.id ??
    null;

  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "object") {
    if (typeof value.toHexString === "function") {
      return value.toHexString();
    }

    if (typeof value.$oid === "string") {
      return value.$oid;
    }
  }

  return String(value);
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
  bookings,
  appointmentDate,
  clinicId,
  doctorId
) {
  const capacity = Number(slot.capacity);

  const bookedCount = bookings.filter((booking) => {
    if (!isBookingCountable(booking)) return false;

    const bookingClinicId = getBookingClinicId(booking);
    const bookingDoctorId = getBookingDoctorId(booking);

    const bookingDate = normalizeDate(
      booking.date ??
        booking.appointmentDate ??
        booking.bookingDate
    );

    const bookingSlot = getBookingSlot(booking);

    const bookingOpen = parseSlotMinutes(bookingSlot.open);
    const bookingClose = parseSlotMinutes(bookingSlot.close);
    const slotOpen = parseSlotMinutes(slot.open);
    const slotClose = parseSlotMinutes(slot.close);

    const sameClinic =
      bookingClinicId !== null &&
      String(bookingClinicId) === String(clinicId);

    const sameDoctor =
      bookingDoctorId !== null &&
      String(bookingDoctorId) === String(doctorId);

    const sameDate = bookingDate === appointmentDate;

    const sameSlot =
      bookingOpen !== null &&
      bookingClose !== null &&
      slotOpen !== null &&
      slotClose !== null &&
      bookingOpen === slotOpen &&
      bookingClose === slotClose;

    return sameClinic && sameDoctor && sameDate && sameSlot;
  }).length;

  const configured =
    Number.isFinite(capacity) &&
    Number.isInteger(capacity) &&
    capacity > 0;

  return {
    capacity,
    bookedCount,
    remaining: configured
      ? Math.max(0, capacity - bookedCount)
      : 0,
    configured,
    isFull: !configured || bookedCount >= capacity,
  };
}

function getAvailableDates(doctor) {
  const dates = [];
  const indiaDate = getIndiaDateTime().date;
  const [year, month, day] = indiaDate.split("-").map(Number);

  const today = new Date(year, month - 1, day);

  for (let i = 0; i < 14; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);

    const value = getDateValue(date);
    const dayKey = dayNames[date.getDay()];
    const doctorSchedule = getDoctorDaySchedule(doctor, dayKey);

    const isAvailable =
      doctorSchedule?.active === true &&
      Array.isArray(doctorSchedule?.slots) &&
      doctorSchedule.slots.length > 0;

    dates.push({
      value,
      dayKey,
      dayName: date.toLocaleDateString("en-IN", { weekday: "short" }),
      dayNumber: date.getDate(),
      monthName: date.toLocaleDateString("en-IN", { month: "short" }),
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

function extractBookings(data) {
  if (Array.isArray(data?.bookings)) return data.bookings;
  if (Array.isArray(data?.customers)) return data.customers;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;

  return null;
}

export default function ClinicBookingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const { data: session, status } = useSession();

  const clinicId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const category = (
    searchParams.get("category") || "clinic"
  )
    .trim()
    .toLowerCase();

  const collectionName = CATEGORIES[category];
  const doctorId = searchParams.get("doctor");

  const [clinic, setClinic] = useState(null);
  const [loadingClinic, setLoadingClinic] = useState(true);
  const [clinicError, setClinicError] = useState("");

  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [bookingsError, setBookingsError] = useState("");
  const [bookingRefreshKey, setBookingRefreshKey] = useState(0);

  const [patientName, setPatientName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);

  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");

  const [error, setError] = useState("");
  const [isPaying, setIsPaying] = useState(false);

  // Load clinic details and specified doctor
  useEffect(() => {
    let cancelled = false;

    async function fetchClinic() {
      if (!clinicId) return;

      setLoadingClinic(true);
      setClinicError("");

      try {
        const url = doctorId
          ? `/api/${clinicId}?doctor=${encodeURIComponent(doctorId)}`
          : `/api/${clinicId}`;

        const response = await fetch(url, { cache: "no-store" });
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Failed to load clinic details."
          );
        }

        if (!cancelled) {
          setClinic(data.clinic || null);
        }
      } catch (err) {
        if (!cancelled) {
          setClinicError(
            err.message || "Could not load clinic details."
          );
        }
      } finally {
        if (!cancelled) setLoadingClinic(false);
      }
    }

    fetchClinic();

    return () => {
      cancelled = true;
    };
  }, [clinicId, doctorId]);

  // Prefill patient information
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

  const doctor = useMemo(
    () =>
      clinic?.doctors?.find(
        (item) => getDoctorId(item) === String(doctorId)
      ) ??
      clinic?.doctors?.[0] ??
      null,
    [clinic, doctorId]
  );

  const normalizedDoctorId = getDoctorId(doctor);

  useEffect(() => {
    if (!appointmentDate || !clinicId || !normalizedDoctorId) {
      setBookings([]);
      setBookingsError("");
      setLoadingBookings(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function loadBookings() {
      setLoadingBookings(true);
      setBookingsError("");

      try {
        const query = new URLSearchParams({
          clinicId: String(clinicId),
          doctorId: normalizedDoctorId,
          date: appointmentDate,
          category,
        });

        const response = await fetch(
          `/api/bookings?${query.toString()}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (!response.ok || data.success === false) {
          throw new Error(
            data.message || "Failed to load bookings."
          );
        }

        const records = extractBookings(data);

        if (!records) {
          throw new Error("Invalid bookings API response.");
        }

        if (!cancelled) {
          setBookings(records);
          setBookingsError("");
        }
      } catch (err) {
        if (!cancelled && err.name !== "AbortError") {
          setBookings([]);
          setBookingsError(
            err.message || "Could not load appointment bookings."
          );
        }
      } finally {
        if (!cancelled) setLoadingBookings(false);
      }
    }

    loadBookings();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    clinicId,
    normalizedDoctorId,
    appointmentDate,
    category,
    bookingRefreshKey,
  ]);

  const availableDates = useMemo(
    () => (doctor ? getAvailableDates(doctor) : []),
    [doctor]
  );

  const selectedDoctorSchedule = useMemo(() => {
    if (!doctor || !appointmentDate) return null;

    const [year, month, day] = appointmentDate
      .split("-")
      .map(Number);

    const selectedDate = new Date(year, month - 1, day);
    const dayKey = dayNames[selectedDate.getDay()];

    return getDoctorDaySchedule(doctor, dayKey);
  }, [doctor, appointmentDate]);

  const availableTimes = useMemo(() => {
    if (
      !appointmentDate ||
      !selectedDoctorSchedule?.active ||
      !Array.isArray(selectedDoctorSchedule?.slots)
    ) {
      return [];
    }

    const { date: today, minutes: currentMinutes } = getIndiaDateTime();
    const isToday = appointmentDate === today;

    return selectedDoctorSchedule.slots
      .filter((slot) => {
        const slotStart = parseSlotMinutes(slot.open);
        const slotEnd = parseSlotMinutes(slot.close);

        if (slotStart === null || slotEnd === null) return false;
        if (slotEnd <= slotStart) return false;
        if (!isToday) return true;

        return slotEnd > currentMinutes;
      })
      .map((slot, index) => {
        const capacityInfo = getSlotCapacityInfo(
          slot,
          bookings,
          appointmentDate,
          clinicId,
          normalizedDoctorId
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
    bookings,
    clinicId,
    normalizedDoctorId,
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
    status === "loading" || loadingClinic || profileLoading;

  const handleSelectDate = (dateVal) => {
    setAppointmentDate(dateVal);
    setAppointmentTime("");
    setError("");
  };

  const validateForm = () => {
    setError("");

    if (status !== "authenticated") {
      setError("Please log in before booking an appointment.");
      return false;
    }

    if (!collectionName) {
      setError("Invalid business category.");
      return false;
    }

    if (!clinic || !doctor || !normalizedDoctorId) {
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
      !Array.isArray(selectedDoctorSchedule?.slots) ||
      selectedDoctorSchedule.slots.length === 0
    ) {
      setError("The doctor is not available on the selected date.");
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
      setError("This appointment slot is full. Please select another slot.");
      return false;
    }

    if (bookingsError) {
      setError(
        "Patient availability could not be verified. Please retry."
      );
      return false;
    }

    if (!Number.isFinite(bookingCharge) || bookingCharge <= 0) {
      setError("The booking charge is not configured for this doctor.");
      return false;
    }

    return true;
  };

  const handlePayment = async () => {
    if (isPaying || isPageLoading) return;
    if (!validateForm()) return;

    setIsPaying(true);
    setError("");

    try {
      const query = new URLSearchParams({
        clinicId: String(clinicId),
        doctorId: normalizedDoctorId,
        date: appointmentDate,
        category,
      });

      const bookingsResponse = await fetch(
        `/api/bookings?${query.toString()}`,
        {
          method: "GET",
          cache: "no-store",
          headers: { Accept: "application/json" },
        }
      );

      const bookingsData = await bookingsResponse.json();

      if (!bookingsResponse.ok || bookingsData.success === false) {
        throw new Error(
          bookingsData.message ||
            "Unable to verify current patient availability."
        );
      }

      const latestBookings = extractBookings(bookingsData);

      if (!latestBookings) {
        throw new Error("Invalid bookings API response.");
      }

      setBookings(latestBookings);

      const slot = selectedDoctorSchedule?.slots?.find(
        (item) => item.open === appointmentTime
      );

      if (!slot) {
        throw new Error("This slot is no longer available.");
      }

      const latestCapacity = getSlotCapacityInfo(
        slot,
        latestBookings,
        appointmentDate,
        clinicId,
        normalizedDoctorId
      );

      if (!latestCapacity.configured || latestCapacity.isFull) {
        setAppointmentTime("");
        throw new Error("This appointment slot is now full.");
      }

      const { date: today, minutes: currentMinutes } = getIndiaDateTime();
      const slotEnd = parseSlotMinutes(slot.close);

      if (
        appointmentDate < today ||
        (appointmentDate === today &&
          slotEnd !== null &&
          slotEnd <= currentMinutes)
      ) {
        setAppointmentTime("");
        throw new Error("This appointment time has already passed.");
      }

      const orderResponse = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          clinicId: String(clinicId),
          doctorId: normalizedDoctorId,
          patientName: patientName.trim(),
          age: Number(age),
          gender,
          date: appointmentDate,
          time: appointmentTime,
          slot: { open: slot.open, close: slot.close },
        }),
      });

      const orderData = await orderResponse.json();

      if (!orderResponse.ok || orderData.success === false) {
        throw new Error(
          orderData.message || "Failed to create payment order."
        );
      }

      const scriptLoaded = await loadRazorpayScript();

      if (!scriptLoaded || !window.Razorpay) {
        throw new Error("Razorpay Checkout failed to load.");
      }

      const checkout = new window.Razorpay({
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "Zeric",
        description: `Appointment - ${doctor.name}`,
        order_id: orderData.orderId,
        prefill: {
          name: patientName.trim(),
          email: session?.user?.email || "",
        },
        notes: {
          clinicId: String(clinicId),
          doctorId: normalizedDoctorId,
          appointmentDate,
          category,
        },
        theme: { color: "#4f46e5" },
        modal: {
          ondismiss: () => setIsPaying(false),
        },
        handler: async (paymentResponse) => {
          try {
            const verifyResponse = await fetch("/api/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(paymentResponse),
            });

            const verifyData = await verifyResponse.json();

            if (!verifyResponse.ok || !verifyData.success) {
              setError(
                verifyData.message || "Payment verification failed."
              );
              setIsPaying(false);
              return;
            }

            router.push("/my-bookings");
          } catch {
            setError(
              "Payment verification failed. Please check My Bookings."
            );
            setIsPaying(false);
          }
        },
      });

      checkout.on("payment.failed", (response) => {
        setError(
          response?.error?.description || "Payment failed."
        );
        setIsPaying(false);
      });

      checkout.open();
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setIsPaying(false);
    }
  };

  if (isPageLoading) {
    return <LoadingScreen />;
  }

  if (status === "unauthenticated") {
    return (
      <main className="min-h-screen bg-slate-50/50">
        <Header showBack={false} />
        <div className="flex min-h-[65vh] items-center justify-center text-sm font-medium text-slate-500">
          Redirecting to login...
        </div>
      </main>
    );
  }

  if (clinicError || !clinic || !doctor) {
    return (
      <main className="min-h-screen bg-slate-50/50">
        <Header showBack={false} />
        <div className="mx-auto flex min-h-[70vh] max-w-lg items-center justify-center px-4">
          <div className="w-full rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <Stethoscope className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-xl font-bold text-slate-900">
              {clinicError ? "Unable to Load Details" : "Doctor Not Found"}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {clinicError ||
                "The requested doctor or clinic details could not be retrieved."}
            </p>
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/${category === "clinic" ? "clinics" : collectionName}/${clinicId}`
                )
              }
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Return to Clinic
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50/60 pb-16">
      <Header showBack={false} />

      <section className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Back Button */}
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-6 inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm border border-slate-200/80 transition hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>

        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/40">
          {/* Header Banner */}
          <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 via-white to-white p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-200">
                  <CalendarDays className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                    Book Consultation
                  </h1>
                  <p className="text-xs font-medium text-slate-500">
                    Patient: {session?.user?.email || session?.user?.name}
                  </p>
                </div>
              </div>

              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200/60">
                <ShieldCheck className="h-3.5 w-3.5" />
                Verified Doctor
              </span>
            </div>
          </div>

          <div className="space-y-8 p-6 sm:p-8">
            {/* Doctor Card */}
            <div className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-slate-50/50 p-5 sm:p-6 transition hover:border-indigo-200">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-100/70 text-indigo-600">
                  <Stethoscope className="h-6 w-6" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-base font-bold text-slate-900 sm:text-lg">
                      {doctor.name}
                    </h2>
                    <span className="text-xs font-medium text-slate-500">
                      Fee:{" "}
                      <strong className="text-indigo-600 text-sm font-bold">
                        ₹{bookingCharge.toLocaleString("en-IN")}
                      </strong>
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-indigo-600">
                    {doctor.specialization}
                    {doctor.experience != null &&
                      ` • ${doctor.experience} yrs exp`}
                  </p>

                  <div className="mt-3 space-y-1 text-xs text-slate-500">
                    <p className="font-semibold text-slate-700">
                      {clinic.name}
                    </p>
                    <p className="flex items-start gap-1 text-slate-500">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                      {clinic.address}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 border border-slate-200/60">
                      <Clock className="h-3 w-3 text-indigo-500" />
                      {doctor.duration || 30} mins
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 border border-slate-200/60">
                      <User className="h-3 w-3 text-indigo-500" />
                      In-clinic
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Patient Form */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold tracking-tight text-slate-900 uppercase text-slate-400">
                  1. Patient Details
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="patientName"
                    className="mb-1.5 block text-xs font-bold text-slate-700"
                  >
                    Patient Name
                  </label>
                  <input
                    id="patientName"
                    type="text"
                    value={patientName}
                    onChange={(e) => {
                      setPatientName(e.target.value);
                      setError("");
                    }}
                    placeholder="Full name"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                  />
                </div>

                <div>
                  <label
                    htmlFor="age"
                    className="mb-1.5 block text-xs font-bold text-slate-700"
                  >
                    Age
                  </label>
                  <input
                    id="age"
                    type="number"
                    min="0"
                    max="120"
                    value={age}
                    onChange={(e) => {
                      setAge(e.target.value);
                      setError("");
                    }}
                    placeholder="Age in years"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                  />
                </div>

                <div>
                  <label
                    htmlFor="gender"
                    className="mb-1.5 block text-xs font-bold text-slate-700"
                  >
                    Gender
                  </label>
                  <select
                    id="gender"
                    value={gender}
                    onChange={(e) => {
                      setGender(e.target.value);
                      setError("");
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Date Selection Grid */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold tracking-tight text-slate-900 uppercase text-slate-400">
                  2. Select Date
                </h3>
              </div>

              <div className="flex gap-2.5 overflow-x-auto pb-2 pt-1 scrollbar-thin">
                {availableDates.map((date) => {
                  const isSelected = appointmentDate === date.value;
                  const isDisabled = date.isClosed;

                  return (
                    <button
                      key={date.value}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => handleSelectDate(date.value)}
                      className={`flex min-w-[76px] flex-col items-center justify-center rounded-2xl border px-3 py-3 text-center transition ${
                        isDisabled
                          ? "border-slate-100 bg-slate-50/80 text-slate-300 cursor-not-allowed"
                          : isSelected
                            ? "border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-200 ring-2 ring-indigo-600 ring-offset-2"
                            : "border-slate-200/80 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/30"
                      }`}
                    >
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider ${
                          isSelected ? "text-indigo-100" : "text-slate-400"
                        }`}
                      >
                        {date.dayName}
                      </span>
                      <span className="text-lg font-black my-0.5">
                        {date.dayNumber}
                      </span>
                      <span
                        className={`text-[10px] font-semibold ${
                          isSelected ? "text-indigo-100" : "text-slate-500"
                        }`}
                      >
                        {date.monthName}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Slot Picker */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold tracking-tight text-slate-900 uppercase text-slate-400">
                  3. Select Time Block
                </h3>
              </div>

              {!appointmentDate ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
                  <Clock className="mx-auto h-6 w-6 text-slate-300" />
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    Please select an appointment date above
                  </p>
                </div>
              ) : !selectedDoctorSchedule?.active ||
                !selectedDoctorSchedule?.slots?.length ? (
                <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-5 text-center">
                  <AlertCircle className="mx-auto h-5 w-5 text-rose-500" />
                  <p className="mt-1 text-xs font-bold text-rose-700">
                    Doctor Unavailable
                  </p>
                  <p className="text-[11px] text-rose-600">
                    The doctor does not hold consultations on this day.
                  </p>
                </div>
              ) : loadingBookings ? (
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-6 text-center">
                  <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-indigo-600" />
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    Checking available slot capacities...
                  </p>
                </div>
              ) : bookingsError ? (
                <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-5 text-center">
                  <p className="text-xs font-bold text-rose-700">
                    Failed to fetch capacity counts
                  </p>
                  <button
                    type="button"
                    onClick={() => setBookingRefreshKey((k) => k + 1)}
                    className="mt-2 text-xs font-semibold text-rose-700 underline"
                  >
                    Retry
                  </button>
                </div>
              ) : availableTimes.length === 0 ? (
                <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-5 text-center">
                  <Clock className="mx-auto h-5 w-5 text-amber-500" />
                  <p className="mt-1 text-xs font-bold text-amber-800">
                    All Slots Closed
                  </p>
                  <p className="text-[11px] text-amber-700">
                    There are no active consultation blocks remaining for this date.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {availableTimes.map((slot) => {
                    const isSelected = appointmentTime === slot.open;
                    const isDisabled = !slot.configured || slot.isFull;

                    return (
                      <button
                        key={slot.id}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          setAppointmentTime(slot.open);
                          setError("");
                        }}
                        className={`group relative rounded-2xl border p-4 text-left transition ${
                          isDisabled
                            ? "border-slate-200/60 bg-slate-50 text-slate-400 cursor-not-allowed opacity-75"
                            : isSelected
                              ? "border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-100 ring-2 ring-indigo-600 ring-offset-1"
                              : "border-slate-200 bg-white text-slate-800 hover:border-indigo-300 hover:bg-indigo-50/30"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold tracking-tight">
                            {slot.label}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              isDisabled
                                ? "bg-rose-100 text-rose-700"
                                : isSelected
                                  ? "bg-white/20 text-white"
                                  : slot.remaining <= 2
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {!slot.configured
                              ? "Unavailable"
                              : slot.isFull
                                ? "Full"
                                : `${slot.remaining} left`}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center justify-between text-xs">
                          <span
                            className={`font-medium ${
                              isSelected ? "text-indigo-100" : "text-slate-500"
                            }`}
                          >
                            Capacity
                          </span>
                          <span
                            className={`font-bold ${
                              isSelected ? "text-white" : "text-slate-700"
                            }`}
                          >
                            {slot.configured
                              ? `${Math.min(slot.bookedCount, slot.capacity)}/${slot.capacity}`
                              : "N/A"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selected Booking Summary */}
            {appointmentDate && appointmentTime && selectedSlot && (
              <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50/80 to-white p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-indigo-600 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                      Summary
                    </p>
                    <p className="text-sm font-bold text-slate-900">
                      {formatDate(appointmentDate)} ({formatTime(appointmentTime)})
                    </p>
                    <p className="text-xs text-slate-500">
                      Amount Payable:{" "}
                      <strong className="text-slate-800 font-bold">
                        ₹{bookingCharge.toLocaleString("en-IN")}
                      </strong>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Validation Error Banner */}
            {error && (
              <div
                role="alert"
                className="flex items-center gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit & Pay Button */}
            <button
              type="button"
              onClick={handlePayment}
              disabled={
                isPageLoading ||
                isPaying ||
                loadingBookings ||
                !!bookingsError ||
                isSlotUnavailable ||
                !clinic ||
                !doctor ||
                !normalizedDoctorId ||
                !patientName.trim() ||
                age === "" ||
                !Number.isInteger(Number(age)) ||
                Number(age) < 0 ||
                Number(age) > 120 ||
                !gender ||
                !Number.isFinite(bookingCharge) ||
                bookingCharge <= 0
              }
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-indigo-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            >
              {isPaying ? (
                <>
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                  Processing Payment...
                </>
              ) : loadingBookings ? (
                <>
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                  Checking Slot Availability...
                </>
              ) : isSlotUnavailable ? (
                <>
                  <Clock className="h-5 w-5" />
                  {!appointmentDate || !appointmentTime
                    ? "Select Date & Time"
                    : "Slot Full / Unavailable"}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  Pay ₹{bookingCharge.toLocaleString("en-IN")} & Confirm
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      <GoUpButton />
    </main>
  );
}