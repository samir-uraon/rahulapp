import Link from "next/link";

export default function Hero() {
  return (
    <section className="mx-auto flex max-w-7xl flex-col gap-4 px-5 pt-8 pb-5 sm:flex-row sm:items-center sm:justify-between">
      
      <div>
        <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
          What service do you need today?
        </h2>

        <p className="mt-1 text-sm text-gray-500 md:text-base">
          Choose one of the 4 service categories below to view nearby locations
        </p>
      </div>

      <Link
        href="/my-bookings"
        className="w-full rounded-xl bg-indigo-600 px-5 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-indigo-700 sm:w-auto sm:shrink-0"
      >
        My Bookings
      </Link>

    </section>
  );
}