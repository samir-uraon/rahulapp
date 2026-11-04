import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import crypto from "crypto";
import clientPromise from "@/lib/mongodb";

export const runtime = "nodejs";

const APP_CALLBACK = "zeriy:///auth/callback";

export async function GET(req) {
  try {
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

    // Read the authenticated NextAuth session from the browser cookie
    const token = await getToken({
      req,
      secret,
    });

    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated. Please sign in again." },
        { status: 401 }
      );
    }

    const userId = token.id || token.sub;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID missing from session." },
        { status: 401 }
      );
    }

    // Generate a random, one-time code
    const code = crypto.randomBytes(32).toString("base64url");

    // Store only the SHA-256 hash
    const codeHash = crypto
      .createHash("sha256")
      .update(code)
      .digest("hex");

    const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes expiry

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB || "rahul");

    await db.collection("mobile_auth_codes").insertOne({
      codeHash,
      user: {
        id: String(userId),
        name: token.name || "",
        email: token.email || "",
        phone: token.phone || "",
        role: token.role || "",
        location: token.location || null,
        address: token.address || null,
        latitude: token.latitude ?? null,
        longitude: token.longitude ?? null,
      },
      expiresAt,
      createdAt: new Date(),
    });

    // Return to the mobile app with the temporary code
    const callbackUrl = new URL(APP_CALLBACK);
    callbackUrl.searchParams.set("code", code);

    const response = NextResponse.redirect(callbackUrl);

    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Referrer-Policy", "no-referrer");

    return response;
  } catch (error) {
    console.error("Mobile authentication completion error:", error);

    return NextResponse.json(
      { error: "Unable to complete mobile authentication." },
      { status: 500 }
    );
  }
}