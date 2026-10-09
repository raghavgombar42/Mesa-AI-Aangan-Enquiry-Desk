import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/Nav";
import { passwordEnabled } from "@/lib/auth";
import { logoutAction } from "./actions";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Aangan Enquiry Desk",
  description: "Every call answered, qualified against Nikhil's rules, handed to a designer, and counted",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans text-sm">
        <Nav
          logout={
            passwordEnabled() && (
              <form action={logoutAction}>
                <button className="whitespace-nowrap text-stone-500 hover:text-stone-900">Log out</button>
              </form>
            )
          }
        />
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
