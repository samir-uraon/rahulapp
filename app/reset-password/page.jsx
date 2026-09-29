"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";

export default function ResetPassword() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (!token) {
      toast.error("Invalid or missing reset token");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Unable to reset password");
        return;
      }

      toast.success("Password reset successfully!");

      setTimeout(() => {
        window.location.href = "/login";
      }, 1000);
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-6 sm:px-6 sm:py-10">
      <div className="w-full max-w-md sm:max-w-lg bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-5 sm:p-7 md:p-8 shadow-sm">

        <div className="text-center mb-6 sm:mb-7">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            Reset Password
          </h2>

          <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
            Create a new password for your QueueEase account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">

          <div>
            <label
              htmlFor="password"
              className="block text-xs sm:text-sm font-medium text-slate-700 mb-2"
            >
              New Password
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
              autoComplete="new-password"
              className={`w-full bg-slate-50 border rounded-xl px-3.5 py-3 text-sm sm:text-base
                focus:outline-none focus:ring-2 transition
                ${
                  formData.password.length > 0 &&
                  formData.password.length < 8
                    ? "border-red-400 focus:ring-red-500"
                    : "border-slate-200 focus:ring-indigo-500 focus:border-transparent"
                }`}
              required
            />

            {formData.password.length > 0 &&
              formData.password.length < 8 && (
                <p className="mt-1.5 text-xs text-red-500">
                  Password must be at least 8 characters.
                </p>
              )}
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-xs sm:text-sm font-medium text-slate-700 mb-2"
            >
              Confirm Password
            </label>

            <input
              id="confirmPassword"
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm your password"
              autoComplete="new-password"
              className={`w-full bg-slate-50 border rounded-xl px-3.5 py-3 text-sm sm:text-base
                focus:outline-none focus:ring-2 transition
                ${
                  formData.confirmPassword.length > 0 &&
                  formData.password !== formData.confirmPassword
                    ? "border-red-400 focus:ring-red-500"
                    : "border-slate-200 focus:ring-indigo-500 focus:border-transparent"
                }`}
              required
            />

            {formData.confirmPassword.length > 0 &&
              formData.password !== formData.confirmPassword && (
                <p className="mt-1.5 text-xs text-red-500">
                  Passwords do not match.
                </p>
              )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 sm:py-3.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold rounded-xl text-sm sm:text-base shadow-md shadow-indigo-200 transition disabled:bg-indigo-400 disabled:cursor-not-allowed"
          >
            {loading ? "Resetting..." : "Reset Password →"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            window.location.href = "/login";
          }}
          className="w-full mt-4 py-2.5 text-sm sm:text-base cursor-pointer font-semibold text-indigo-600 hover:text-indigo-700 hover:underline transition"
        >
          ← Back to Login
        </button>

        <div className="mt-6 sm:mt-7 pt-5 border-t border-slate-100 text-center">
          <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed">
            💡 Your reset link is valid for 15 minutes.
          </p>
        </div>

      </div>
    </div>
  );
}