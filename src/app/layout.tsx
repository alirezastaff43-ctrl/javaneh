import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "جوانه | پرورش ایده‌های نوآوری اجتماعی",
  description:
    "ایدهٔ اولیه‌تان را با راهنمایی گام‌به‌گام به پیشنهادی کاربردی برای نوآوری اجتماعی تبدیل کنید.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
