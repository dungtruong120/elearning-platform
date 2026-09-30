import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
export const metadata = {
  title: "TCT study",
  description: "Học trực tuyến TCT",
  icons: {
    icon: "/icon.png", // Dòng này sẽ ép trình duyệt lấy luôn ảnh images.png làm favicon
  },
};
// Tải font Be Vietnam Pro tối ưu cho tiếng Việt với các trọng số từ thường đến cực đậm
const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-be-vietnam-pro",
  display: "swap",
  preload: true,
});

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
