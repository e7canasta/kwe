import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";
import { NuqsAdapter } from "nuqs/adapters/next/app";

export const metadata: Metadata = {
  title: "Contract Drafter",
  description: "Contract drafting workspace for supplier agreements",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-screen">
      <body className={cn("min-h-full")}>
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
