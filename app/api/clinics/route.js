
import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    const clinicsCollection = db.collection("clinics");
    const bookingsCollection = db.collection("bookings");

    const [clinics, bookings] = await Promise.all([
      clinicsCollection
        .find({})
        .project({ _id: 0 })
        .toArray(),

      bookingsCollection
        .find({})
        .sort({ createdAt: -1 })
        .toArray(),
    ]);

    const bookingsByDoctor = new Map();

    for (const booking of bookings) {
      const key = `${booking.clinicId}::${booking.doctorId}`;

      if (!bookingsByDoctor.has(key)) {
        bookingsByDoctor.set(key, []);
      }

      bookingsByDoctor.get(key).push(booking);
    }

    const updatedClinics = clinics.map((clinic) => ({
      ...clinic,
      doctors: (clinic.doctors || []).map((doctor) => {
        const key = `${clinic.id}::${doctor.id}`;

        return {
          ...doctor,
          bookings: bookingsByDoctor.get(key) || [],
        };
      }),
    }));

   
    

    return NextResponse.json(
      {
        success: true,
        clinics: updatedClinics,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("GET /api/clinics error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch clinics",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
