"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { toast } from "react-hot-toast";

export default function Login() {
  const [formData, setFormData] = useState({
    identifier: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Email OR Indian mobile number validation
  const validateIdentifier = (value) => {
    const identifier = value.trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const mobileRegex = /^[6-9]\d{9}$/;

    return (
      emailRegex.test(identifier) ||
      mobileRegex.test(identifier)
    );
  };

  const isIdentifierValid = validateIdentifier(
    formData.identifier
  );

  const handleSubmit = async (e) => {
    e.preventDefault();

    const identifier = formData.identifier.trim();

    if (!validateIdentifier(identifier)) {
      toast.error(
        "Enter a valid email address or 10-digit mobile number."
      );
      return;
    }

    if (formData.password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const result = await signIn("credentials", {
        identifier,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Invalid email/phone or password");
        setLoading(false);
        return;
      }

      if (result?.ok) {
        toast.success("Login successful!");
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Something went wrong.");
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);

    try {
      await signIn("google", {
        callbackUrl: "/",
      });
    } catch (error) {
      console.error("Google login error:", error);
      toast.error("Google login failed.");
      setLoading(false);
    }
  };

  const handleBack = () => {
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-md">

        {/* Back Button */}
        <div className="mb-3 sm:mb-16">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-indigo-600 active:scale-95"
          >
            <span className="text-lg leading-none">←</span>
            <span>Home</span>
          </button>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-5 shadow-sm sm:rounded-3xl sm:p-8">

          {/* Header */}
          <div className="mb-5 text-center sm:mb-7">
            <h2 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
              Welcome to QueueEase
            </h2>

            <p className="mx-auto mt-1.5 max-w-xs text-[11px] leading-relaxed text-slate-500 sm:text-sm">
              Book tokens for yourself, children, or elderly family members
            </p>
          </div>

          {/* Login / Signup Toggle */}
          <div className="mb-5 flex rounded-xl bg-slate-100 p-1 text-xs font-semibold sm:mb-6 sm:text-sm">
            <button
              type="button"
              className="flex min-h-[40px] flex-1 items-center justify-center rounded-lg bg-white px-2 py-2.5 font-bold text-indigo-600 shadow-sm"
            >
              Login
            </button>

            <button
              type="button"
              onClick={() => {
                window.location.href = "/signup";
              }}
              className="flex min-h-[40px] flex-1 items-center justify-center rounded-lg px-2 py-2.5 text-slate-600 transition hover:text-indigo-600 active:scale-[0.98]"
            >
              Create Account
            </button>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email / Mobile */}
            <div>
              <label
                htmlFor="identifier"
                className="mb-1.5 block text-xs font-bold text-slate-700 sm:text-sm"
              >
                Email or Mobile Number
              </label>

              <input
                id="identifier"
                type="text"
                name="identifier"
                value={formData.identifier}
                onChange={handleChange}
                placeholder="Email or 10-digit mobile"
                autoComplete="username"
                inputMode="email"
                maxLength={100}
                required
                aria-invalid={
                  formData.identifier.length > 0 &&
                  !isIdentifierValid
                }
                className={`min-h-[46px] w-full rounded-xl border bg-slate-50 px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-transparent focus:ring-2 ${
                  formData.identifier.length > 0 &&
                  !isIdentifierValid
                    ? "border-red-400 focus:ring-red-500"
                    : "border-slate-200 focus:ring-indigo-500"
                }`}
              />

              {formData.identifier.length > 0 &&
                !isIdentifierValid && (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-red-500 sm:text-xs">
                    Enter a valid email or 10-digit mobile number.
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
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                minLength={8}
                maxLength={64}
                autoComplete="current-password"
                required
                className={`min-h-[46px] w-full rounded-xl border bg-slate-50 px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-transparent focus:ring-2 ${
                  formData.password.length > 0 &&
                  formData.password.length < 8
                    ? "border-red-400 focus:ring-red-500"
                    : "border-slate-200 focus:ring-indigo-500"
                }`}
              />

              {formData.password.length > 0 &&
                formData.password.length < 8 && (
                  <p className="mt-1.5 text-[11px] text-red-500 sm:text-xs">
                    Password must be at least 8 characters.
                  </p>
                )}
            </div>

            {/* Forgot Password */}
            <div className="-mt-1 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/forgot-password";
                }}
                className="min-h-[32px] px-1 text-xs font-semibold text-indigo-600 transition hover:text-indigo-700 hover:underline active:scale-95 sm:text-sm"
              >
                Forgot Password?
              </button>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="min-h-[46px] w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-md shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-indigo-400 disabled:shadow-none"
            >
              {loading ? "Logging in..." : "Login to Continue →"}
            </button>
          </form>

          {/* Divider */}
          <div className="my-5 flex items-center sm:my-6">
            <div className="flex-1 border-t border-slate-200" />

            <span className="px-3 text-[11px] font-medium text-slate-400 sm:text-xs">
              OR
            </span>

            <div className="flex-1 border-t border-slate-200" />
          </div>

          {/* Google Login */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="group flex min-h-[46px] w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            <svg
              className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-110"
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

            <span className="truncate">
              {loading
                ? "Connecting to Google..."
                : "Continue with Google"}
            </span>
          </button>

          {/* Bottom Information */}
          <div className="mt-5 border-t border-slate-100 pt-4 text-center sm:mt-6 sm:pt-5">
            <p className="text-[11px] leading-relaxed text-slate-400 sm:text-xs">
              💡 Login to book tokens and manage your appointments.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}