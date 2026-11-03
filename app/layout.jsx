
import "./globals.css";
import { Toaster } from "react-hot-toast";
import Providers from "./Providers";

export const metadata = {
  title: "ZERIY | Made Simpler And Much Faster",
  description: "Made Simpler & Much Faster",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
          }}
        />

        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
