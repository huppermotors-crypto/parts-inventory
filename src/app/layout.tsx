import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { PageViewTracker } from "@/components/analytics/page-view-tracker";
import { ChatWidget } from "@/components/chat/chat-widget";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: {
    default: "HuppeR Auto Parts - Quality Used Auto Parts",
    template: "%s | HuppeR Auto Parts",
  },
  description: "Browse quality used auto parts. Find engines, transmissions, body panels, and more at great prices.",
  openGraph: {
    type: "website",
    siteName: "HuppeR Auto Parts",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-[family-name:var(--font-geist-sans)] antialiased`}
      >
        {children}
        <PageViewTracker />
        <ChatWidget />
        <Toaster />
      </body>
    </html>
  );
}
