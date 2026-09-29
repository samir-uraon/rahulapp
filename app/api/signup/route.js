import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import clientPromise from "@/lib/mongodb";
import transporter from "@/lib/mailer";

export async function POST(request) {
  try {
    const data = await request.json();

    const { name, email, phone, password } = data;

    if (!name || !email || !phone || !password) {
      return NextResponse.json(
        {
          message: "All fields are required",
        },
        {
          status: 400,
        }
      );
    }

    const client = await clientPromise;
    const db = client.db("rahul");
    const users = db.collection("users");

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await users.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return NextResponse.json(
        {
          message: "Email already registered",
        },
        {
          status: 409,
        }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const hashedOTP = await bcrypt.hash(otp, 10);

    const otpExpiresAt = new Date(
      Date.now() + 10 * 60 * 1000
    );

    const deleteAt = new Date(
      Date.now() + 60 * 60 * 1000
    );

    const result = await users.insertOne({
      name: name.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      password: hashedPassword,

      emailVerified: false,

      otp: hashedOTP,
      otpExpiresAt: otpExpiresAt,

      deleteAt: deleteAt,

      createdAt: new Date(),
    });

    await users.createIndex(
      { deleteAt: 1 },
      { expireAfterSeconds: 0 }
    );

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: normalizedEmail,
      subject: "QueueEase - Verify Your Email",
      html: `
        <div style="
          font-family: Arial, sans-serif;
          max-width: 500px;
          margin: 40px auto;
          padding: 30px;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          background: #ffffff;
        ">

          <h2 style="
            color: #4f46e5;
            text-align: center;
          ">
            QueueEase
          </h2>

          <p>
            Hello <strong>${name}</strong> 👋
          </p>

          <p>
            Thank you for creating your QueueEase account.
          </p>

          <p>
            Your email verification OTP is:
          </p>

          <div style="
            text-align: center;
            margin: 25px 0;
          ">
            <span style="
              display: inline-block;
              padding: 15px 25px;
              background: #eef2ff;
              color: #4f46e5;
              font-size: 30px;
              font-weight: bold;
              letter-spacing: 8px;
              border-radius: 12px;
            ">
              ${otp}
            </span>
          </div>

          <p style="color: #64748b;">
            This OTP will expire in 10 minutes.
          </p>

          <p style="color: #64748b;">
            Your unverified account will be automatically
            removed after 1 hour.
          </p>

          <p style="color: #64748b;">
            If you did not create this account, please ignore this email.
          </p>

          <hr style="
            border: none;
            border-top: 1px solid #e2e8f0;
            margin: 25px 0;
          ">

          <p style="
            text-align: center;
            color: #94a3b8;
            font-size: 12px;
          ">
            QueueEase — Book tokens. Save time.
          </p>

        </div>
      `,
    });

    return NextResponse.json(
      {
        message: "Signup successful. OTP sent to your email.",
        userId: result.insertedId,
      },
      {
        status: 201,
      }
    );

  } catch (error) {
    console.error("Signup error:", error);

    return NextResponse.json(
      {
        message: "Internal server error",
      },
      {
        status: 500,
      }
    );
  }
}