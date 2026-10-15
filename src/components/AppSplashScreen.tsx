"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function AppSplashScreen() {
  const [mounted, setMounted] = useState(false);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    // Hiển thị logo chờ trong 600ms để app tải dữ liệu ngầm
    const timer = setTimeout(() => {
      setFade(true);
      setTimeout(() => setMounted(true), 400); // Ẩn hoàn toàn component sau khi mờ dần
    }, 600);

    return () => clearTimeout(timer);
  }, []);

  if (mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-white transition-opacity duration-300 ease-out ${
        fade ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center select-none">
        <Image
          src="/tct-logo.png"
          alt="TCT Logo"
          width={88}
          height={88}
          className="rounded-2xl shadow-sm mb-4 object-contain"
          priority
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
