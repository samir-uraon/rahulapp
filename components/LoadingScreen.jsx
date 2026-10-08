"use client";

export default function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="flex flex-col items-center gap-4">
        <div className="hourglass">
          <div className="hourglass-inner">
            <div className="glass top">
              <div className="sand sand-top" />
            </div>

            <div className="neck">
              <span className="sand-stream" />
            </div>

            <div className="glass bottom">
              <div className="sand sand-bottom" />
            </div>

            <div className="bar top-bar" />
            <div className="bar bottom-bar" />
          </div>
        </div>

        <p className="text-center text-sm text-gray-500">
          Loading bookings...
        </p>
      </div>
    </main>
  );
}