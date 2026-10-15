"use client";

import { useEffect, useState } from "react";

export default function AppSplashScreen() {
  const [mounted, setMounted] = useState(false);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    // Giảm thời gian chờ xuống để app vào nhanh hơn, không bị giam màn hình
    const timer = setTimeout(() => {
      setFade(true);
      setTimeout(() => setMounted(true), 300);
    }, 450);

    return () => clearTimeout(timer);
  }, []);

  if (mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white transition-opacity duration-300 ease-out ${
        fade ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center select-none">
        {/* Dùng thẻ img thuần để render ngay lập tức từ bộ nhớ cache */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/tct-logo.png"
          alt="TCT Logo"
          className="w-20 h-20 rounded-2xl shadow-sm mb-4 object-contain"
        />
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-bounce"></div>
        </div>
      </div>
    </div>
  );
}
