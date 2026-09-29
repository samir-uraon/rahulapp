import Link from "next/link";

const salons = [
  {
    name: "StyleCraze Grooming Saloon",
    category: "For Men",
    rating: "4.8",
    address: "14th Main, Indiranagar, Bengaluru",
    distance: "0.8 km",
    serving: "#7",
    people: "8 People in Line",
  },
  {
    name: "Envi Men Hair Lounge",
    category: "For Men",
    rating: "4.7",
    address: "100 Feet Road, HAL 2nd Stage, Bengaluru",
    distance: "1.2 km",
    serving: "#12",
    people: "10 People in Line",
  },
  {
    name: "Jawad Habib Men Saloon",
    category: "For Men",
    rating: "4.6",
    address: "CMH Road, Indiranagar, Bengaluru",
    distance: "1.5 km",
    serving: "#4",
    people: "5 People in Line",
  },
  {
    name: "The Barber Club & Grooming",
    category: "For Men",
    rating: "4.9",
    address: "Domlur Layout, Bengaluru",
    distance: "2.0 km",
    serving: "#9",
    people: "9 People in Line",
  },
  {
    name: "Urban Cut Saloon",
    category: "For Men",
    rating: "4.5",
    address: "Thippasandra Main Road, Bengaluru",
    distance: "2.4 km",
    serving: "#3",
    people: "4 People in Line",
  },
];

export default function SalonsPage() {
  return (
    <main className="min-h-screen bg-gray-50">

      {/* ================= HEADER ================= */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-[78px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

          {/* Left Section */}
          <div className="flex items-center gap-3 sm:gap-4">

            {/* Back Button */}
            <Link
              href="/"
              className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
              aria-label="Go back"
            >
              <span className="text-2xl leading-none">‹</span>
            </Link>

            {/* Logo */}
            <div className="flex items-center gap-2.5">
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
            </div>
          </div>

          {/* User Section */}
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

          {/* Category Badge */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-600">
              Saloon
            </span>

            
          </div>

          <h2 className="mt-3 text-xl font-bold text-gray-900 sm:text-2xl">
            Saloons Near You 
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Select any saloon to view available services
          </p>
        </div>

        {/* ================= SALON LIST ================= */}
        <div className="space-y-3 sm:space-y-4">

          {salons.map((salon) => (
            <div
              key={salon.name}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md sm:p-5"
            >

              {/* Desktop / Mobile Layout */}
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                {/* Salon Information */}
                <div className="min-w-0 flex-1">

                  {/* Name + Category + Rating */}
                  <div className="flex flex-wrap items-center gap-2">

                    <h3 className="text-base font-bold text-gray-900 sm:text-lg">
                      {salon.name}
                    </h3>

                   {salon.category? <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600">
                      {salon.category}
                    </span>:""}

                    {  salon.rating ? <span className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-600"> 
                      ★ {salon.rating}
                    </span>:""}
                  </div>

                  {/* Address */}
                  <div className="mt-2 flex items-start gap-1.5 text-sm text-gray-500">
                    <span className="mt-0.5 text-red-500">📍</span>

                    <span>
                      {salon.address}{" "}
                      <span className="text-gray-400">
                        ({salon.distance})
                      </span>
                    </span>
                  </div>

                  {/* Queue Information */}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">

                    <span className="text-gray-500">
                      Now Serving:
                    </span>

                    <span className="font-semibold text-gray-800">
                      {salon.serving}
                    </span>

                    <span className="text-gray-300">•</span>

                    <span className="font-medium text-indigo-600">
                      {salon.people}
                    </span>
                  </div>
                </div>

                {/* View Services Button */}
                <div className="w-full md:w-auto">

                  <Link
                    href={`/services/salons/${salon.name
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/(^-|-$)/g, "")}`}
                    className="flex w-full items-center justify-center rounded-xl bg-indigo-50 px-5 py-3 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 md:w-auto"
                  >
                    View Services
                    <span className="ml-2">→</span>
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