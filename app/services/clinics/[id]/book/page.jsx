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
  Sparkles,
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

const CATEGORIES = {
  clinic: "clinics",
  saloon: "saloons",
  "beauty-parlour": "parlour",
  "diagnostic-centre": "diagnostic",
};

const CATEGORY_LABELS = {
  clinic: {
    business: "Clinic",
    provider: "Doctor",
    customer: "Patient",
    route: "clinics",
  },
  saloon: {
    business: "Salon",
    provider: "Stylist",
    customer: "Customer",
    route: "saloons",
  },
  "beauty-parlour": {
    business: "Beauty Parlour",
    provider: "Specialist",
    customer: "Customer",
    route: "parlour",
  },
  "diagnostic-centre": {
    business: "Diagnostic Centre",
    provider: "Specialist",
    customer: "Patient",
    route: "diagnostic",
  },
};

function getProviderId(provider) {
  const value =
    provider?._id ??
    provider?.id ??
    provider?.teamMemberId ??
    provider?.employeeId;

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
  }

  return String(value);
}

function getDateValue(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
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

  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i.exec(
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

  const getPart = (type) => parts.find((part) => part.type === type)?.value;

  return {
    date: `${getPart("year")}-${getPart("month")}-${getPart("day")}`,
    minutes: Number(getPart("hour")) * 60 + Number(getPart("minute")),
  };
}

function getProviderDaySchedule(provider, dayKey, dateValue) {
  if (
    dateValue &&
    Array.isArray(provider?.holidayDates) &&
    provider.holidayDates.some((date) => normalizeDate(date) === dateValue)
  ) {
    return {
      active: false,
      slots: [],
      isHoliday: true,
    };
  }

  const schedule = provider?.schedule;

  if (!schedule || typeof schedule !== "object") {
    return null;
  }

  const matchingKey = Object.keys(schedule).find(
    (key) => key.toLowerCase() === dayKey.toLowerCase()
  );

  return matchingKey ? schedule[matchingKey] : null;
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
    close: slot.close ?? booking?.slotClose ?? "",
  };
}

function getBookingBusinessId(booking) {
  return (
    booking?.clinicId ??
    booking?.storeId ??
    booking?.businessId ??
    booking?.clinic?.id ??
    booking?.clinic?._id ??
    booking?.store?.id ??
    booking?.store?._id ??
    null
  );
}

function getBookingProviderId(booking) {
  const value =
    booking?.doctorId ??
    booking?.staffId ??
    booking?.providerId ??
    booking?.doctor?._id ??
    booking?.doctor?.id ??
    booking?.staff?._id ??
    booking?.staff?.id ??
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
  const paymentStatus = String(booking?.paymentStatus || "").toLowerCase();

  if (
    ["cancelled", "canceled", "no-show", "noshow", "rejected"].includes(status)
  ) {
    return false;
  }

  if (["failed", "unpaid", "refunded"].includes(paymentStatus)) {
    return false;
  }

  return true;
}

function getSlotCapacityInfo(
  slot,
  bookings,
  appointmentDate,
  businessId,
  providerId
) {
  const capacity = Number(slot.capacity);

  const bookedCount = bookings.filter((booking) => {
    if (!isBookingCountable(booking)) return false;

    const bookingBusinessId = getBookingBusinessId(booking);
    const bookingProviderId = getBookingProviderId(booking);

    const bookingDate = normalizeDate(
      booking.date ?? booking.appointmentDate ?? booking.bookingDate
    );

    const bookingSlot = getBookingSlot(booking);
    const bookingOpen = parseSlotMinutes(bookingSlot.open);
    const bookingClose = parseSlotMinutes(bookingSlot.close);

    const slotOpen = parseSlotMinutes(slot.open);
    const slotClose = parseSlotMinutes(slot.close);

    const sameBusiness =
      bookingBusinessId !== null &&
      String(bookingBusinessId) === String(businessId);

    const sameProvider =
      bookingProviderId !== null &&
      String(bookingProviderId) === String(providerId);

    const sameDate = bookingDate === appointmentDate;

    const sameSlot =
      bookingOpen !== null &&
      bookingClose !== null &&
      slotOpen !== null &&
      slotClose !== null &&
      bookingOpen === slotOpen &&
      bookingClose === slotClose;

    return sameBusiness && sameProvider && sameDate && sameSlot;
  }).length;

  const configured =
    Number.isFinite(capacity) &&
    Number.isInteger(capacity) &&
    capacity > 0;

  return {
    capacity,
    bookedCount,
    remaining: configured ? Math.max(0, capacity - bookedCount) : 0,
    configured,
    isFull: !configured || bookedCount >= capacity,
  };
}

function getAvailableDates(provider) {
  const dates = [];
  const indiaDate = getIndiaDateTime().date;
  const [year, month, day] = indiaDate.split("-").map(Number);
  const today = new Date(year, month - 1, day);

  for (let i = 0; i < 14; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);

    const value = getDateValue(date);
    const dayKey = dayNames[date.getDay()];

    const providerSchedule = getProviderDaySchedule(provider, dayKey, value);
    const isHoliday = providerSchedule?.isHoliday === true;

    const isAvailable =
      !isHoliday &&
      providerSchedule?.active === true &&
      Array.isArray(providerSchedule?.slots) &&
      providerSchedule.slots.length > 0;

    dates.push({
      value,
      dayKey,
      label: date.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }),
      providerSchedule,
      isHoliday,
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

    const scriptUrl = "https://checkout.razorpay.com/v1/checkout.js";
    const existingScript = document.querySelector(`script[src="${scriptUrl}"]`);

    if (existingScript) {
      if (existingScript.dataset.loaded === "true") {
        resolve(true);
        return;
      }

      existingScript.addEventListener("load", () => resolve(true), {
        once: true,
      });
      existingScript.addEventListener("error", () => resolve(false), {
        once: true,
      });
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

export default function BookingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();

  const businessId = Array.isArray(params.id) ? params.id[0] : params.id;

  const category = (searchParams.get("category") || "clinic")
    .trim()
    .toLowerCase();

  const collectionName = CATEGORIES[category];
  const labels = CATEGORY_LABELS[category] || CATEGORY_LABELS.clinic;

  const isClinic = category === "clinic";
  const isMedical = category === "clinic" || category === "diagnostic-centre";

  const clinicId = isClinic ? businessId : "";
  const storeId = !isClinic ? businessId : "";

  const doctorId = isClinic ? searchParams.get("doctor") : "";
  const staffId = !isClinic
    ? searchParams.get("staff") || searchParams.get("doctor")
    : "";

  const providerId = isClinic ? doctorId : staffId;

  const [business, setBusiness] = useState(null);
  const [loadingBusiness, setLoadingBusiness] = useState(true);
  const [businessError, setBusinessError] = useState("");

  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [bookingsError, setBookingsError] = useState("");
  const [bookingRefreshKey, setBookingRefreshKey] = useState(0);

  const [customerName, setCustomerName] = useState(session?.user?.name || "");
  const [phone, setPhone] = useState(
    session?.user?.phone || session?.user?.mobile || ""
  );
  const [bookingFor, setBookingFor] = useState("self");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("Male");

  const [appointmentDate, setAppointmentDate] = useState(
    () => getIndiaDateTime().date
  );
  const [appointmentTime, setAppointmentTime] = useState("");

  const [error, setError] = useState("");
  const [isPaying, setIsPaying] = useState(false);

  // Redirect unauthenticated users to login.
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  // Prefill profile information.
  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const response = await fetch("/api/profile", { cache: "no-store" });
        const data = await response.json();

        if (!response.ok || !data.success || cancelled) {
          return;
        }

        const profile = data.profile || data.user || data;
        if (cancelled) return;

        setCustomerName(
          (previous) => previous || profile.name || profile.fullName || ""
        );
        setAge((previous) =>
          previous !== ""
            ? previous
            : profile.age != null
            ? String(profile.age)
            : ""
        );
        setGender(profile.gender || "Male");
        setPhone(
          (previous) => previous || profile.phone || profile.mobile || ""
        );
      } catch (err) {
        console.error("Profile loading failed:", err);
      }
    }

    if (status === "authenticated") {
      loadProfile();
    }

    return () => {
      cancelled = true;
    };
  }, [status]);

  // Load business details across all categories.
  useEffect(() => {
    let cancelled = false;

    async function fetchBusiness() {
      if (!businessId || !collectionName) {
        setLoadingBusiness(false);
        if (!collectionName) {
          setBusinessError("Invalid business category.");
        }
        return;
      }

      setLoadingBusiness(true);
      setBusinessError("");

      try {
        const providerParam = isClinic ? "doctor" : "staff";
        const query = providerId
          ? `?${providerParam}=${encodeURIComponent(providerId)}`
          : "";

        const url = `/api/${collectionName}/${businessId}${query}`;

        const response = await fetch(url, { cache: "no-store" });
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message ||
              `Failed to load ${labels.business.toLowerCase()} details.`
          );
        }

        const resolvedBusiness =
          data.clinic || data.store || data.business || data[category] || null;

        if (!cancelled) {
          setBusiness(resolvedBusiness);
        }
      } catch (err) {
        if (!cancelled) {
          setBusinessError(
            err.message ||
              `Could not load ${labels.business.toLowerCase()} details.`
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingBusiness(false);
        }
      }
    }

    fetchBusiness();

    return () => {
      cancelled = true;
    };
  }, [businessId, collectionName, isClinic, providerId, category, labels.business]);

  const providers = useMemo(() => {
    if (!business) return [];
    if (isClinic) return business.doctors || [];
    return business.staff || business.team || business.doctors || [];
  }, [business, isClinic]);

  const provider = useMemo(
    () =>
      providers.find((item) => getProviderId(item) === String(providerId)) ||
      providers[0] ||
      null,
    [providers, providerId]
  );

  const normalizedProviderId = getProviderId(provider);

  // Initialize bookings from provider payload.
  useEffect(() => {
    if (provider?.bookings && Array.isArray(provider.bookings)) {
      setBookings(provider.bookings);
    }
  }, [provider]);

  const availableDates = useMemo(
    () => (provider ? getAvailableDates(provider) : []),
    [provider]
  );

  // Select a valid date when the current date is unavailable.
  useEffect(() => {
    if (!availableDates.length) return;

    const currentDateInfo = availableDates.find(
      (date) => date.value === appointmentDate
    );

    if (currentDateInfo && !currentDateInfo.isClosed) {
      return;
    }

    const firstAvailableDate = availableDates.find((date) => !date.isClosed);
    const nextDate = firstAvailableDate?.value || availableDates[0].value;

    if (appointmentDate !== nextDate) {
      setAppointmentDate(nextDate);
      setAppointmentTime("");
    }
  }, [availableDates, appointmentDate]);

  const selectedDateInfo = useMemo(
    () => availableDates.find((item) => item.value === appointmentDate),
    [availableDates, appointmentDate]
  );

  const selectedProviderSchedule = useMemo(() => {
    if (!provider || !appointmentDate) return null;

    const [year, month, day] = appointmentDate.split("-").map(Number);
    const selectedDate = new Date(year, month - 1, day);
    const dayKey = dayNames[selectedDate.getDay()];

    return getProviderDaySchedule(provider, dayKey, appointmentDate);
  }, [provider, appointmentDate]);

  // Fetch bookings for selected date.
  useEffect(() => {
    if (!appointmentDate || !businessId || !normalizedProviderId) {
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
        const queryParams = {
          date: appointmentDate,
          category,
          businessId: String(businessId),
          providerId: normalizedProviderId,
        };

        if (isClinic) {
          queryParams.clinicId = String(clinicId);
          queryParams.doctorId = normalizedProviderId;
        } else {
          queryParams.storeId = String(storeId);
          queryParams.staffId = normalizedProviderId;
        }

        const query = new URLSearchParams(queryParams);

        const response = await fetch(`/api/bookings?${query.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        const data = await response.json();

        if (!response.ok || data.success === false) {
          throw new Error(data.message || "Failed to load bookings.");
        }

        const records = Array.isArray(data?.bookings)
          ? data.bookings
          : Array.isArray(data?.data)
          ? data.data
          : null;

        if (!records) {
          throw new Error("Invalid bookings response payload.");
        }

        if (!cancelled) {
          setBookings(records);
          setBookingsError("");
        }
      } catch (err) {
        if (!cancelled && err.name !== "AbortError") {
          setBookingsError(
            err.message || "Could not load appointment bookings."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingBookings(false);
        }
      }
    }

    loadBookings();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    businessId,
    clinicId,
    storeId,
    isClinic,
    normalizedProviderId,
    appointmentDate,
    category,
    bookingRefreshKey,
  ]);

  // Calculate available appointment slots.
  const availableTimes = useMemo(() => {
    if (
      !appointmentDate ||
      !selectedProviderSchedule?.active ||
      !Array.isArray(selectedProviderSchedule?.slots)
    ) {
      return [];
    }

    const { date: today, minutes: currentMinutes } = getIndiaDateTime();
    const isToday = appointmentDate === today;

    return selectedProviderSchedule.slots
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
          businessId,
          normalizedProviderId
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
    selectedProviderSchedule,
    bookings,
    businessId,
    normalizedProviderId,
  ]);

  useEffect(() => {
    if (!appointmentTime) return;

    const stillAvailable = availableTimes.some(
      (slot) =>
        slot.open === appointmentTime && slot.configured && !slot.isFull
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
    provider?.bookingCharge ?? provider?.fee ?? provider?.price ?? 0
  );

  const isPageLoading = status === "loading" || loadingBusiness;

  const handleDateChange = (dateValue) => {
    setAppointmentDate(dateValue);
    setAppointmentTime("");
    setError("");
  };

  // Validate all customer/patient and appointment details.
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

    if (!business || !provider || !normalizedProviderId) {
      setError(
        `${labels.business} or ${labels.provider.toLowerCase()} details could not be found.`
      );
      return false;
    }

    if (!customerName.trim()) {
      setError(`Please enter the ${labels.customer.toLowerCase()} name.`);
      return false;
    }

    const normalizedPhone = String(phone || "").replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(normalizedPhone)) {
      setError("Please enter a valid 10-digit Indian mobile number.");
      return false;
    }

    if (age === "") {
      setError(`Please enter the ${labels.customer.toLowerCase()} age.`);
      return false;
    }

    const numericAge = Number(age);
    if (!Number.isInteger(numericAge) || numericAge < 0 || numericAge > 120) {
      setError("Please enter a valid age between 0 and 120.");
      return false;
    }

    if (!gender) {
      setError(`Please select the ${labels.customer.toLowerCase()}'s gender.`);
      return false;
    }

    if (!["self", "other"].includes(bookingFor)) {
      setError("Please select who the booking is for.");
      return false;
    }

    if (!appointmentDate) {
      setError("Please select an appointment date.");
      return false;
    }

    if (selectedProviderSchedule?.isHoliday) {
      setError(
        `The ${labels.provider.toLowerCase()} is on holiday on the selected date.`
      );
      return false;
    }

    if (
      !selectedProviderSchedule?.active ||
      !Array.isArray(selectedProviderSchedule?.slots) ||
      selectedProviderSchedule.slots.length === 0
    ) {
      setError(
        `The ${labels.provider.toLowerCase()} is not available on the selected date.`
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
      setError(
        "This appointment slot is no longer available. Please select another slot."
      );
      return false;
    }

    if (!currentSlot.configured) {
      setError(
        `Capacity is not configured for this slot. Please contact the ${labels.business.toLowerCase()}.`
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

    if (bookingsError) {
      setError(
        "Availability could not be verified. Please refresh the booking counts and try again."
      );
      return false;
    }

    if (!Number.isFinite(bookingCharge) || bookingCharge <= 0) {
      setError(
        `The booking charge is not configured for this ${labels.provider.toLowerCase()}.`
      );
      return false;
    }

    return true;
  };

  // Create order, open Razorpay, and verify payment.
  const handlePayment = async () => {
    if (isPaying || isPageLoading) return;
    if (!validateForm()) return;

    setIsPaying(true);
    setError("");

    try {
      const queryParams = {
        date: appointmentDate,
        category,
        businessId: String(businessId),
        providerId: normalizedProviderId,
      };

      if (isClinic) {
        queryParams.clinicId = String(clinicId);
        queryParams.doctorId = normalizedProviderId;
      } else {
        queryParams.storeId = String(storeId);
        queryParams.staffId = normalizedProviderId;
      }

      const query = new URLSearchParams(queryParams);

      // Recheck availability before creating the order.
      const bookingsResponse = await fetch(
        `/api/bookings?${query.toString()}`,
        {
          method: "GET",
          cache: "no-store",
          headers: { Accept: "application/json" },
        }
      );

      const bookingsData = await bookingsResponse.json().catch(() => ({}));

      if (!bookingsResponse.ok || bookingsData.success === false) {
        throw new Error(
          bookingsData.message ||
            "Unable to verify current appointment availability."
        );
      }

      const latestBookings = Array.isArray(bookingsData?.bookings)
        ? bookingsData.bookings
        : Array.isArray(bookingsData?.data)
        ? bookingsData.data
        : null;

      if (!latestBookings) {
        throw new Error("The bookings API returned an invalid response.");
      }

      setBookings(latestBookings);

      const slot = selectedProviderSchedule?.slots?.find(
        (item) => item.open === appointmentTime
      );

      if (!slot) {
        throw new Error("This appointment slot is no longer available.");
      }

      const latestCapacity = getSlotCapacityInfo(
        slot,
        latestBookings,
        appointmentDate,
        businessId,
        normalizedProviderId
      );

      if (!latestCapacity.configured || latestCapacity.isFull) {
        setAppointmentTime("");
        throw new Error(
          "This appointment slot is full or its capacity is not configured. Please choose another slot."
        );
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
        throw new Error(
          "This appointment time has already passed. Please select another slot."
        );
      }

      const normalizedPhone = String(phone || "").replace(/\D/g, "");
      if (!/^[6-9]\d{9}$/.test(normalizedPhone)) {
        throw new Error("Please enter a valid 10-digit mobile number.");
      }

      const orderPayload = {
        category,
        businessId: String(businessId),
        providerId: normalizedProviderId,
        ...(isClinic
          ? {
              clinicId: String(clinicId),
              doctorId: normalizedProviderId,
            }
          : {
              storeId: String(storeId),
              staffId: normalizedProviderId,
            }),
        patientName: customerName.trim(),
        customerName: customerName.trim(),
        patientPhone: normalizedPhone,
        phone: normalizedPhone,
        patientType: bookingFor,
        bookingFor,
        age: Number(age),
        gender,
        appointmentDate,
        date: appointmentDate,
        time: slot.open,
        slot: {
          open: slot.open,
          close: slot.close,
        },
        priority: "normal",
        isEmergency: false,
        bookingType: "appointment",
      };

      // Create Razorpay order.
      const orderResponse = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });

      const orderData = await orderResponse.json().catch(() => ({}));

      if (!orderResponse.ok || orderData.success === false) {
        throw new Error(
          orderData.message || "Failed to create payment order."
        );
      }

      if (
        !orderData.key ||
        !orderData.orderId ||
        !Number.isFinite(Number(orderData.amount)) ||
        Number(orderData.amount) <= 0
      ) {
        throw new Error(
          "The payment API returned incomplete Razorpay order details."
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
        currency: orderData.currency || "INR",
        name: "Zeriy",
        description: `Appointment booking - ${
          provider.name || provider.fullName || labels.provider
        }`,
        order_id: orderData.orderId,
        prefill: {
          name: customerName.trim(),
          email: session?.user?.email || "",
          contact: normalizedPhone,
        },
        notes: {
          businessId: String(businessId),
          providerId: normalizedProviderId,
          ...(isClinic
            ? { clinicId: String(clinicId), doctorId: normalizedProviderId }
            : { storeId: String(storeId), staffId: normalizedProviderId }),
          appointmentDate,
          category,
          patientType: bookingFor,
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
            const verifyResponse = await fetch("/api/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(paymentResponse),
            });

            const verifyData = await verifyResponse.json().catch(() => ({}));

            if (!verifyResponse.ok || !verifyData.success) {
              setError(
                verifyData.message ||
                  "Payment verification failed. Please check My Bookings before attempting another payment."
              );
              setIsPaying(false);
              return;
            }

            router.replace("/my-bookings");
          } catch (err) {
            console.error("Payment verification error:", err);
            setError(
              "Payment was submitted, but verification could not be confirmed. Please check My Bookings before attempting another payment."
            );
            setIsPaying(false);
          }
        },
      });

      checkout.on("payment.failed", (response) => {
        setError(
          response?.error?.description || "Payment failed. Please try again."
        );
        setIsPaying(false);
      });

      checkout.open();
    } catch (err) {
      console.error("Appointment payment error:", err);
      setError(err.message || "Something went wrong. Please try again.");
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

  if (businessError || !business || !provider) {
    return (
      <main className="min-h-screen bg-gray-50">
        <Header showBack={false} />
        <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center px-4">
          <div className="w-full rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
              {isMedical ? (
                <Stethoscope className="h-6 w-6 text-red-500" />
              ) : (
                <Sparkles className="h-6 w-6 text-red-500" />
              )}
            </div>

            <h1 className="mt-4 text-xl font-bold text-gray-900">
              {businessError
                ? `Unable to Load ${labels.business}`
                : "Booking Details Not Found"}
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              {businessError ||
                `The selected ${labels.business.toLowerCase()} or ${labels.provider.toLowerCase()} could not be found. Please return and select again.`}
            </p>

            <button
              type="button"
              onClick={() =>
                router.push(`/${labels.route}/${businessId || ""}`)
              }
              className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-indigo-600"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          </div>
        </div>
      </main>
    );
  }

  const businessAddress = [
    business.address,
    business.area,
    business.city,
    business.state,
    business.pincode,
  ]
    .filter(Boolean)
    .join(", ");

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
          Back to {labels.business}
        </button>

        {/* Business & Provider Summary Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                {isMedical ? (
                  <Stethoscope className="h-3.5 w-3.5" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {labels.business}
              </span>

              <h1 className="mt-2 text-xl font-bold text-gray-900 sm:text-2xl">
                {business.name || business.clinicName || business.storeName}
              </h1>

              {businessAddress && (
                <p className="mt-1 flex items-start gap-1.5 text-sm text-gray-500">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <span>{businessAddress}</span>
                </p>
              )}
            </div>

            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 sm:text-right">
              <p className="text-xs font-medium text-indigo-600">
                {labels.provider}
              </p>
              <p className="text-base font-bold text-gray-900">
                {provider.name || provider.fullName}
              </p>
              {(provider.specialization || provider.role || provider.designation) && (
                <p className="text-xs text-gray-600">
                  {provider.specialization || provider.role || provider.designation}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Date & Time Selection */}
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
              <CalendarDays className="h-5 w-5 text-indigo-600" />
              Select Date & Slot
            </h2>

            {bookingsError && (
              <button
                type="button"
                onClick={() => setBookingRefreshKey((k) => k + 1)}
                className="text-xs font-medium text-indigo-600 hover:underline"
              >
                Refresh Slots
              </button>
            )}
          </div>

          {/* Horizontal 14-day Date Picker */}
          <div className="mt-4 flex gap-2.5 overflow-x-auto scrollbar-thin pb-2">
            {availableDates.map((dateObj) => {
              const isSelected = dateObj.value === appointmentDate;
              return (
                <button
                  key={dateObj.value}
                  type="button"
                  disabled={dateObj.isClosed}
                  onClick={() => handleDateChange(dateObj.value)}
                  className={`flex min-w-[92px] shrink-0 flex-col items-center rounded-xl border px-3 py-2.5 text-center transition ${
                    dateObj.isClosed
                      ? "cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400 opacity-60"
                      : isSelected
                      ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                      : "border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:bg-indigo-50/40"
                  }`}
                >
                  <span className="text-xs font-medium">{dateObj.label}</span>
                  <span
                    className={`mt-1 text-[10px] font-semibold uppercase ${
                      dateObj.isClosed
                        ? "text-red-400"
                        : isSelected
                        ? "text-indigo-100"
                        : "text-emerald-600"
                    }`}
                  >
                    {dateObj.isHoliday
                      ? "Holiday"
                      : dateObj.isClosed
                      ? "Closed"
                      : "Available"}
                  </span>
                </button>
              );
            })}
          </div>

          {appointmentDate && (
            <p className="mt-3 text-xs text-gray-500">
              Selected:{" "}
              <span className="font-semibold text-gray-800">
                {formatDate(appointmentDate)}
              </span>
            </p>
          )}

          {/* Time Slots */}
          <div className="mt-5">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
              <Clock className="h-4 w-4 text-indigo-600" />
              Available Time Slots
            </h3>

            {loadingBookings ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                <LoaderCircle className="h-4 w-4 animate-spin text-indigo-600" />
                Checking live slot availability...
              </div>
            ) : selectedDateInfo?.isClosed ? (
              <p className="mt-3 rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
                {selectedDateInfo.isHoliday
                  ? `The ${labels.provider.toLowerCase()} is on holiday on this date.`
                  : `No slots available on this date.`}
              </p>
            ) : availableTimes.length === 0 ? (
              <p className="mt-3 rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
                No remaining slots available for today. Please choose another date.
              </p>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {availableTimes.map((slot) => {
                  const isSelected = appointmentTime === slot.open;
                  const disabled = !slot.configured || slot.isFull;

                  return (
                    <button
                      key={slot.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setAppointmentTime(slot.open);
                        setError("");
                      }}
                      className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                        disabled
                          ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                          : isSelected
                          ? "border-indigo-600 bg-indigo-50 text-indigo-900 ring-1 ring-indigo-600"
                          : "border-gray-200 bg-white text-gray-800 hover:border-indigo-300"
                      }`}
                    >
                      <span className="text-sm font-semibold">{slot.label}</span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          !slot.configured
                            ? "bg-gray-200 text-gray-600"
                            : slot.isFull
                            ? "bg-red-100 text-red-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {!slot.configured
                          ? "Unavailable"
                          : slot.isFull
                          ? "Full"
                          : `${slot.remaining} left`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Customer / Patient Details Form */}
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
            <User className="h-5 w-5 text-indigo-600" />
            {labels.customer} Details
          </h2>

          {/* Booking For Toggle */}
          <div className="mt-4 flex gap-3">
            {[
              { id: "self", label: "Booking for Self" },
              { id: "other", label: "Booking for Someone Else" },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setBookingFor(option.id)}
                className={`flex-1 rounded-xl border py-2.5 text-xs font-semibold transition sm:text-sm ${
                  bookingFor === option.id
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700">
                {labels.customer} Name *
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={`Enter ${labels.customer.toLowerCase()} full name`}
                className="mt-1.5 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700">
                Mobile Number *
              </label>
              <input
                type="tel"
                maxLength={10}
                value={phone}
                onChange={(e) =>
                  setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                }
                placeholder="10-digit mobile number"
                className="mt-1.5 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700">
                Age *
              </label>
              <input
                type="number"
                min={0}
                max={120}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Age in years"
                className="mt-1.5 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700">
                Gender *
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Payment Summary & CTA */}
          <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-gray-100 pt-5 sm:flex-row">
            <div>
              <p className="text-xs text-gray-500">Booking Fee</p>
              <p className="text-2xl font-bold text-gray-900">
                ₹{Number.isFinite(bookingCharge) ? bookingCharge : 0}
              </p>
            </div>

            <button
              type="button"
              disabled={isPaying || isSlotUnavailable || loadingBookings}
              onClick={handlePayment}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300 sm:w-auto"
            >
              {isPaying ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirm & Pay ₹{Number.isFinite(bookingCharge) ? bookingCharge : 0}
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