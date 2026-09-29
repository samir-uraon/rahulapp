import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";

import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Services from "@/components/Services";
import Footer from "@/components/Footer";

export default async function HomePage() {

  // Get logged-in user's session
  const session = await getServerSession(authOptions);

  // Redirect to login if user is not authenticated
  if (!session) {
    redirect("/login");
  }

  // Get user information
  const user = session.user;

  return (
    <main className="min-h-screen bg-gray-50">

      {/* ================= HEADER ================= */}
      <Header user={user} />


      {/* ================= HERO ================= */}
      <Hero />


      {/* ================= SERVICES ================= */}
      <Services />


      {/* ================= FOOTER ================= */}
      <Footer />

    </main>
  );
}