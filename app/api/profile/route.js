
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const runtime = "nodejs";
export const revalidate = 0;

const ALLOWED_LOCATION_TYPES = [
  "current",
  "search",
  "manual",
];

function validCoordinates(latitude, longitude) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function getLocation(user) {
  return {
    name: user.locationName || "",
    type: user.locationType || "",
    latitude:
      user.location?.latitude ??
      user.latitude ??
      null,
    longitude:
      user.location?.longitude ??
      user.longitude ??
      null,
  };
}

function getProfile(user) {
  return {
    name: user.name || "",
    email: user.email || "",
    phone: user.phone || "",
    address: user.address || "",
    locationName: user.locationName || "",
    locationType: user.locationType || "",
    location: getLocation(user),
    city: user.city || "",
    state: user.state || "",
    pinCode: user.pinCode || "",
    webPushEnabled: Boolean(user.webPushEnabled),
    expoPushEnabled: Boolean(user.expoPushEnabled),
  };
}

// =====================================================
// GET PROFILE
// =====================================================

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const client = await clientPromise;
    const db = client.db("rahul");

    const user = await db.collection("users").findOne(
      { email: session.user.email },
      {
        projection: {
          password: 0,
          otp: 0,
          resetToken: 0,
        },
      }
    );

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        user: getProfile(user),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("GET_PROFILE_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch profile",
      },
      { status: 500 }
    );
  }
}

// =====================================================
// UPDATE PROFILE
// =====================================================

export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const client = await clientPromise;
    const db = client.db("rahul");

    const users = db.collection("users");

    const user = await users.findOne({
      email: session.user.email,
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    const updateData = {};

    // -------------------------------------------------
    // BASIC PROFILE FIELDS
    // -------------------------------------------------

    if (body.name !== undefined) {
      if (
        typeof body.name !== "string" ||
        !body.name.trim()
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid name",
          },
          { status: 400 }
        );
      }

      updateData.name = body.name.trim();
    }

    if (body.phone !== undefined) {
      if (typeof body.phone !== "string") {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid phone number",
          },
          { status: 400 }
        );
      }

      updateData.phone = body.phone.trim();
    }

    // -------------------------------------------------
    // LOCATION ADDRESS
    // -------------------------------------------------

    if (body.address !== undefined) {
      if (
        typeof body.address !== "string" ||
        !body.address.trim()
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid location address",
          },
          { status: 400 }
        );
      }

      updateData.address = body.address.trim();
    }

    if (body.locationName !== undefined) {
      if (typeof body.locationName !== "string") {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid location name",
          },
          { status: 400 }
        );
      }

      updateData.locationName = body.locationName.trim();
    }

    // -------------------------------------------------
    // LOCATION TYPE
    // -------------------------------------------------

    if (body.locationType !== undefined) {
      const locationType =
        body.locationType === "gps"
          ? "current"
          : body.locationType;

      if (
        !ALLOWED_LOCATION_TYPES.includes(locationType)
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid location type",
          },
          { status: 400 }
        );
      }

      updateData.locationType = locationType;
    }

    // -------------------------------------------------
    // LOCATION COORDINATES
    // -------------------------------------------------

    if (body.location !== undefined) {
      if (body.location === null) {
        updateData.location = null;
      } else {
        if (
          typeof body.location !== "object" ||
          Array.isArray(body.location)
        ) {
          return NextResponse.json(
            {
              success: false,
              message: "Invalid location data",
            },
            { status: 400 }
          );
        }

        const latitude = Number(body.location.latitude);
        const longitude = Number(body.location.longitude);

        if (!validCoordinates(latitude, longitude)) {
          return NextResponse.json(
            {
              success: false,
              message: "Invalid location coordinates",
            },
            { status: 400 }
          );
        }

        updateData.location = {
          latitude,
          longitude,
        };
      }
    }

    // Current location requires coordinates.
    const finalLocationType =
      updateData.locationType ?? user.locationType;

    const finalLocation =
      updateData.location !== undefined
        ? updateData.location
        : user.location;

    if (
      finalLocationType === "current" &&
      (
        !finalLocation ||
        !validCoordinates(
          Number(finalLocation.latitude),
          Number(finalLocation.longitude)
        )
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Current location requires valid GPS coordinates",
        },
        { status: 400 }
      );
    }

    // -------------------------------------------------
    // CITY, STATE AND PIN CODE
    // -------------------------------------------------

    if (body.city !== undefined) {
      if (typeof body.city !== "string") {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid city",
          },
          { status: 400 }
        );
      }

      updateData.city = body.city.trim();
    }

    if (body.state !== undefined) {
      if (typeof body.state !== "string") {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid state",
          },
          { status: 400 }
        );
      }

      updateData.state = body.state.trim();
    }

    if (body.pinCode !== undefined) {
      if (
        typeof body.pinCode !== "string" &&
        typeof body.pinCode !== "number"
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid pin code",
          },
          { status: 400 }
        );
      }

      updateData.pinCode = String(body.pinCode).trim();
    }

    // -------------------------------------------------
    // SAVE TO MONGODB
    // -------------------------------------------------

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "No valid fields provided",
        },
        { status: 400 }
      );
    }

    await users.updateOne(
      { email: session.user.email },
      {
        $set: {
          ...updateData,
          updatedAt: new Date(),
        },
      }
    );

    const updatedUser = await users.findOne(
      { email: session.user.email },
      {
        projection: {
          password: 0,
          otp: 0,
          resetToken: 0,
        },
      }
    );

    return NextResponse.json(
      {
        success: true,
        message: "Profile updated successfully",
        user: getProfile(updatedUser),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("UPDATE_PROFILE_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update profile",
      },
      { status: 500 }
    );
  }
}
