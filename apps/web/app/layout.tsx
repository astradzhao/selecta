import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "@selecta/ui/globals.css";

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Selecta",
  description: "DJ mix notes → graph → live what’s next",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fontSans.variable} ${fontMono.variable} h-full font-sans antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
