
"use client";

import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  ShieldCheck,
  AlertTriangle,
  Mail,
  ChevronRight,
} from "lucide-react";

const UPDATED = "2 November 2026";
const EMAIL = "theinsightfact04@gmail.com";
const SITE = "https://zeriy.com";

const OPERATOR = "[INSERT LEGAL NAME OF ZERIY OPERATOR]";
const ADDRESS = "[INSERT PRINCIPAL BUSINESS ADDRESS]";

const sections = [
  [
    "1. Acceptance, eligibility, and operator",
    [
      "These Terms apply to ZERIY's app, website, bookings, queue/token, payment, and support features. Using the Platform means you agree to these Terms and the Customer Privacy Policy.",
      `Operator: ${OPERATOR}. Address: ${ADDRESS}. Website: ${SITE}. Support: ${EMAIL}. Replace placeholders before launch.`,
      "Minors may use the Platform only with parental or guardian involvement and where the service and applicable law permit it. Do not enable independent minor booking flows until safeguards and legal review are complete.",
    ],
  ],
  [
    "2. Accounts and prohibited conduct",
    [
      "Provide accurate information, protect your login credentials, and contact support if you suspect unauthorised access. Email/password and Google sign-in may be available.",
      "Fake accounts, fraudulent bookings/payments, impersonation, review manipulation, abuse, unlawful activity, or misuse of the Platform may result in restriction or suspension.",
    ],
  ],
  [
    "3. Bookings and notifications",
    [
      "You may select services/providers and use available appointment, token, or queue features. Availability depends on the provider and the feature shown.",
      "Submitting a request does not by itself confirm the booking. The owner may accept or reject it, and ZERIY intends to notify you in either case. Check the booking status in the app.",
    ],
  ],
  [
    "4. Booking fee and payment",
    [
      "A fixed booking fee is separate from the remaining service charge payable after service, where that arrangement is displayed. The booking fee, total price, taxes, and payment timing must be shown before you confirm payment.",
      "Payments may be processed through Razorpay and are subject to the payment method and provider's terms. ZERIY should never ask for your UPI PIN or full card security credentials.",
      "Do not pay unless the amount and applicable cancellation/refund terms are visible. Contact support if the charged amount differs from the displayed amount.",
    ],
  ],
  [
    "5. Customer cancellation",
    [
      "The proposed standard deadline is at least 24 hours before the scheduled appointment. If you cancel at least 24 hours before the appointment, the booking advance is eligible for a full refund, subject to verification that the payment was captured and relates to the booking.",
      "For cancellations less than 24 hours before the appointment, the advance may be non-refundable only if that condition was clearly displayed and affirmatively accepted before payment, and only to the extent permitted by law. No separate cancellation fee is charged under the current business decision.",
      "No cancellation condition can override mandatory consumer protections or permit an unlawful or unfair charge.",
    ],
  ],
  [
    "6. Owner cancellation, rejection, or non-availability",
    [
      "If an owner rejects a booking, cancels a confirmed booking, or is unavailable and cannot provide the booked service, you are eligible for a full refund of the booking advance.",
      "If a booking remains unconfirmed beyond the timeout displayed in the app, the advance should be automatically queued for refund. The timeout has not been selected yet and must be configured, disclosed, and tested before launch.",
      "If you paid an additional amount for a service that was not delivered, contact support so the issue can be reviewed and handled under applicable law.",
    ],
  ],
  [
    "7. Refund processing",
    [
      "Eligible refunds will be initiated through ZERIY's payment process, using Razorpay where applicable, and ordinarily returned to the original payment method where supported.",
      "The time for funds to appear depends on payment method, provider, bank, and other financial institutions. ZERIY does not guarantee a specific credit date. Operational refund timing must be confirmed before launch; do not publish a promise that the system cannot meet.",
      "A reasonable verification process may apply, but it must not be used to delay a valid refund unreasonably. Include booking and transaction references when contacting support.",
    ],
  ],
  [
    "8. Failed, duplicate, and disputed payments",
    [
      "If payment is captured but the booking fails, is rejected, or remains unconfirmed past the disclosed timeout, the advance should be automatically queued for refund.",
      "If you believe you were charged twice, contact support with transaction references. ZERIY will review the records and assist with a refund of a verified duplicate charge.",
      "If a service has been completed but you complain about quality, submit a complaint to support. ZERIY may review the booking and communicate with the provider. Any refund or remedy depends on the facts, disclosed provider terms, and applicable law; a completed service is not automatically refundable in every case.",
    ],
  ],
  [
    "9. Reviews and customer conduct",
    [
      "You may rate or review after a completed booking. Reviews must be honest, relevant, and based on genuine experience. ZERIY may review reports of fake, abusive, unlawful, or policy-violating content and may remove it after appropriate review.",
      "Repeated no-shows, fake bookings, fraud, abusive conduct, or other misuse may lead to warnings, restrictions, or suspension depending on severity and applicable law.",
    ],
  ],
  [
    "10. Service responsibility and availability",
    [
      "The provider is generally responsible for delivering its listed service, maintaining required qualifications/licences, and providing accurate descriptions and prices. ZERIY may also have responsibilities depending on its actual role and applicable law.",
      "Temporary outages may occur due to maintenance, technical issues, third-party failures, or events outside reasonable control. ZERIY will take reasonable steps to restore service but does not promise uninterrupted availability. Nothing in these Terms excludes rights that cannot lawfully be excluded.",
    ],
  ],
  [
    "11. Complaints, disputes, and changes",
    [
      `Contact ${EMAIL} for booking, payment, refund, or service complaints. Include booking ID and payment reference where available. Support contact does not remove your right to pursue remedies under applicable law.`,
      "These Terms are governed by Indian law, subject to mandatory consumer protections and the jurisdiction of competent forums.",
      "Material changes will be communicated through an appropriate channel and the effective date updated. Where required, fresh consent will be obtained.",
    ],
  ],
];

function PolicyPage({ title, kind, warning, intro, sections }) {
  const router = useRouter();

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f8fc] text-slate-800">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <button
            onClick={handleBack}
            className="group flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
          >
            <ArrowLeft
              size={17}
              className="transition-transform group-hover:-translate-x-1"
            />
            Back
          </button>
 <div className="flex items-center gap-2">
         <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-200">
                       <Image
             src="/logo.png"
             alt="ZERIY Logo"
             width={130}
             height={45}
             className="h-9 w-auto object-contain rounded-xl"/>
                     </div>
                     <span className="text-lg font-extrabold tracking-tight text-slate-900">
                       ZERIY
                     </span>
                   </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="mx-auto max-w-5xl px-5 py-10 sm:py-14">
        {/* Page Title */}
        <div className="mb-9">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-indigo-700">
            <FileText size={14} />
            ZERIY · {kind}
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">
            {title}
          </h1>

          <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <ShieldCheck size={15} />
            Last updated: {UPDATED}
          </p>
        </div>

        {/* Legal Warning */}
        <div className="mb-8 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <AlertTriangle
            size={21}
            className="mt-0.5 shrink-0 text-amber-600"
          />
          <div>
            <h3 className="font-bold text-amber-900">
              Before publishing
            </h3>
            <p className="mt-1 text-sm leading-6 text-amber-800">
              {warning}
            </p>
          </div>
        </div>

        {/* Introduction */}
        <section className="mb-9 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-3 flex items-center gap-2 font-bold text-slate-900">
            <ShieldCheck size={19} className="text-indigo-600" />
            About these Terms
          </div>

          <p className="text-sm leading-7 text-slate-600 sm:text-base">
            {intro}
          </p>
        </section>

        {/* Terms Sections */}
        <div className="space-y-5">
          {sections.map(([heading, items], index) => (
            <section
              key={heading}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md sm:p-8"
            >
              <div className="mb-5 flex items-start gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm font-bold text-indigo-700">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <h2 className="pt-1 text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                  {heading}
                </h2>
              </div>

              <ul className="space-y-4 pl-5 text-sm leading-7 text-slate-600 marker:text-indigo-500 sm:text-base">
                {items.map((item, i) => (
                  <li key={i} className="pl-1">
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* Support Card */}
        <section className="mt-8 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 p-6 text-white shadow-lg shadow-indigo-200 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
              <Mail size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold">Need assistance?</h2>
              <p className="text-sm text-indigo-100">
                Our support team is here to help with bookings and refunds.
              </p>
            </div>
          </div>

          <a
            href={`mailto:${EMAIL}`}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-indigo-700 transition hover:bg-indigo-50"
          >
            {EMAIL}
            <ChevronRight size={16} />
          </a>
        </section>

        {/* Footer */}
        <footer className="mt-12 border-t border-slate-200 pt-7 text-center">
          <div className="mb-3 flex justify-center">
            <Image
              src="/logo.png"
              alt="ZERIY Logo"
              width={130}
              height={45}
              className="h-9 w-auto object-contain"
            />
          </div>

          <p className="text-xs leading-6 text-slate-500">
            © {new Date().getFullYear()} ZERIY. All rights reserved.
            <br />
            Made Simpler & Much Faster.
          </p>

          <button
            onClick={handleBack}
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 transition hover:text-indigo-800"
          >
            <ArrowLeft size={15} />
            Go Back
          </button>
        </footer>
      </div>
    </main>
  );
}

export default function UserTermsAndConditions() {
  return (
    <PolicyPage
      title="Customer Terms & Conditions"
      kind="Terms"
      warning="Complete the operator/address placeholders and configure the automatic-refund timeout. Show booking fee, total price, and cancellation terms before payment. Obtain Indian legal review."
      intro="These Terms govern customer use of ZERIY. Refund eligibility and cancellation rules are included here rather than in a separate Refund Policy page."
      sections={sections}
    />
  );
}
