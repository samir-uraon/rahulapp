"use client"
import Link from "next/link";
import Header from "@/components/Header";
const clinics = [
  {
    name: "Dr. Verma Dental & Skin Clinic",
    rating: "4.9",
    address: "HSR Layout Sector 4, Bengaluru",
    distance: "0.9 km",
    doctor: "Dr. S. K. Verma",
    specialization: "MDS",
    serving: "#6",
    people: "8 People in Line",
  },
  {
    name: "Apex Orthopedic & Bone Care Clinic",
    rating: "4.8",
    address: "HSR Layout Sector 1, Bengaluru",
    distance: "1.3 km",
    doctor: "Dr. R. N. Murthy",
    specialization: "MS Orthopaedics",
    serving: "#11",
    people: "9 People in Line",
  },
  {
    name: "CareWell Pediatric & Child Clinic",
    rating: "4.9",
    address: "27th Main, HSR Layout, Bengaluru",
    distance: "1.7 km",
    doctor: "Dr. Priya V. Shenoy",
    specialization: "MD Pediatrics",
    serving: "#4",
    people: "6 People in Line",
  },
  {
    name: "DermaHealth Skin & Hair Clinic",
    rating: "4.7",
    address: "Koramangala 1st Block, Bengaluru",
    distance: "2.1 km",
    doctor: "Dr. Shalini Rao",
    specialization: "MD Dermatology",
    serving: "#8",
    people: "7 People in Line",
  },
  {
    name: "Metro General Physician & Geriatric OPD",
    rating: "4.6",
    address: "Teachers Colony, Koramangala",
    distance: "2.5 km",
    doctor: "Dr. Alok Banerjee",
    specialization: "MBBS, MD",
    serving: "#9",
    people: "8 People in Line",
  },
];

export default function ClinicsPage() {
  return (
    <main className="min-h-screen bg-gray-50">

      
    <Header
  showBack={true}  
/>

      {/* ================= MAIN CONTENT ================= */}
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">

        {/* PAGE HEADING */}
        <div className="mb-5 sm:mb-6">

          {/* CATEGORY BADGES */}
          <div className="flex flex-wrap items-center gap-2">

            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-600">
              Clinic
            </span>

            

          </div>

          <h2 className="mt-3 text-xl font-bold text-gray-900 sm:text-2xl">
            Clinics & Doctor Specialists Near You
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Select a clinic or lab to view chief consulting doctor specialist
          </p>

        </div>

        {/* ================= CLINIC LIST ================= */}
        <div className="space-y-3 sm:space-y-4">

          {clinics.map((clinic) => (

            <div
              key={clinic.name}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md sm:p-5"
            >

              {/* RESPONSIVE CARD */}
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                {/* CLINIC INFORMATION */}
                <div className="min-w-0 flex-1">

                  {/* NAME + RATING */}
                  <div className="flex flex-wrap items-center gap-2">

                    <h3 className="text-base font-bold text-gray-900 sm:text-lg">
                      {clinic.name}
                    </h3>

                    {clinic.rating ?<span className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-600">
                      ★ {clinic.rating}
                    </span>:""}

                  </div>

                  {/* ADDRESS */}
                  <div className="mt-2 flex items-start gap-1.5 text-sm text-gray-500">

                    <span className="mt-0.5 text-red-500">
                      📍
                    </span>

                    <span>
                      {clinic.address}{" "}
                      <span className="text-gray-400">
                        ({clinic.distance})
                      </span>
                    </span>

                  </div>

                  {/* DOCTOR */}
                  <div className="mt-2 flex items-start gap-1.5 text-sm">

                    <span className="mt-0.5">
                      🧑‍⚕️
                    </span>

                    <span className="font-medium text-indigo-600">
                      {clinic.doctor}
                      <span className="text-gray-500">
                        {" "}
                        • {clinic.specialization}
                      </span>
                    </span>

                  </div>

                  {/* QUEUE INFORMATION */}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">

                    <span className="text-gray-500">
                      Now Serving:
                    </span>

                    <span className="font-semibold text-gray-800">
                      {clinic.serving}
                    </span>

                    <span className="text-gray-300">
                      •
                    </span>

                    <span className="font-medium text-indigo-600">
                      {clinic.people}
                    </span>

                  </div>

                </div>

                {/* VIEW DOCTOR BUTTON */}
                <div className="w-full md:w-auto">

                  <Link
                    href={`/services/clinics/${clinic.name
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