"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export default function GoUpButton() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShow(window.scrollY > 200);
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const goToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  if (!show) return null;

  return (
<button
  type="button"
  onClick={goToTop}
  aria-label="Go to top"
  className="fixed bottom-5 right-5 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-slate-600 text-white shadow-lg transition-all duration-200 hover:scale-105 hover:bg-slate-700 active:scale-95 sm:bottom-6 sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
>
  <ArrowUp size={22} />
</button>
  );
}