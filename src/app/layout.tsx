import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Javaneh | Grow Ideas for Social Innovation",
  description:
    "Turn an early idea into a practical social innovation proposal with step-by-step guidance.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" dir="ltr">
      <body>{children}</body>
    </html>
  );
}
