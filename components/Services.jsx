import ServiceCard from "./ServiceCard";

export default function Services() {
  const services = [
    {
      href: "/services/saloons",
      icon: "✂️",
      title: "Saloon",
     
      description:
        "Haircuts, beard grooming, head massage & men styling",
      actionText: "View Services (5 Shops)",
      iconBg: "bg-amber-50",
      badgeBg: "bg-blue-50",
      badgeText: "text-blue-600 border-blue-200",
    },

    {
      href: "/services/parlours",
      icon: "💄",
      title: "Parlour",
      
      description:
        "Facial, threading, waxing, hair spa & bridal care",
      actionText: "View Services (4 Parlours)",
      iconBg: "bg-pink-50",
      badgeBg: "bg-pink-50",
      badgeText: "text-pink-600 border-pink-200",
    },

    {
      href: "/services/clinics",
      icon: "🩺",
      title: "Clinic",
      badge: "DOCTORS",
      description:
        "Dental, Pediatric (Child), General OPD & Skin specialists",
      actionText: "View Doctor (5 Clinics)",
      iconBg: "bg-blue-50",
      badgeBg: "bg-emerald-50",
      badgeText: "text-emerald-600 border-emerald-200",
    },

    {
      href: "/services/diagnostic-centre",
      icon: "🧪",
      title: "Diagnostic Centre",
      badge: "PATHOLOGY",
      description:
        "Blood tests, Thyroid, Full Body checkups & Lab Doctors",
      actionText: "View Doctor (4 Labs)",
      iconBg: "bg-emerald-50",
      badgeBg: "bg-indigo-50",
      badgeText: "text-indigo-600 border-indigo-200",
    },
  ];

  return (
    <section className="max-w-7xl mx-auto px-5 pb-10">

      <div className="flex flex-col gap-4">

        {services.map((service) => (
          <ServiceCard
            key={service.href}
            href={service.href}
            icon={service.icon}
            title={service.title}
            badge={service.badge}
            description={service.description}
            actionText={service.actionText}
            iconBg={service.iconBg}
            badgeBg={service.badgeBg}
            badgeText={service.badgeText}
          />
        ))}

      </div>

    </section>
  );
}