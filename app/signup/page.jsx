"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { toast } from "react-hot-toast";

export default function Signup() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^[6-9]\d{9}$/;

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Google Login
  const handleGoogleLogin = async () => {
    setLoading(true);

    try {
      await signIn("google", {
        callbackUrl: "/",
      });
    } catch (error) {
      console.error("Google login error:", error);
      toast.error("Google login failed");
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const name = formData.name.trim();
    const email = formData.email.trim();
    const phone = formData.phone.trim();

    if (!name) {
      toast.error("Please enter your full name.");
      return;
    }

    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    if (!phoneRegex.test(phone)) {
      toast.error("Please enter a valid Indian mobile number.");
      return;
    }

    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const signupData = {
        name,
        email,
        phone,
        password: formData.password,
      };

      const response = await fetch("/api/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(signupData),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || "Signup failed");
        setLoading(false);
        return;
      }

      toast.success("OTP has been sent to your email.");

      sessionStorage.setItem(
        "signupPassword",
        formData.password
      );

      window.location.href =
        `/verify-otp?email=${encodeURIComponent(email)}`;
    } catch (error) {
      console.error("Signup error:", error);
      toast.error("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

    const handleBack = () => {
    window.history.back();
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-10">
        {/* Back Button */}
      <div className="mx-auto w-full max-w-md mb-4">
        <button
          type="button"
          onClick={handleBack}
          className="
            inline-flex items-center gap-2
            rounded-lg px-4 py-2
            text-sm font-semibold text-slate-600
            transition
            hover:bg-slate-200 hover:text-indigo-600
            active:scale-95
          "
        >
          <span className="text-lg leading-none">
            ←
          </span>

          <span>Home</span>
        </button>
      </div>
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md items-center justify-center sm:min-h-[calc(100vh-5rem)]">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:rounded-3xl sm:p-8">

          {/* Header */}
          <div className="mb-6 text-center">
            <h2 className="text-xl font-black text-slate-900 sm:text-2xl">
              Create your Account
            </h2>

            <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-slate-500 sm:text-sm">
              Book tokens for yourself, children, or elderly family members
            </p>
          </div>

          {/* Login / Signup Toggle */}
          <div className="mb-5 flex rounded-xl bg-slate-100 p-1 text-xs font-semibold sm:mb-6 sm:text-sm">
            <button
              type="button"
              onClick={() => {
                window.location.href = "/login";
              }}
              className="flex-1 rounded-lg py-2.5 text-slate-600 transition hover:text-indigo-600"
            >
              Login
            </button>

            <button
              type="button"
              className="flex-1 rounded-lg bg-white py-2.5 font-bold text-indigo-600 shadow-sm"
            >
              Create Account
            </button>
          </div>

          {/* Signup Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Name */}
            <div>
              <label
                htmlFor="name"
                className="mb-1.5 block text-xs font-bold text-slate-700 sm:text-sm"
              >
                Your Full Name
              </label>

              <input
                id="name"
                type="text"
                name="name"
                placeholder="e.g. Rahul Sharma"
                value={formData.name}
                onChange={handleChange}
                autoComplete="name"
                maxLength={100}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-transparent focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-xs font-bold text-slate-700 sm:text-sm"
              >
                Email Address
              </label>

              <input
                id="email"
                type="email"
                name="email"
                placeholder="e.g. rahul@example.com"
                value={formData.email}
                onChange={handleChange}
                autoComplete="email"
                inputMode="email"
                maxLength={254}
                required
                aria-invalid={
                  formData.email.length > 0 &&
                  !emailRegex.test(formData.email)
                }
                className={`w-full rounded-xl border bg-slate-50 px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-transparent focus:ring-2 ${
                  formData.email.length > 0 &&
                  !emailRegex.test(formData.email)
                    ? "border-red-400 focus:ring-red-500"
                    : "border-slate-200 focus:ring-indigo-500"
                }`}
              />

              {formData.email.length > 0 &&
                !emailRegex.test(formData.email) && (
                  <p className="mt-1.5 text-xs leading-relaxed text-red-500">
                    Please enter a valid email address.
                  </p>
                )}
            </div>

            {/* Phone */}
            <div>
              <label
                htmlFor="phone"
                className="mb-1.5 block text-xs font-bold text-slate-700 sm:text-sm"
              >
                Mobile Number
              </label>

              <input
                id="phone"
                type="tel"
                name="phone"
                placeholder="e.g. 9832145678"
                value={formData.phone}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "");

                  if (value.length <= 10) {
                    setFormData((prev) => ({
                      ...prev,
                      phone: value,
                    }));
                  }
                }}
                inputMode="numeric"
                autoComplete="tel"
                maxLength={10}
                pattern="[6-9][0-9]{9}"
                required
                className={`w-full rounded-xl border bg-slate-50 px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-transparent focus:ring-2 ${
                  formData.phone.length > 0 &&
                  !phoneRegex.test(formData.phone)
                    ? "border-red-400 focus:ring-red-500"
                    : "border-slate-200 focus:ring-indigo-500"
                }`}
              />

              {formData.phone.length > 0 &&
                formData.phone.length < 10 && (
                  <p className="mt-1.5 text-xs text-red-500">
                    Mobile number must contain 10 digits.
                  </p>
                )}

              {formData.phone.length === 10 &&
                !phoneRegex.test(formData.phone) && (
                  <p className="mt-1.5 text-xs text-red-500">
                    Enter a valid Indian mobile number.
                  </p>
                )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs font-bold text-slate-700 sm:text-sm"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                name="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                autoComplete="new-password"
                minLength={6}
                maxLength={128}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-transparent focus:ring-2 focus:ring-indigo-500"
              />

              {formData.password.length > 0 &&
                formData.password.length < 6 && (
                  <p className="mt-1.5 text-xs text-red-500">
                    Password must be at least 6 characters.
                  </p>
                )}
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-1.5 block text-xs font-bold text-slate-700 sm:text-sm"
              >
                Confirm Password
              </label>

              <input
                id="confirmPassword"
                type="password"
                name="confirmPassword"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                autoComplete="new-password"
                required
                className={`w-full rounded-xl border bg-slate-50 px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-transparent focus:ring-2 ${
                  formData.confirmPassword.length > 0 &&
                  formData.password !== formData.confirmPassword
                    ? "border-red-400 focus:ring-red-500"
                    : "border-slate-200 focus:ring-indigo-500"
                }`}
              />

              {formData.confirmPassword.length > 0 &&
                formData.password !== formData.confirmPassword && (
                  <p className="mt-1.5 text-xs text-red-500">
                    Passwords do not match.
                  </p>
                )}
            </div>

            {/* Signup Button */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-md shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-indigo-400 disabled:shadow-none"
            >
              {loading
                ? "Sending OTP..."
                : "Create Account & Continue →"}
            </button>
          </form>

          {/* Divider */}
          <div className="my-5 flex items-center sm:my-6">
            <div className="flex-1 border-t border-slate-200" />

            <span className="px-3 text-xs text-slate-400">
              OR
            </span>

            <div className="flex-1 border-t border-slate-200" />
          </div>

          {/* Google Login */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="group flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {/* Google Icon */}
            <svg
              className="h-5 w-5 transition-transform duration-200 group-hover:scale-110"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fill="#4285F4"
                d="M21.35 12.27c0-.71-.06-1.39-.18-2.05H12v3.88h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.22Z"
              />

              <path
                fill="#34A853"
                d="M12 21.6c2.63 0 4.84-.87 6.45-2.35l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.7-1.72-5.47-4.03H3.28v2.53A9.75 9.75 0 0 0 12 21.6Z"
              />

              <path
                fill="#FBBC05"
                d="M6.53 13.69a5.86 5.86 0 0 1 0-3.38V7.78H3.28a9.75 9.75 0 0 0 0 8.44l3.25-2.53Z"
              />

              <path
                fill="#EA4335"
                d="M12 6.28c1.43 0 2.71.49 3.72 1.46l2.79-2.79C16.84 3.43 14.63 2.4 12 2.4a9.75 9.75 0 0 0-8.72 5.38l3.25 2.53C7.3 8 9.46 6.28 12 6.28Z"
              />
            </svg>

            <span>
              {loading
                ? "Connecting to Google..."
                : "Continue with Google"}
            </span>
          </button>

          {/* Bottom Information */}
          <div className="mt-5 border-t border-slate-100 pt-5 text-center sm:mt-6">
            <p className="text-[11px] leading-relaxed text-slate-400 sm:text-xs">
              💡 We'll send an OTP to your email to verify your account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}