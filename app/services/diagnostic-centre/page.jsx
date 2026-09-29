import Link from "next/link";

const diagnosticLabs = [
  {
    name: "Apex Diagnostic & Pathology Lab",
    rating: "4.8",
    address: "BTM 2nd Stage, Outer Ring Road, Bengaluru",
    distance: "0.7 km",
    doctor: "Dr. Arvind Swaminathan",
    specialization: "MD Pathology",
    serving: "#14",
    people: "14 People in Line",
  },
  {
    name: "ThyroScan Path Lab & Imaging",
    rating: "4.7",
    address: "Madiwala Main Road, Bengaluru",
    distance: "1.2 km",
    doctor: "Dr. Malini Kapoor",
    specialization: "MD Biochemistry & Endocrinology Lab Specialist",
    serving: "#8",
    people: "11 People in Line",
  },
  {
    name: "Metropolis Healthcare Diagnostics",
    rating: "4.9",
    address: "BTM 1st Stage, Bengaluru",
    distance: "1.6 km",
    doctor: "Dr. Suresh Nambiar",
    specialization: "MD Microbiology & Pathology Diagnostics",
    serving: "#21",
    people: "14 People in Line",
  },
  {
    name: "Dr. Lal PathLabs Express Counter",
    rating: "4.6",
    address: "Silk Board Junction, Bengaluru",
    distance: "2.3 km",
    doctor: "Dr. Deepa Nair",
    specialization: "Consultant Clinical Pathologist",
    serving: "#5",
    people: "7 People in Line",
  },
];

export default function DiagnosticLabsPage() {
  return (
    <main className="min-h-screen bg-gray-50">

      {/* ================= HEADER ================= */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-[78px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

          {/* LEFT SIDE */}
          <div className="flex items-center gap-3 sm:gap-4">

            {/* Back Button */}
            <Link
              href="/"
              aria-label="Go back"
              className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
            >
              <span className="text-2xl leading-none">
                ‹
              </span>
            </Link>

            {/* Logo */}
            <div className="flex items-center gap-2.5">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-md shadow-indigo-200">
                <span className="font-bold text-white">
                  Q
                </span>
              </div>

              <div>
                <h1 className="text-base font-bold leading-tight text-gray-900 sm:text-lg">
                  QueueEase
                </h1>

                <p className="text-xs text-gray-500 sm:text-sm">
                  Customer Booking App
                </p>
              </div>

            </div>
          </div>

          {/* USER SECTION */}
          <div className="flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 sm:gap-3 sm:px-4">

            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>

            <span className="hidden text-sm font-medium text-indigo-700 sm:block">
              Rahul Sharma
            </span>

            <button
              type="button"
              className="text-xs font-medium text-gray-400 transition hover:text-indigo-600 sm:text-sm"
            >
              Logout
            </button>

          </div>
        </div>
      </header>

      {/* ================= MAIN CONTENT ================= */}
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">

        {/* PAGE HEADING */}
        <div className="mb-5 sm:mb-6">

          <div className="flex flex-wrap items-center gap-2">

            {/* Category */}
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-600">
              Diagnostic Centre
            </span>

            {/* Patient Category */}
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
              All Patients
            </span>

          </div>

          <h2 className="mt-3 text-xl font-bold text-gray-900 sm:text-2xl">
            Diagnostic Centres Near You
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Select a clinic or lab to view chief consulting doctor specialist
          </p>

        </div>

        {/* ================= DIAGNOSTIC LAB LIST ================= */}
        <div className="space-y-3 sm:space-y-4">

          {diagnosticLabs.map((lab) => (

            <div
              key={lab.name}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md sm:p-5"
            >

              {/* RESPONSIVE CARD */}
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                {/* LAB INFORMATION */}
                <div className="min-w-0 flex-1">

                  {/* NAME + RATING */}
                  <div className="flex flex-wrap items-center gap-2">

                    <h3 className="text-base font-bold text-gray-900 sm:text-lg">
                      {lab.name}
                    </h3>

                    {/* Rating */}
                    {lab.rating ?<span className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-600">
                      ★ {lab.rating}
                    </span>:""}

                  </div>

                  {/* ADDRESS */}
                  <div className="mt-2 flex items-start gap-1.5 text-sm text-gray-500">

                    <span className="mt-0.5 text-red-500">
                      📍
                    </span>

                    <span>
                      {lab.address}{" "}
                      <span className="text-gray-400">
                        ({lab.distance})
                      </span>
                    </span>

                  </div>

                  {/* DOCTOR */}
                  <div className="mt-2 flex items-start gap-1.5 text-sm">

                    <span className="mt-0.5">
                      🧑‍⚕️
                    </span>

                    <span className="font-medium text-indigo-600">
                      {lab.doctor}
                      <span className="text-gray-500">
                        {" "}
                        • {lab.specialization}
                      </span>
                    </span>

                  </div>

                  {/* QUEUE INFORMATION */}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">

                    <span className="text-gray-500">
                      Now Serving:
                    </span>

                    <span className="font-semibold text-gray-800">
                      {lab.serving}
                    </span>

                    <span className="text-gray-300">
                      •
                    </span>

                    <span className="font-medium text-indigo-600">
                      {lab.people}
                    </span>

                  </div>

                </div>

                {/* VIEW DOCTOR BUTTON */}
                <div className="w-full md:w-auto">

                  <Link
                    href={`/services/diagnostic-labs/${lab.name
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/(^-|-$)/g, "")}`}
                    className="flex w-full items-center justify-center rounded-xl bg-indigo-50 px-5 py-3 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 md:w-auto"
                  >
                    View Doctor
                    <span className="ml-2">
                      →
                    </span>
                  </Link>

                </div>

              </div>

            </div>

          ))}

        </div>

      </section>
    </main>
  );
}