
"use client";

import { useEffect, useState } from "react";
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
  CheckCircle2,
  Clock,
  LoaderCircle,
  MapPin,
  Stethoscope,
  User,
  AlertCircle,
  ShieldCheck,
  Timer,
  Zap,
  Phone,
} from "lucide-react";

const ARRIVAL_OPTIONS = [5, 10, 15, 20, 30, 40, 60];

const CATEGORIES = {
  clinic: "clinics",
  saloon: "saloons",
  "beauty-parlour": "parlour",
  "diagnostic-centre": "diagnostic",
};

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

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
  }

  return String(value);
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

// --------------------------------------------------
// MAIN COMPONENT
// --------------------------------------------------

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

  // ------------------------------------------------
  // CLINIC
  // ------------------------------------------------

  const [clinic, setClinic] = useState(null);
  const [loadingClinic, setLoadingClinic] = useState(true);
  const [clinicError, setClinicError] = useState("");

  // ------------------------------------------------
  // PROFILE
  // ------------------------------------------------

  const [profileLoading, setProfileLoading] = useState(true);

  // ------------------------------------------------
  // PATIENT DETAILS
  // ------------------------------------------------

  const [patientName, setPatientName] = useState("");
  const [age, setAge] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");

  // ------------------------------------------------
  // ARRIVAL TIME
  // ------------------------------------------------

  const [arrivalTime, setArrivalTime] = useState("");

  // ------------------------------------------------
  // PAYMENT
  // ------------------------------------------------

  const [error, setError] = useState("");
  const [isPaying, setIsPaying] = useState(false);

  // ------------------------------------------------
  // FETCH CLINIC
  // ------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function fetchClinic() {
      if (!clinicId) {
        setLoadingClinic(false);
        return;
      }

      setLoadingClinic(true);
      setClinicError("");

      try {
        const url = doctorId
          ? `/api/clinics/${clinicId}?doctor=${encodeURIComponent(
              doctorId
            )}`
          : `/api/clinics/${clinicId}`;

        const response = await fetch(url, {
          cache: "no-store",
        });

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
        if (!cancelled) {
          setLoadingClinic(false);
        }
      }
    }

    fetchClinic();

    return () => {
      cancelled = true;
    };
  }, [clinicId, doctorId]);

  // ------------------------------------------------
  // AUTHENTICATION AND PROFILE
  // ------------------------------------------------

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

        if (profile.phone || profile.mobile) {
          setPhone((current) =>
            current || String(profile.phone || profile.mobile)
          );
        }
      } catch {
        if (!cancelled) {
          setPatientName(
            (current) =>
              current || session?.user?.name || ""
          );

          setPhone(
            (current) =>
              current || session?.user?.phone || ""
          );
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [status, session, router]);

  // ------------------------------------------------
  // SELECTED DOCTOR
  // ------------------------------------------------

  const doctor =
    clinic?.doctors?.find(
      (item) => getDoctorId(item) === String(doctorId)
    ) ??
    clinic?.doctors?.[0] ??
    null;

  const normalizedDoctorId = getDoctorId(doctor);

  // ------------------------------------------------
  // BOOKING CHARGE
  // ------------------------------------------------

  const bookingCharge = Number(
    doctor?.emergencyBookingCharge ?? doctor?.bookingCharge ?? 0
  );

  const isPageLoading =
    status === "loading" ||
    loadingClinic ||
    profileLoading;

  // ------------------------------------------------
  // VALIDATION
  // ------------------------------------------------

  const validateForm = () => {
    setError("");

    if (status !== "authenticated") {
      setError("Please log in before booking.");
      return false;
    }

    if (!collectionName) {
      setError("Invalid business category.");
      return false;
    }

    if (!clinic || !doctor || !normalizedDoctorId) {
      setError(
        "Clinic or doctor details could not be found."
      );
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
      setError(
        "Please enter a valid age between 0 and 120."
      );
      return false;
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError("Please enter a valid 10-digit phone number.");
      return false;
    }

    if (!gender) {
      setError("Please select the patient's gender.");
      return false;
    }

    if (!arrivalTime) {
      setError("Please select your estimated arrival time.");
      return false;
    }

    if (!ARRIVAL_OPTIONS.includes(Number(arrivalTime))) {
      setError("Invalid estimated arrival time.");
      return false;
    }

    if (
      !Number.isFinite(bookingCharge) ||
      bookingCharge <= 0
    ) {
      setError(
        "The booking charge is not configured for this doctor."
      );
      return false;
    }

    return true;
  };

  // ------------------------------------------------
  // PAYMENT
  // ------------------------------------------------

  const handlePayment = async () => {
    if (isPaying || isPageLoading) return;

    if (!validateForm()) return;

    setIsPaying(true);
    setError("");

    try {
      // Create emergency payment order.
      // No appointment date or time slot is selected here.
      const orderResponse = await fetch(
        "/api/payment/create-order",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            category,

            clinicId: String(clinicId),
            doctorId: normalizedDoctorId,

            patientName: patientName.trim(),
            age: Number(age),
            phone,
            gender,

            isEmergency: true,
            priority: "emergency",
            bookingType: "emergency",

            arrivalTime: Number(arrivalTime),
          }),
        }
      );

      const orderData = await orderResponse.json();

      if (
        !orderResponse.ok ||
        orderData.success === false
      ) {
        throw new Error(
          orderData.message ||
            "Failed to create payment order."
        );
      }

      if (!orderData.orderId || !orderData.key) {
        throw new Error(
          "Invalid payment order response from server."
        );
      }

      // Load Razorpay.
      const scriptLoaded = await loadRazorpayScript();

      if (!scriptLoaded || !window.Razorpay) {
        throw new Error(
          "Razorpay Checkout failed to load."
        );
      }

      // Open Razorpay checkout.
      const checkout = new window.Razorpay({
        key: orderData.key,

        amount: orderData.amount,

        currency: orderData.currency || "INR",

        name: "Zeric",

        description: `Emergency Consultation - ${doctor.name}`,

        order_id: orderData.orderId,

        prefill: {
          name: patientName.trim(),
          email: session?.user?.email || "",
          contact: phone,
        },

        notes: {
          clinicId: String(clinicId),
          doctorId: normalizedDoctorId,
          category,

          isEmergency: "true",
          priority: "emergency",

          patientName: patientName.trim(),
          age: String(age),
          phone,
          gender,

          arrivalTime: `${arrivalTime} minutes`,
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

            if (
              !verifyResponse.ok ||
              !verifyData.success
            ) {
              setError(
                verifyData.message ||
                  "Payment verification failed."
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
          response?.error?.description ||
            "Payment failed. Please try again."
        );

        setIsPaying(false);
      });

      checkout.open();
    } catch (err) {
      setError(
        err.message || "Something went wrong."
      );

      setIsPaying(false);
    }
  };

  // ==================================================
  // LOADING
  // ==================================================

  if (isPageLoading) {
    return <LoadingScreen />;
  }

  // ==================================================
  // UNAUTHENTICATED
  // ==================================================

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

  // ==================================================
  // CLINIC ERROR
  // ==================================================

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
              {clinicError
                ? "Unable to Load Details"
                : "Doctor Not Found"}
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

  // ==================================================
  // MAIN PAGE
  // ==================================================

  return (
    <main className="min-h-screen bg-slate-50/60 pb-16">
      <Header showBack={false} />

      <section className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">

        {/* BACK BUTTON */}

        <button
          type="button"
          onClick={() => router.back()}
          className="mb-6 inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>

        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/40">

          {/* HEADER */}

          <div className="border-b border-slate-100 bg-gradient-to-r from-rose-50/80 via-white to-white p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-md shadow-rose-200">
                  <Zap className="h-6 w-6" />
                </div>

                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                    Emergency Booking
                  </h1>

                  <p className="text-xs font-medium text-slate-500">
                    Quick patient registration
                  </p>
                </div>
              </div>

              <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200/60 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 sm:inline-flex">
                <ShieldCheck className="h-3.5 w-3.5" />
                Secure Payment
              </span>
            </div>
          </div>

          <div className="space-y-7 p-6 sm:p-8">

            {/* EMERGENCY NOTICE */}

            <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/70 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />

              <div>
                <p className="text-sm font-bold text-rose-800">
                  Emergency Consultation
                </p>

                <p className="mt-1 text-xs leading-relaxed text-rose-700">
                  Enter the patient's details and estimated
                  travel time. No appointment date or time-slot
                  selection is required.
                </p>
              </div>
            </div>

            {/* DOCTOR CARD */}

            <div className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-slate-50/50 p-5 transition hover:border-indigo-200 sm:p-6">
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
                      <strong className="text-sm font-bold text-indigo-600">
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

                    <p className="flex items-start gap-1">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                      {clinic.address}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200/60 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                      <Clock className="h-3 w-3 text-indigo-500" />
                      {doctor.duration || 30} mins
                    </span>

                    <span className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
                      <Zap className="h-3 w-3" />
                      Emergency
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* PATIENT DETAILS */}

            <div className="space-y-5">

              <div>
                <h3 className="text-sm font-bold uppercase tracking-tight text-slate-400">
                  1. Patient Details
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  Enter the details of the patient requiring
                  emergency consultation.
                </p>
              </div>

              {/* PATIENT NAME */}

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Patient Name *
                </label>

                <div className="relative">
                  <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    type="text"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="Enter patient name"
                    autoComplete="name"
                    className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>

              {/* AGE AND PHONE */}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Age *
                  </label>

                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="Enter age"
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Phone Number *
                  </label>

                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      maxLength={10}
                      value={phone}
                      onChange={(e) =>
                        setPhone(
                          e.target.value.replace(/\D/g, "").slice(0, 10)
                        )
                      }
                      placeholder="10-digit mobile number"
                      className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                </div>
              </div>

              {/* GENDER */}

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Gender *
                </label>

                <div className="grid grid-cols-3 gap-3">
                  {["Male", "Female", "Other"].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setGender(item);
                        setError("");
                      }}
                      className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                        gender.toLowerCase() === item.toLowerCase()
                          ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                          : "border-gray-200 bg-white text-gray-600 hover:border-indigo-300"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ARRIVAL TIME */}

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-tight text-slate-400">
                  2. Estimated Arrival Time
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  How long will it take the patient to reach
                  the clinic?
                </p>
              </div>

              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 sm:p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                    <Timer className="h-5 w-5" />
                  </div>

                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      Expected travel time
                    </p>

                    <p className="text-[11px] text-slate-500">
                      Select an estimated arrival time
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                  {ARRIVAL_OPTIONS.map((mins) => {
                    const isSelected =
                      Number(arrivalTime) === mins;

                    return (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => {
                          setArrivalTime(String(mins));
                          setError("");
                        }}
                        className={`rounded-xl border px-3 py-3 text-sm font-bold transition ${
                          isSelected
                            ? "border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-200"
                            : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50"
                        }`}
                      >
                        {mins} min
                      </button>
                    );
                  })}
                </div>

                {arrivalTime && (
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-indigo-100 bg-white p-3">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-600" />

                    <p className="text-xs font-semibold text-slate-700">
                      Patient expects to reach the clinic in{" "}
                      <span className="text-indigo-600">
                        {arrivalTime} minutes
                      </span>.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* BOOKING SUMMARY */}

            {patientName.trim() &&
              age !== "" &&
              phone &&
              gender &&
              arrivalTime && (
                <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50/80 to-white p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />

                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                        Emergency Booking Summary
                      </p>

                      <p className="text-sm font-bold text-slate-900">
                        {patientName.trim()}
                      </p>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-600">
                        <p>
                          Age: <strong>{age}</strong>
                        </p>

                        <p>
                          Gender: <strong>{gender}</strong>
                        </p>

                        <p className="col-span-2">
                          Phone: <strong>{phone}</strong>
                        </p>

                        <p className="col-span-2">
                          Expected arrival:{" "}
                          <strong className="text-indigo-600">
                            {arrivalTime} minutes
                          </strong>
                        </p>
                      </div>

                      <div className="border-t border-indigo-100 pt-2 text-xs text-slate-500">
                        Amount payable:{" "}
                        <strong className="font-bold text-slate-900">
                          ₹{bookingCharge.toLocaleString("en-IN")}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            {/* ERROR */}

            {error && (
              <div
                role="alert"
                className="flex items-center gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* PAYMENT BUTTON */}

            <button
              type="button"
              onClick={handlePayment}
              disabled={
                isPaying ||
                !clinic ||
                !doctor ||
                !normalizedDoctorId ||
                !patientName.trim() ||
                age === "" ||
                !Number.isInteger(Number(age)) ||
                Number(age) < 0 ||
                Number(age) > 120 ||
                !/^[6-9]\d{9}$/.test(phone) ||
                !gender ||
                !arrivalTime ||
                !Number.isFinite(bookingCharge) ||
                bookingCharge <= 0
              }
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-rose-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-rose-200 transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            >
              {isPaying ? (
                <>
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                  Processing Payment...
                </>
              ) : (
                <>
                  <Zap className="h-5 w-5" />
                  Pay ₹{bookingCharge.toLocaleString("en-IN")} & Confirm Emergency Booking
                </>
              )}
            </button>

            <p className="text-center text-[10px] leading-relaxed text-slate-400">
              Your emergency booking will be confirmed only
              after successful payment verification.
            </p>

          </div>
        </div>
      </section>

      <GoUpButton />
    </main>
  );
}
