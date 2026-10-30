
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const runtime = "nodejs";
export const revalidate = 0;

const getLocation = (user) => ({
  name: user.locationName || "",
  type: user.locationType || "",
  latitude: user.location?.latitude ?? user.latitude ?? null,
  longitude: user.location?.longitude ?? user.longitude ?? null,
});

const getProfile = (user) => ({
  id: user._id.toString(),
  name: user.name || "",
  email: user.email || "",
  phone: user.phone || "",
  address: user.address || "",
  locationName: user.locationName || "",
  locationType: user.locationType || "",
  location: getLocation(user),
});

// =====================================================
// GET PROFILE
// GET /api/profile
// =====================================================

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    const user = await db.collection("users").findOne(
      { email: session.user.email },
      {
        projection: { password: 0 },
      }
    );

    if (!user) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { user: getProfile(user) },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("PROFILE_GET_ERROR:", error);

    return NextResponse.json(
      { message: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

// =====================================================
// UPDATE PROFILE
// PUT /api/profile
// =====================================================

export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { message: "Invalid request body" },
        { status: 400 }
      );
    }

    const has = (key) =>
      Object.prototype.hasOwnProperty.call(body, key);

    const fieldsToUpdate = {
      updatedAt: new Date(),
    };

    // Update ordinary profile fields only when provided.
    if (has("name")) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return NextResponse.json(
          { message: "Name is required" },
          { status: 400 }
        );
      }

      fieldsToUpdate.name = body.name.trim();
    }

    if (has("phone")) {
      if (typeof body.phone !== "string") {
        return NextResponse.json(
          { message: "Invalid phone number" },
          { status: 400 }
        );
      }

      const phone = body.phone.trim();

      if (phone && !/^[0-9]{10}$/.test(phone)) {
        return NextResponse.json(
          { message: "Phone number must be 10 digits" },
          { status: 400 }
        );
      }

      fieldsToUpdate.phone = phone;
    }

   

    // Save the selected address.
    if (has("address")) {
      if (typeof body.address !== "string" || !body.address.trim()) {
        return NextResponse.json(
          { message: "Address is required" },
          { status: 400 }
        );
      }

      fieldsToUpdate.address = body.address.trim();
    }

    if (has("locationName")) {
      if (typeof body.locationName !== "string") {
        return NextResponse.json(
          { message: "Invalid location name" },
          { status: 400 }
        );
      }

      fieldsToUpdate.locationName = body.locationName.trim();
    }

    if (has("locationType")) {
      const allowedTypes = ["current", "search", "manual"];

      if (!allowedTypes.includes(body.locationType)) {
        return NextResponse.json(
          { message: "Invalid location type" },
          { status: 400 }
        );
      }

      fieldsToUpdate.locationType = body.locationType;
    }

    // Save coordinates.
    if (has("location")) {
      const location = body.location;

      if (location === null) {
        fieldsToUpdate.location = {
          latitude: null,
          longitude: null,
        };
      } else {
        const latitude = location?.latitude;
        const longitude = location?.longitude;

        if (
          typeof latitude !== "number" ||
          typeof longitude !== "number" ||
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          latitude < -90 ||
          latitude > 90 ||
          longitude < -180 ||
          longitude > 180
        ) {
          return NextResponse.json(
            { message: "Valid latitude and longitude are required" },
            { status: 400 }
          );
        }

        fieldsToUpdate.location = {
          latitude,
          longitude,
        };
      }
    }

    const hasActualUpdate = Object.keys(fieldsToUpdate).some(
      (key) => key !== "updatedAt"
    );

    if (!hasActualUpdate) {
      return NextResponse.json(
        { message: "No changes provided" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);
    const users = db.collection("users");

    const result = await users.updateOne(
      { email: session.user.email },
      { $set: fieldsToUpdate }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      );
    }

    const updatedUser = await users.findOne(
      { email: session.user.email },
      { projection: { password: 0 } }
    );

    return NextResponse.json(
      {
        message: "Profile updated successfully",
        user: getProfile(updatedUser),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("PROFILE_UPDATE_ERROR:", error);

    return NextResponse.json(
      { message: "Failed to update profile" },
      { status: 500 }
    );
  }
}
