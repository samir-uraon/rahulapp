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

    // Atomically consume code so it cannot be reused
    const result = await db
      .collection("mobile_auth_codes")
      .findOneAndDelete({
        codeHash,
        expiresAt: { $gt: new Date() },
      });

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
      console.error("Missing AUTH_SECRET or NEXTAUTH_SECRET in Vercel environment variables.");
      return NextResponse.json(
        { error: "Server authentication secret is not configured." },
        { status: 500 }
      );
    }

    const tokenPayload = {
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
    };

    // CRITICAL: NextAuth requires the salt to match the cookie name!
    const secureToken = await encode({
      secret,
      maxAge: SESSION_MAX_AGE,
      token: tokenPayload,
      salt: "__Secure-next-auth.session-token",
    });

    const standardToken = await encode({
      secret,
      maxAge: SESSION_MAX_AGE,
      token: tokenPayload,
      salt: "next-auth.session-token",
    });

    const redirectUrl = new URL("/", req.url);
    if (redirectUrl.protocol === "http:" && !redirectUrl.hostname.includes("localhost")) {
      redirectUrl.protocol = "https:";
    }

    const response = NextResponse.redirect(redirectUrl);

    // Set cookies with matching names and salts
    response.cookies.set("__Secure-next-auth.session-token", secureToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });

    response.cookies.set("next-auth.session-token", standardToken, {
      httpOnly: true,
      secure: redirectUrl.protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });

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