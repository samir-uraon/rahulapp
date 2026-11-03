
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Crown,
  Zap,
  ShieldCheck,
  CalendarDays,
  Ticket,
  Sparkles,
  Headphones,
  Clock,
  X,
} from "lucide-react";
import Image from "next/image";
import toast from "react-hot-toast";
 

const plans = [
  {
    id: "free",
    name: "Free",
    description: "Everything you need to get started.",
    monthly: 0,
    yearly: 0,
    icon: Ticket,
    features: [
      "Browse nearby clinics",
      "View doctors and services",
      "Book appointments",
      "Track booking status",
      "Basic booking history",
    ],
    unavailable: [
      "Priority customer support",
      "Premium benefits",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    description: "More convenience for your healthcare journey.",
    monthly: 99,
    yearly: 999,
    popular: true,
    icon: Crown,
    features: [
      "Everything in Free",
      "Priority customer support",
      "Exclusive premium benefits",
      "Advanced booking experience",
      "Faster customer assistance",
      "Premium account badge",
    ],
    unavailable: [],
  },
];

export default function PlansPage() {
  const [billing, setBilling] = useState("monthly");
  const [currentPlan] = useState("free");
const router = useRouter();
  

const handleUpgrade = (plan) => {
  if (plan.id === currentPlan) {
    toast("You are already on this plan.");
    return;
  }

  toast.success("Subscription payments are coming soon!");

  // TODO: Connect Razorpay subscription API.
  console.log("Selected plan:", plan.id, billing);
};

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">

      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">

          <div className="flex items-center gap-3">
          <button
  type="button"
  onClick={() => router.back()}
  aria-label="Go back"
  className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600 transition-all duration-150 hover:bg-gray-100 active:scale-90 active:bg-gray-200"
>
  <ArrowLeft size={21} />
</button>

            <div>
              <h1 className="text-base font-bold sm:text-lg">
                Subscription Plans
              </h1>
              <p className="text-[11px] text-gray-500">
                Choose the right plan for you
              </p>
            </div>
          </div>

          <Link
            href="/profile"
            className="rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
          >
            My Profile
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden bg-white">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-100/70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-violet-100/70 blur-3xl" />

        <div className="relative mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 sm:py-20">

       <div className="mx-auto mb-5 inline-flex w-fit items-center gap-2.5 rounded-full border border-indigo-200/80 bg-gradient-to-r from-indigo-50 to-violet-50 px-4 py-2 text-xs font-bold tracking-[0.12em] text-indigo-700 shadow-sm">
  <Image
    src="/logo.png"
    alt="Zeriy Logo"
    width={20}
    height={20}
    className="h-[20px] w-[20px] shrink-0 object-contain  rounded-md"
    priority
  />
  <span>ZERIY MEMBERSHIP</span>
</div>

          <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
            Simple plans.
            <span className="block text-indigo-600">
              Better experiences.
            </span>
          </h2>

          <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-gray-500 sm:text-base">
            Get more convenience with Zeriy. Choose a plan that
            fits your needs and enjoy a smoother booking experience.
          </p>

          {/* BILLING TOGGLE */}
          <div className="mt-9 inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 p-1">

            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                billing === "monthly"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Monthly
            </button>

            <button
              type="button"
              onClick={() => setBilling("yearly")}
              className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                billing === "yearly"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Yearly
            
            </button>
          </div>
        </div>
      </section>

      {/* PLANS */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">

        <div className="mb-9 text-center">
          <h3 className="text-2xl font-bold text-gray-900">
            Choose your plan
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            No complicated pricing. Just simple choices.
          </p>
        </div>

        <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">

          {plans.map((plan) => {
            const Icon = plan.icon;
            const price =
              billing === "monthly"
                ? plan.monthly
                : plan.yearly;

            const isCurrent = currentPlan === plan.id;

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-3xl border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg sm:p-8 ${
                  plan.popular
                    ? "border-indigo-500 ring-2 ring-indigo-100"
                    : "border-gray-200"
                }`}
              >

                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm">
                    MOST POPULAR
                  </div>
                )}

                {/* PLAN ICON */}
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                  plan.popular
                    ? "bg-indigo-100 text-indigo-600"
                    : "bg-gray-100 text-gray-600"
                }`}>
                  <Icon size={24} />
                </div>

                <h4 className="mt-5 text-xl font-bold">
                  {plan.name}
                </h4>

                <p className="mt-2 min-h-10 text-sm text-gray-500">
                  {plan.description}
                </p>

                {/* PRICE */}
                <div className="mt-7 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold tracking-tight">
                    ₹{price}
                  </span>

                  <span className="text-sm text-gray-500">
                    /{price === 0 ? "forever" : billing === "monthly" ? "month" : "year"}
                  </span>
                </div>

                {billing === "yearly" && plan.monthly > 0 && (
                  <p className="mt-2 text-xs font-medium text-emerald-600">
                    ₹{Math.round(plan.yearly / 12)} per month, billed yearly
                  </p>
                )}

                {/* BUTTON */}
                <button
                  type="button"
                  onClick={() => handleUpgrade(plan)}
                  disabled={isCurrent}
                  className={`mt-7 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition ${
                    isCurrent
                      ? "cursor-default border border-gray-200 bg-gray-100 text-gray-500"
                      : plan.popular
                      ? "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 active:scale-[0.98]"
                      : "border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 active:scale-[0.98]"
                  }`}
                >
                  {isCurrent ? (
                    <>
                      <Check size={17} />
                      Current Plan
                    </>
                  ) : (
                    <>
                      {plan.id === "free" ? "Get Started" : "Upgrade Now"}
                      <Zap size={16} />
                    </>
                  )}
                </button>

                <div className="my-7 border-t border-gray-100" />

                <p className="mb-4 text-xs font-bold uppercase tracking-wider text-gray-400">
                  What's included
                </p>

                <ul className="space-y-4">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-3 text-sm text-gray-600"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                        <Check size={13} strokeWidth={3} />
                      </span>
                      {feature}
                    </li>
                  ))}

                  {plan.unavailable.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-3 text-sm text-gray-400"
                    >
                      <X size={17} className="mt-0.5 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

        </div>
      </section>

      {/* TRUST SECTION */}
      <section className="border-t border-gray-200 bg-white">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 sm:grid-cols-3 sm:px-6">

          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <ShieldCheck size={23} />
            </div>
            <div>
              <h4 className="text-sm font-bold">Secure Payments</h4>
              <p className="mt-1 text-xs text-gray-500">
                Secure payment processing.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <CalendarDays size={23} />
            </div>
            <div>
              <h4 className="text-sm font-bold">Flexible Plans</h4>
              <p className="mt-1 text-xs text-gray-500">
                Choose monthly or yearly billing.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Headphones size={23} />
            </div>
            <div>
              <h4 className="text-sm font-bold">Customer Support</h4>
              <p className="mt-1 text-xs text-gray-500">
                We're here to help.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-200 bg-gray-50 px-4 py-7 text-center">
        <p className="text-xs text-gray-500">
          © {new Date().getFullYear()} Zeriy. Made Simpler & Much Faster.
        </p>

        <Link
          href="/"
          className="mt-3 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-700"
        >
          Back to Home
        </Link>
      </footer>

    </main>
  );
}

