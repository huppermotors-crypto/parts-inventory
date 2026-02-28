import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

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
  metadataBase: new URL("https://parts-inventory.onrender.com"),
  title: {
    default: "HuppeR Auto Parts - Quality Used Auto Parts",
    template: "%s | HuppeR Auto Parts",
  },
  description: "Browse quality used auto parts. Find engines, transmissions, body panels, and more at great prices.",
  openGraph: {
    type: "website",
    siteName: "HuppeR Auto Parts",
    locale: "en_US",
    images: [{ url: "/logo.png", width: 512, height: 512, alt: "HuppeR Auto Parts" }],
  },
  twitter: {
    card: "summary",
    title: "HuppeR Auto Parts",
    description: "Quality used auto parts at great prices.",
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-[family-name:var(--font-geist-sans)] antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
