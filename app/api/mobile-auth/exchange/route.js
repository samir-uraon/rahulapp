import { NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import crypto from "crypto";
import clientPromise from "@/lib/mongodb";

export const runtime = "nodejs";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    if (!code || code.length > 200) {
      return NextResponse.json(
        { error: "Invalid login code." },
        { status: 400 }
      );
    }

    const codeHash = crypto
      .createHash("sha256")
      .update(code)
      .digest("hex");

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB || "rahul");

    // Atomically consume the code. It cannot be reused.
    const result = await db
      .collection("mobile_auth_codes")
      .findOneAndDelete({
        codeHash,
        expiresAt: { $gt: new Date() },
      });

    // Support both MongoDB driver v4/v5 (result.value) and v6+ (result directly)
    const record = result && "value" in result ? result.value : result;

    if (!record || !record.user?.id) {
      return NextResponse.json(
        { error: "Login code expired or already used." },
        { status: 401 }
      );
    }

    const user = record.user;
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

    if (!secret) {
      console.error("Missing AUTH_SECRET or NEXTAUTH_SECRET in environment");
      return NextResponse.json(
        { error: "Server authentication secret is not configured." },
        { status: 500 }
      );
    }

    // Create NextAuth-compatible JWT session token
    const sessionToken = await encode({
      secret,
      maxAge: SESSION_MAX_AGE,
      token: {
        sub: String(user.id),
        id: String(user.id),
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        role: user.role || "",
        location: user.location || null,
        address: user.address || null,
        latitude: user.latitude ?? null,
        longitude: user.longitude ?? null,
      },
    });

    // Ensure redirect uses HTTPS in production so cookies aren't dropped
    const redirectUrl = new URL("/", req.url);
    if (redirectUrl.protocol === "http:" && !redirectUrl.hostname.includes("localhost")) {
      redirectUrl.protocol = "https:";
    }

    const response = NextResponse.redirect(redirectUrl);

    const isSecure = redirectUrl.protocol === "https:";

    // Set NextAuth session cookie (both secure and fallback names for compatibility)
    const cookieOptions = {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    };

    if (isSecure) {
      response.cookies.set("__Secure-next-auth.session-token", sessionToken, cookieOptions);
      response.cookies.set("__Secure-authjs.session-token", sessionToken, cookieOptions);
    }

    response.cookies.set("next-auth.session-token", sessionToken, cookieOptions);
    response.cookies.set("authjs.session-token", sessionToken, cookieOptions);

    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Referrer-Policy", "no-referrer");

    return response;
  } catch (error) {
    console.error("Mobile session exchange error:", error);

    return NextResponse.json(
      { error: "Unable to establish mobile session." },
      { status: 500 }
    );
  }
}