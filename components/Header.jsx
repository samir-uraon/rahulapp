 
"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Ticket, ChevronRight, Gift } from "lucide-react";

export default function Header({ user, showBack = false }) {
  const { data: session } = useSession();
  const router = useRouter();

  const userName = session?.user?.name || user?.name || "User";
  const initial = userName.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-2 px-3 sm:h-[76px] sm:gap-4 sm:px-6 lg:px-8">

        {/* LEFT SIDE */}
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">

          {/* BACK BUTTON */}
          {showBack && (
            <button
              type="button"
              onClick={() => router.back()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100 active:scale-95"
              aria-label="Go back"
            >
              <span className="mb-1 text-2xl leading-none">‹</span>
            </button>
          )}

          {/* LOGO AND BRAND */}
          <Link
            href="/"
            className="group flex min-w-0 items-center gap-2 sm:gap-3"
          >
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-white sm:h-11 sm:w-11">
              <Image
                src="/logo.png"
                alt="Zeric Logo"
                width={44}
                height={44}
                className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-105"
                priority
              />
            </div>

            <div className="min-w-0">
              <h1 className="text-base font-extrabold leading-tight tracking-tight text-gray-900 sm:text-xl">
                Zeric
              </h1>

              <p className="hidden whitespace-nowrap text-[11px] text-gray-500 sm:block sm:text-xs">
                Made Simpler & Much Faster
              </p>
            </div>
          </Link>
        </div>

        {/* RIGHT SIDE */}
        <div className="flex shrink-0 items-center gap-5 sm:gap-4">

          {/* PLANS / SUBSCRIPTION */}
          <Link
            href="/plans"
            aria-label="View subscription plans"
            title="Subscription Plans"
            className="
              group inline-flex h-9 shrink-0 items-center justify-center gap-2
              rounded-full border border-indigo-200 bg-indigo-50
              px-3 text-indigo-700
              transition-all duration-200
              hover:border-indigo-300 hover:bg-indigo-100
              active:scale-95
              focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-indigo-500 focus-visible:ring-offset-2
              sm:h-10 sm:px-4
            "
          >
        <Gift
  size={19}
  strokeWidth={2}
  className="shrink-0 transition-transform duration-200 group-hover:-rotate-6"
/>

            <span className="hidden whitespace-nowrap text-sm font-semibold sm:inline">
              Plans
            </span>
          </Link>

          {/* DESKTOP PROFILE */}
          <Link
            href="/profile"
            aria-label={`Open profile for ${userName}`}
            title="My Profile"
            className="
              hidden h-10 max-w-48 shrink-0 items-center gap-2
              rounded-full border border-gray-200 bg-white
              px-3 transition-all duration-200
              hover:border-indigo-300 hover:bg-indigo-50
              active:scale-95 sm:inline-flex
              focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-indigo-500 focus-visible:ring-offset-2
            "
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />

            <span className="max-w-32 truncate text-sm font-semibold text-gray-700">
              {userName}
            </span>

       

            <ChevronRight
              size={14}
              className="text-gray-400"
            />
          </Link>

          {/* MOBILE PROFILE */}
          <Link
            href="/profile"
            aria-label={`Open profile for ${userName}`}
            title="My Profile"
            className="
              relative inline-flex h-9 w-9 shrink-0 items-center
              justify-center rounded-full border-2 border-indigo-200
              bg-indigo-600 text-sm font-bold text-white
              shadow-sm transition-all duration-200
              hover:bg-indigo-700 active:scale-95
              sm:hidden
              focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-indigo-500 focus-visible:ring-offset-2
            "
          >
            {initial}

           </Link>

        </div>
      </div>
    </header>
  );
}
