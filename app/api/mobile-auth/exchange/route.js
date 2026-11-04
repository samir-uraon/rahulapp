
import { NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import crypto from "crypto";
import clientPromise from "@/lib/mongodb";

export const runtime = "nodejs";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

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

    const record = result?.value ?? result;

    if (!record || !record.user?.id) {
      return NextResponse.json(
        { error: "Login code expired or already used." },
        { status: 401 }
      );
    }

    const user = record.user;

    // Create a NextAuth-compatible JWT session token
    const sessionToken = await encode({
      secret: process.env.AUTH_SECRET,
      maxAge: SESSION_MAX_AGE,
      token: {
  sub: user.id,
  id: user.id,
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

    // Redirect the WebView to the website after setting its session cookie
    const response = NextResponse.redirect(
      new URL("/", req.url)
    );

    response.cookies.set(
      "__Secure-next-auth.session-token",
      sessionToken,
      {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE,
      }
    );

    response.headers.set("Cache-Control", "no-store");
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
