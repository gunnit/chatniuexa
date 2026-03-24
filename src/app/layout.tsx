import type { Metadata } from "next";
import { Instrument_Serif, Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import { getLocale } from "next-intl/server";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ChatAziendale.it - AI Chatbots Trained on Your Data",
  description: "Deploy intelligent AI chatbots that learn from your business data and provide accurate, cited responses to your customers.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html lang={locale}>
      <body
        className={`${instrumentSerif.variable} ${plusJakarta.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
