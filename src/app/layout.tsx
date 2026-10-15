import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";

// Tải font Be Vietnam Pro tối ưu cho tiếng Việt
const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-be-vietnam-pro",
  display: "swap",
  preload: true,
});

// Cấu hình Viewport cho thiết bị di động
export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

// Cấu hình Metadata và PWA
export const metadata: Metadata = {
  title: "TCT study",
  description: "Học trực tuyến TCT",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.png",
    apple: "/tct-logo.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TCT study",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={beVietnamPro.variable}>
      <body className="antialiased bg-slate-50 text-slate-800 selection:bg-blue-600 selection:text-white font-sans">
        {children}
      </body>
    </html>
  );
}
