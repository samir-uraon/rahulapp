"use client";

import Link from "next/link";
import { useState } from "react";

export default function Footer() {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      number: "01",
      icon: "🔍",
      title: "Choose Service",
      description:
        "Select the service you need from Saloon, Parlour, Clinic or Diagnostic Centre.",
    },
    {
      number: "02",
      icon: "📍",
      title: "Select Location",
      description:
        "Find nearby businesses and explore the services available at each location.",
    },
    {
      number: "03",
      icon: "📅",
      title: "Book Your Slot",
      description:
        "Choose your preferred service, available staff and convenient appointment time.",
    },
    {
      number: "04",
      icon: "⏱️",
      title: "Track Your Queue",
      description:
        "After booking, keep track of your token, queue position and estimated waiting time.",
    },
  ];

  const features = [
    {
      icon: "⚡",
      title: "Quick Booking",
      description:
        "Book your service before reaching the location.",
    },
    {
      icon: "📍",
      title: "Nearby Places",
      description:
        "Discover available services and locations around you.",
    },
    {
      icon: "⏱️",
      title: "Live Queue",
      description:
        "Keep track of your token and estimated waiting time.",
    },
    {
      icon: "🔔",
      title: "Notifications",
      description:
        "Stay updated about your appointment and queue.",
    },
  ];

  return (
    <footer className="mt-10">

      {/* =====================================================
          HOW QUEUEEASE WORKS
      ====================================================== */}

      <section className="bg-white border-y border-gray-200">

        <div className="max-w-7xl mx-auto px-5 py-14">

          {/* Heading */}
          <div className="text-center">

            <p className="text-sm font-semibold text-indigo-600 uppercase tracking-wider">
              Simple & Smart
            </p>

            <h2 className="mt-2 text-3xl font-bold text-gray-900">
              How QueueEase Works
            </h2>

            <p className="mt-3 text-gray-500 max-w-2xl mx-auto">
              Book your service before you arrive and spend less time waiting.
            </p>

          </div>


          {/* Steps */}
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">

            {steps.map((step, index) => {

              const active = activeStep === index;

              return (
                <button
                  key={step.number}
                  type="button"
                  onClick={() => setActiveStep(index)}
                  className={`text-left rounded-2xl p-5 border-2 transition-all duration-200 ${
                    active
                      ? "border-indigo-500 bg-indigo-50 shadow-sm"
                      : "border-gray-200 bg-white hover:border-indigo-200"
                  }`}
                >

                  <div className="flex items-center justify-between">

                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl ${
                        active
                          ? "bg-indigo-600"
                          : "bg-gray-100"
                      }`}
                    >
                      {step.icon}
                    </div>

                    <span
                      className={`text-sm font-bold ${
                        active
                          ? "text-indigo-500"
                          : "text-gray-300"
                      }`}
                    >
                      {step.number}
                    </span>

                  </div>

                  <h3 className="mt-4 font-bold text-gray-900">
                    {step.title}
                  </h3>

                </button>
              );
            })}

          </div>


          {/* Active Step Description */}
          <div className="mt-6 max-w-3xl mx-auto">

            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center">

              <div className="text-3xl">
                {steps[activeStep].icon}
              </div>

              <h3 className="mt-3 text-xl font-bold text-gray-900">
                {steps[activeStep].title}
              </h3>

              <p className="mt-2 text-gray-500 leading-relaxed">
                {steps[activeStep].description}
              </p>

            </div>

          </div>


          <p className="mt-8 text-center text-gray-500 italic">
            "Spend less time waiting, spend more time living."
          </p>

        </div>

      </section>


      {/* =====================================================
          WHY QUEUEEASE
      ====================================================== */}

      <section className="bg-gray-50">

        <div className="max-w-7xl mx-auto px-5 py-14">

          {/* Heading */}
          <div className="text-center">

            <p className="text-sm font-semibold text-indigo-600 uppercase tracking-wider">
              Why QueueEase?
            </p>

            <h2 className="mt-2 text-3xl font-bold text-gray-900">
              Your time matters
            </h2>

            <p className="mt-3 text-gray-500 max-w-2xl mx-auto">
              QueueEase helps you plan your visit instead of spending
              your time waiting in a queue.
            </p>

          </div>


          {/* Features */}
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

            {features.map((feature) => (

              <div
                key={feature.title}
                className="bg-white border border-gray-200 rounded-2xl p-6 text-center hover:border-indigo-200 hover:shadow-sm transition"
              >

                <div className="mx-auto w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-2xl">
                  {feature.icon}
                </div>

                <h3 className="mt-4 font-bold text-gray-900">
                  {feature.title}
                </h3>

                <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                  {feature.description}
                </p>

              </div>

            ))}

          </div>

        </div>

      </section>


      {/* =====================================================
          YOUR TIME MATTERS
      ====================================================== */}

      <section className="bg-gray-50 px-5 pb-14">

        <div className="max-w-7xl mx-auto">

          <div className="relative overflow-hidden rounded-3xl bg-indigo-600 px-6 py-12 md:px-12 text-center">

            {/* Decorative circles */}
            <div className="absolute -top-16 -right-16 w-40 h-40 bg-white/10 rounded-full"></div>

            <div className="absolute -bottom-20 -left-16 w-48 h-48 bg-white/10 rounded-full"></div>


            {/* Content */}
            <div className="relative">

              <div className="text-4xl">
                ⏱️
              </div>

              <h2 className="mt-4 text-3xl font-bold text-white">
                Your Time Matters
              </h2>

              <p className="mt-3 max-w-2xl mx-auto text-indigo-100">
                Book before you arrive. Know your queue position.
                Spend less time waiting and more time doing what matters.
              </p>

              <Link
                href="/bookings"
                className="inline-flex mt-7 items-center justify-center px-6 py-3 bg-white text-indigo-600 font-semibold rounded-xl hover:bg-indigo-50 transition shadow-sm"
              >
                View My Bookings
                <span className="ml-2">
                  →
                </span>
              </Link>

            </div>

          </div>

        </div>

      </section>


      {/* =====================================================
          SMALL FOOTER
      ====================================================== */}

      <div className="border-t border-gray-200 bg-white">

        <div className="max-w-7xl mx-auto px-5 py-8">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">

            {/* Brand */}
            <div>

              <Link
                href="/"
                className="flex items-center gap-2"
              >

                <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
                  <span className="text-white font-bold">
                    Q
                  </span>
                </div>

                <span className="text-lg font-bold text-gray-900">
                  QueueEase
                </span>

              </Link>

              <p className="mt-2 text-sm text-gray-500">
                Smart booking. Less waiting.
              </p>

            </div>


            {/* Links */}
            <div className="flex flex-wrap gap-x-6 gap-y-3">

             

              <Link
                href="/how-it-works"
                className="text-sm text-gray-500 hover:text-indigo-600 transition"
              >
                How It Works
              </Link>

              <Link
                href="/support"
                className="text-sm text-gray-500 hover:text-indigo-600 transition"
              >
                Support
              </Link>

              <Link
                href="/privacy"
                className="text-sm text-gray-500 hover:text-indigo-600 transition"
              >
                Privacy
              </Link>

              <Link
                href="/terms"
                className="text-sm text-gray-500 hover:text-indigo-600 transition"
              >
                Terms
              </Link>

            </div>

          </div>


          {/* Divider */}
          <div className="my-6 border-t border-gray-100"></div>


          {/* Copyright */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">

            <p className="text-xs text-gray-400">
              © 2026 QueueEase. All rights reserved.
            </p>

            <p className="text-xs text-gray-400">
              Book smarter • Wait less • Save time
            </p>

          </div>

        </div>

      </div>

    </footer>
  );
}