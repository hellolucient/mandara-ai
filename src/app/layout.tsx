import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: "Mandara",
  description: "Assistant, company knowledge and daily sales for Mandara Spa Maldives.",
  robots: { index: false, follow: false },
  themeColor: "#16a34a",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mandara",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${outfit.variable} ${fraunces.variable}`}>
      <head>
        {/* Browsers omit cookies on manifest fetches unless crossOrigin is set, even for a same-origin file.
            Without credentials, Cursor's app gate redirects /manifest.json to cursor.com/apps-gate/authorize,
            which the browser reports as a CORS / ERR_FAILED failure and blocks "Add to Dock" / app-window install.
            Next only adds this attribute automatically on Vercel preview deployments. */}
        <link rel="manifest" href="/manifest.json" crossOrigin="use-credentials" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
