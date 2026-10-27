import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Geist_Mono, Playfair_Display } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Nội dung: Be Vietnam Pro (thiết kế cho tiếng Việt, dễ đọc trên điện thoại).
const sans = Be_Vietnam_Pro({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

// Tiêu đề: Playfair Display – font có chân, gợi cảm giác di sản cố đô.
const display = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700"],
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HueTrip",
  description: "Khám phá Huế trên bản đồ và lập lịch trình du lịch",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#5b2a86",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${sans.variable} ${display.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full bg-muted">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
