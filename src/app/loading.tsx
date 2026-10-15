export default function Loading() {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-white/70 backdrop-blur-sm">
      <div className="flex flex-col items-center space-y-3">
        <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-medium text-slate-500">Đang tải dữ liệu...</p>
      </div>
    </div>
  );
}
