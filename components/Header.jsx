 
"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Ticket } from "lucide-react";

export default function Header({ user, showBack = false }) {
  const { data: session } = useSession();
  const router = useRouter();

  const userName = session?.user?.name || user?.name || "User";
  const initial = userName.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-[64px] w-full max-w-7xl items-center justify-between gap-1 px-2 sm:h-[78px] sm:gap-4 sm:px-6 lg:px-8 px-5">
        {/* LEFT SIDE */}
        <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-4">
          {showBack && (
            <button
              type="button"
              onClick={() => router.back()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 sm:h-9 sm:w-9"
              aria-label="Go back"
            >
              <span className="text-2xl leading-none">‹</span>
            </button>
          )}

          {/* LOGO AND BRAND */}
          <Link
            href="/"
            className="flex min-w-0 items-center gap-1.5 sm:gap-2.5"
          >
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg sm:h-10 sm:w-10">
              <Image
                src="/logo.png"
                alt="Zeric Logo"
                width={40}
                height={40}
                className="h-full w-full object-contain"
                priority
              />
            </div>

            <div className="min-w-0">
              <h1 className="text-sm font-bold leading-tight text-gray-900 sm:text-lg">
                Zeric
              </h1>

              <p className=" whitespace-nowrap text-xs text-gray-500 sm:block sm:text-sm">
                Made Simpler & Much Faster
              </p>
            </div>
          </Link>
        </div>

        {/* RIGHT SIDE */}
        <div className="flex shrink-0 items-center gap-5 sm:gap-4">
          {/* MY BOOKINGS: HIDDEN ON MOBILE */}
         


          <Link
            href="/my-bookings"
            aria-label="My Bookings"
            title="My Bookings"
            className="hidden shrink-0 items-center justify-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-indigo-700 transition-colors hover:bg-indigo-100 sm:inline-flex"
          >
            <Ticket size={19} className="shrink-0" />
            <span className="whitespace-nowrap text-sm">
              My Bookings
            </span>
          </Link>

          {/* DESKTOP PROFILE */}
          <Link
            href="/profile"
            className="hidden shrink-0 items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-[5px] sm:flex rounded-full border border-indigo-500 bg-indigo-50 px-3 py-1 text-indigo-700 transition-colors hover:bg-indigo-100"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500" />

            <span className="max-w-32 truncate text-sm font-medium text-indigo-700 ">
              {userName}
            </span>
          </Link>

          {/* MOBILE PROFILE */}
          <Link
    href="/my-bookings"
    aria-label="My Bookings"
    title="My Bookings"
    className="sm:hidden inline-flex h-9 w-10 shrink-0 items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 transition-colors hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
  >
    <Ticket size={22} strokeWidth={2} />
  </Link>
          <Link
            href="/profile"
            aria-label={`Open profile for ${userName}`}
            title="Profile"
            className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-green-300 bg-indigo-600 text-sm font-bold text-white sm:hidden"
          >
            {initial}
          </Link>
        </div>
      </div>
    </header>
  );
}
