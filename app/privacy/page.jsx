
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ShieldCheck,
  LockKeyhole,
  FileText,
  Mail,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import Image from "next/image";

const UPDATED = "2 November 2026";
const EMAIL = "theinsightfact04@gmail.com";
const SITE = "https://zeriy.com";

const OPERATOR = "[INSERT LEGAL NAME OF ZERIY OPERATOR]";
const ADDRESS = "[INSERT PRINCIPAL BUSINESS ADDRESS]";
const GRIEVANCE =
  "[INSERT GRIEVANCE OFFICER NAME/DESIGNATION AND CONTACT DETAILS]";

const sections = [
  [
    "1. Who operates ZERIY",
    [
      `Operator: ${OPERATOR}. Principal address: ${ADDRESS}. Website: ${SITE}. Support/privacy email: ${EMAIL}. The domain name is not itself proof of a registered legal business name.`,
      `Grievance contact: ${GRIEVANCE}. Complete all placeholders before publishing.`,
    ],
  ],
  [
    "2. Information we may collect",
    [
      "Account information: name, email address, mobile number, sign-in/authentication information, and profile details you provide. ZERIY should not store plain-text passwords; credentials must be protected using appropriate security controls.",
      "Booking information: selected service and provider, appointment date/time, token or queue details, booking status, acceptance/rejection, cancellation history, and booking-related communications.",
      "Payment information: payment status, amount, transaction/reference IDs, refund status, and limited information returned by Razorpay. Do not store full card credentials, CVV, or UPI PINs.",
      "Location: precise device location may be processed if you grant GPS permission, to find nearby businesses or provide location-based features. You can disable permission in device settings.",
      "Support information: complaints, reviews, ratings, and messages you send to support. Technical information such as device, browser, IP address, app version, crash and usage data may be processed if relevant tools are implemented.",
    ],
  ],
  [
    "3. How we use information",
    [
      "Create accounts and authenticate users, including email/password and Google sign-in where available.",
      "Receive and manage booking requests; communicate acceptance or rejection; provide token updates, reminders, essential notifications, and customer support.",
      "Process or reconcile payments, refunds, duplicate-payment reports, chargebacks, and fraud/security investigations.",
      "Maintain and improve the Platform, investigate abuse, enforce terms, and comply with legal obligations.",
    ],
  ],
  [
    "4. Location permission",
    [
      "If GPS is requested, the app should explain the purpose before asking for permission. Location should be used for disclosed purposes such as nearby-provider search, not unrelated tracking.",
      "You can deny or withdraw device-level permission; some location features may then be unavailable. Manual location selection should be offered where feasible.",
    ],
  ],
  [
    "5. Sharing information",
    [
      "Relevant business owners may receive only information reasonably necessary to fulfil a booking, such as customer name, selected service, appointment time, booking/token status, and contact details where needed.",
      "Information may be shared with payment providers such as Razorpay; hosting/database providers; authentication/email services; SMS/OTP providers; location/map providers; and analytics/diagnostic vendors if enabled.",
      "Information may be disclosed where required by law or valid legal process, or where reasonably necessary to protect safety, rights, security, or investigate fraud. ZERIY does not intend to sell customer personal information.",
    ],
  ],
  [
    "6. Notifications and marketing",
    [
      "Essential notices may include authentication, security, booking acceptance/rejection, booking changes, token updates, reminders, and payment/refund status.",
      "The current plan is to send essential notifications, not promotional messages. If marketing is added, it should be described transparently with applicable consent and opt-out controls.",
    ],
  ],
  [
    "7. Children and young users",
    [
      "The product decision is that minors may use ZERIY with parental or guardian involvement, but the implementation is not finalised. Do not enable independent minor accounts or bookings until appropriate safeguards and legal review are completed.",
      "If you believe a child has provided information in a way that is not permitted, contact support for review.",
    ],
  ],
  [
    "8. Retention and deletion",
    [
      "ZERIY will retain information only as reasonably necessary for accounts, bookings, refunds, support, security, disputes, and legal/accounting duties. The detailed retention schedule is not yet finalised and must be set before launch.",
      "Users may request account deletion through support or an in-app feature when available. Deletion may not immediately remove records required for lawful financial, tax, fraud-prevention, dispute, or compliance purposes.",
    ],
  ],
  [
    "9. Security and your choices",
    [
      "ZERIY intends to use reasonable safeguards such as access controls, secure transmission, protected credentials, backups, and incident response. No online service can guarantee absolute security.",
      "Depending on applicable law and provisions in force, you may be able to request access, correction, deletion, withdraw consent where processing relies on consent, or raise a grievance. Contact support; identity verification may be required.",
    ],
  ],
  [
    "10. Third-party services and changes",
    [
      "Payment, hosting, authentication, location, communication, and analytics providers may have their own privacy notices. ZERIY should identify the actual vendors used in the live app before launch.",
      "We may update this Policy as the service or law changes. Material changes will be communicated through an appropriate channel, the effective date updated, and consent obtained where required for a new purpose.",
    ],
  ],
  [
    "11. Contact and grievance",
    [
      `Support/privacy email: ${EMAIL}. Website: ${SITE}.`,
      `Operator: ${OPERATOR}. Address: ${ADDRESS}.`,
      `Grievance contact: ${GRIEVANCE}. Replace the placeholders before publication.`,
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
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
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
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-5 py-10 sm:py-14">
        {/* Title */}
        <header className="mb-9">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-indigo-700">
            <LockKeyhole size={13} />
            ZERIY · {kind}
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">
            {title}
          </h1>

          <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <FileText size={15} />
            Last updated: {UPDATED}
          </p>
        </header>

        {/* Warning */}
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
            About this policy
          </div>
          <p className="text-sm leading-7 text-slate-600 sm:text-base">
            {intro}
          </p>
        </section>

        {/* Policy sections */}
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

        {/* Contact */}
        <section className="mt-8 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 p-6 text-white shadow-lg shadow-indigo-200 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
              <Mail size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold">Need help?</h2>
              <p className="text-sm text-indigo-100">
                Contact our support team for privacy-related questions.
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
          <div className="mb-3 flex items-center justify-center gap-2">
            <ShieldCheck size={18} className="text-indigo-600" />
            <span className="font-extrabold tracking-wide text-slate-800">
              ZERIY
            </span>
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

export default function UserPrivacyPolicy() {
  return (
    <PolicyPage
      title="Customer Privacy Policy"
      kind="Privacy"
      warning="Replace the legal operator, address and grievance placeholders, confirm actual data flows and vendors, and obtain Indian legal review before publication."
      intro="This Policy explains how ZERIY handles customer personal information. Booking cancellation and refund eligibility are covered in the Customer Terms & Conditions, not this Privacy Policy."
      sections={sections}
    />
  );
}
