"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

export default function Header({ user }) {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-5 py-4 flex items-center justify-between">

        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm">
            <span className="text-white text-xl font-bold">
              Q
            </span>
          </div>

          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">
              QueueEase
            </h1>

            <p className="text-sm text-gray-500">
              Customer Booking App
            </p>
          </div>
        </Link>

      <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-full px-4 py-2">
  <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>

  <span className="text-sm font-medium text-indigo-700">
    {user?.name || "Rahul Sharma"}
  </span>

  <button
    type="button"
    onClick={() => signOut({ callbackUrl: "/login" })}
    className="text-sm font-medium text-gray-500 hover:text-red-500 transition"
  >
    Logout
  </button>
</div>

      </div>
    </header>
  );
}