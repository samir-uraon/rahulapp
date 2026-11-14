
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const runtime = "nodejs";
export const revalidate = 0;

const ALLOWED_LOCATION_TYPES = ["current", "search", "manual"];

const jsonResponse = (data, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });

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
  webPushEnabled: Boolean(user.webPushEnabled),
});

// =====================================================
// GET PROFILE
// GET /api/profile
// =====================================================

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return jsonResponse(
        { success: false, message: "Please login to continue", code: "UNAUTHORIZED" },
        401
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    const user = await db.collection("users").findOne(
      { email: session.user.email },
      { projection: { password: 0 } }
    );

    if (!user) {
      return jsonResponse(
        { success: false, message: "User not found", code: "USER_NOT_FOUND" },
        404
      );
    }

    return jsonResponse({
      success: true,
      user: getProfile(user),
    });
  } catch (error) {
    console.error("PROFILE_GET_ERROR:", error);

    return jsonResponse(
      { success: false, message: "Unable to fetch profile. Please try again.", code: "PROFILE_FETCH_FAILED" },
      500
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
      return jsonResponse(
        { success: false, message: "Please login to continue", code: "UNAUTHORIZED" },
        401
      );
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return jsonResponse(
        { success: false, message: "Invalid request data", code: "INVALID_JSON" },
        400
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse(
        { success: false, message: "Invalid request body", code: "INVALID_BODY" },
        400
      );
    }

    const has = (key) =>
      Object.prototype.hasOwnProperty.call(body, key);

    const fieldsToUpdate = {
      updatedAt: new Date(),
    };

    // NAME
    if (has("name")) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return jsonResponse(
          { success: false, message: "Name is required", code: "INVALID_NAME" },
          400
        );
      }

      fieldsToUpdate.name = body.name.trim();
    }

    // PHONE
    if (has("phone")) {
      if (typeof body.phone !== "string") {
        return jsonResponse(
          { success: false, message: "Invalid phone number", code: "INVALID_PHONE" },
          400
        );
      }

      const phone = body.phone.trim();

      if (phone && !/^[0-9]{10}$/.test(phone)) {
        return jsonResponse(
          { success: false, message: "Phone number must contain exactly 10 digits", code: "INVALID_PHONE" },
          400
        );
      }

      fieldsToUpdate.phone = phone;
    }

    // ADDRESS
    if (has("address")) {
      if (typeof body.address !== "string" || !body.address.trim()) {
        return jsonResponse(
          { success: false, message: "Address is required", code: "INVALID_ADDRESS" },
          400
        );
      }

      fieldsToUpdate.address = body.address.trim();
    }

    // LOCATION NAME
    if (has("locationName")) {
      if (typeof body.locationName !== "string") {
        return jsonResponse(
          { success: false, message: "Invalid location name", code: "INVALID_LOCATION_NAME" },
          400
        );
      }

      fieldsToUpdate.locationName = body.locationName.trim();
    }

    // LOCATION TYPE
    if (has("locationType")) {
      if (
        typeof body.locationType !== "string" ||
        !ALLOWED_LOCATION_TYPES.includes(body.locationType)
      ) {
        return jsonResponse(
          {
            success: false,
            message: "Invalid location type. Please select your location again.",
            code: "INVALID_LOCATION_TYPE",
            allowedTypes: ALLOWED_LOCATION_TYPES,
          },
          400
        );
      }

      fieldsToUpdate.locationType = body.locationType;
    }

    // COORDINATES
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
          !location ||
          typeof location !== "object" ||
          Array.isArray(location) ||
          typeof latitude !== "number" ||
          typeof longitude !== "number" ||
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          latitude < -90 ||
          latitude > 90 ||
          longitude < -180 ||
          longitude > 180
        ) {
          return jsonResponse(
            {
              success: false,
              message: "Invalid location coordinates. Please select a valid location.",
              code: "INVALID_COORDINATES",
            },
            400
          );
        }

        fieldsToUpdate.location = {
          latitude,
          longitude,
        };
      }
    }

    // CHECK FOR CHANGES
    const hasActualUpdate = Object.keys(fieldsToUpdate).some(
      (key) => key !== "updatedAt"
    );

    if (!hasActualUpdate) {
      return jsonResponse(
        { success: false, message: "No changes provided", code: "NO_CHANGES" },
        400
      );
    }

    // DATABASE
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);
    const users = db.collection("users");

    const result = await users.updateOne(
      { email: session.user.email },
      { $set: fieldsToUpdate }
    );

    if (result.matchedCount === 0) {
      return jsonResponse(
        { success: false, message: "User not found", code: "USER_NOT_FOUND" },
        404
      );
    }

    const updatedUser = await users.findOne(
      { email: session.user.email },
      { projection: { password: 0 } }
    );

    return jsonResponse({
      success: true,
      message: "Profile updated successfully",
      user: getProfile(updatedUser),
    });

  } catch (error) {
    console.error("PROFILE_UPDATE_ERROR:", error);

    return jsonResponse(
      {
        success: false,
        message: "Unable to update profile. Please try again.",
        code: "PROFILE_UPDATE_FAILED",
      },
      500
    );
  }
}
