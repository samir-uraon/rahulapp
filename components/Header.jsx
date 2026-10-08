"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function Header({ user, showBack = false }) {
  const { data: session } = useSession();
  const router = useRouter();

  const userName = session?.user?.name || user?.name || "User";
  const initial = userName.charAt(0).toUpperCase();

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-[78px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

        {/* LEFT SIDE */}
        <div className="flex items-center gap-3 sm:gap-4">

          {/* Back Button */}
          {showBack && (
            <button
              type="button"
              onClick={() => router.replace("/")}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-300 hover:text-gray-900"
              aria-label="Go back"
            >
              <span className="text-2xl leading-none">‹</span>
            </button>
          )}

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-md shadow-indigo-200">
              <span className="font-bold text-white">Q</span>
            </div>

            <div>
              <h1 className="text-base font-bold leading-tight text-gray-900 sm:text-lg">
                QueueEase
              </h1>

              <p className="text-xs text-gray-500 sm:text-sm">
                Customer Booking App
              </p>
            </div>
          </Link>
        </div>

        {/* USER SECTION */}
        <div className="flex items-center gap-5">

          {/* Desktop User */}
          <Link
            href="/profile"
            className="hidden items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 sm:flex"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>

            <span className="text-sm font-medium text-indigo-700 hover:underline">
              {userName}
            </span>
          </Link>

          {/* Mobile Profile Initial */}
          <Link
            href="/profile"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 border-4 border-green-300  text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 sm:hidden"
            aria-label={`Open profile for ${userName}`}
          >
            {initial}
          </Link>

          {/* Logout - Hidden on Mobile */}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="hidden rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-500 sm:block sm:px-4 sm:text-sm"
          >
            Logout
          </button>

        </div>
      </div>
    </header>
  );
}