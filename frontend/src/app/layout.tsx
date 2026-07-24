import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Conda AI",
  description: "Natural language interface for executing secure, checked SQL on PostgreSQL databases, coupled with document intelligence table parsing.",
  icons: {
    icon: "/logo/CondaAI.png",
    shortcut: "/logo/CondaAI.png",
    apple: "/logo/CondaAI.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`} suppressHydrationWarning>
        {/* Apply the saved (or system) theme before paint to avoid a flash. Placed
            as the first body child (not a manual <head>) so SSR and client render
            it identically and hydration doesn't mismatch. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
