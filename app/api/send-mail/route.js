import { NextResponse } from "next/server";
import transporter from "@/lib/mailer";

export async function POST(request) {
  try {
    const { email, name, subject, message } = await request.json();

    if (!email || !subject || !message) {
      return NextResponse.json(
        { message: "Email, subject and message are required" },
        { status: 400 }
      );
    }

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: subject,
      html: `
        <h2>Hello ${name || "User"} 👋</h2>
        <p>${message}</p>
      `,
    });

    return NextResponse.json({
      message: "Email sent successfully",
    });
  } catch (error) {
    console.error("Email error:", error);

    return NextResponse.json(
      { message: "Failed to send email" },
      { status: 500 }
    );
  }
}