import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Chuyển đổi YouTube hoặc Google Drive link sang link Embed iframe chuẩn
export function formatEmbedUrl(url: string): string {
  if (!url) return "";

  // Xử lý link Google Drive: /file/d/{FILE_ID}/view -> /file/d/{FILE_ID}/preview
  if (url.includes("drive.google.com")) {
    const driveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
      return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
    }
  }

  // Xử lý link YouTube: youtu.be/{ID} hoặc youtube.com/watch?v={ID}
  if (url.includes("youtu.be")) {
    const id = url.split("youtu.be/")[1]?.split("?")[0];
    return `https://www.youtube.com/embed/${id}`;
  }

  if (url.includes("youtube.com/watch")) {
    const match = url.match(/[?&]v=([^&]+)/);
    if (match && match[1]) {
      return `https://www.youtube.com/embed/${match[1]}`;
    }
  }

  // Đã là link embed sẵn
  return url;
}