import Link from "next/link";

const parlours = [
  {
    name: "Aura Glow Beauty Parlour & Spa",
    category: "For Women",
    rating: "4.9",
    address: "80 Feet Road, Koramangala 4th Block",
    distance: "0.6 km",
    serving: "#5",
    people: "6 People in Line",
  },
  {
    name: "Naturals Women Beauty Parlour",
    category: "For Women",
    rating: "4.7",
    address: "Koramangala 5th Block, Bengaluru",
    distance: "1.1 km",
    serving: "#8",
    people: "8 People in Line",
  },
  {
    name: "Rose Petals Ladies Parlour",
    category: "For Women",
    rating: "4.5",
    address: "Tavarekere Main Road, BTM",
    distance: "1.8 km",
    serving: "#3",
    people: "5 People in Line",
  },
  {
    name: "Bliss Glow Herbal Parlour",
    category: "For Women",
    rating: "4.6",
    address: "Ejipura Signal, Inner Ring Road",
    distance: "2.2 km",
    serving: "#6",
    people: "6 People in Line",
  },
];

export default function ParloursPage() {
  return (
    <main className="min-h-screen bg-gray-50">

      {/* ================= HEADER ================= */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-[78px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

          {/* Left Side */}
          <div className="flex items-center gap-3 sm:gap-4">

            {/* Back Button */}
            <Link
              href="/"
              aria-label="Go back"
              className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100"
            >
              <span className="text-2xl leading-none">‹</span>
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

          {/* User */}
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

        {/* Page Heading */}
        <div className="mb-5 sm:mb-6">

          {/* Category */}
          <div className="flex flex-wrap items-center gap-2">

            <span className="rounded-full bg-pink-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-pink-600">
              Parlour
            </span>

            

          </div>

          <h2 className="mt-3 text-xl font-bold text-gray-900 sm:text-2xl">
            Beauty Parlours Near You 
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Select any parlour to view available services
          </p>

        </div>

        {/* ================= PARLOUR LIST ================= */}
        <div className="space-y-3 sm:space-y-4">

          {parlours.map((parlour) => (

            <div
              key={parlour.name}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-pink-200 hover:shadow-md sm:p-5"
            >

              {/* Responsive Layout */}
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                {/* Parlour Information */}
                <div className="min-w-0 flex-1">

                  {/* Name + Category + Rating */}
                  <div className="flex flex-wrap items-center gap-2">

                    <h3 className="text-base font-bold text-gray-900 sm:text-lg">
                      {parlour.name}
                    </h3>

                    {/* Women Badge */}
                    {parlour.category ?<span className="rounded-full border border-pink-200 bg-pink-50 px-2.5 py-1 text-xs font-semibold text-pink-600">
                      {parlour.category}
                    </span>:""}

                    {/* Rating */}
                    {parlour.rating ?<span className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-600">
                      ★ {parlour.rating}
                    </span>:""}

                  </div>

                  {/* Address */}
                  <div className="mt-2 flex items-start gap-1.5 text-sm text-gray-500">

                    <span className="mt-0.5 text-pink-500">
                      📍
                    </span>

                    <span>
                      {parlour.address}{" "}
                      <span className="text-gray-400">
                        ({parlour.distance})
                      </span>
                    </span>

                  </div>

                  {/* Queue Information */}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">

                    <span className="text-gray-500">
                      Now Serving:
                    </span>

                    <span className="font-semibold text-gray-800">
                      {parlour.serving}
                    </span>

                    <span className="text-gray-300">
                      •
                    </span>

                    <span className="font-medium text-indigo-600">
                      {parlour.people}
                    </span>

                  </div>

                </div>

                {/* View Services Button */}
                <div className="w-full md:w-auto">

                  <Link
                    href={`/services/parlours/${parlour.name
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/(^-|-$)/g, "")}`}
                    className="flex w-full items-center justify-center rounded-xl bg-indigo-50 px-5 py-3 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 md:w-auto"
                  >
                    View Services
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