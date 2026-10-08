
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";

import LocationManager from "@/components/LocationManager";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Services from "@/components/Services";
import Footer from "@/components/Footer";
import GoUpButton from "@/components/GoUpButton";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const user = session.user;

  return (
    <main className="min-h-screen bg-gray-50">

      <Header user={user} />

      <Hero />

      <Services />

      <Footer />

      <LocationManager />
      <GoUpButton/>

    </main>
  );
}

