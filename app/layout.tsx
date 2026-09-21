import type { Metadata } from "next";
import { Geist, Geist_Mono,Nunito, Montserrat } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});


const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hotel Suite | Reservation System",
  description: "Hotel booking, inventory management, check-in, QR ordering, and live navigation dashboard.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${montserrat.variable} ${nunito.variable} ${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
