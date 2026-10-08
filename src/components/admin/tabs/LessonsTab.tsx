'use client';

import React, { useState, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Upload, 
  FileText, 
  CheckCircle2, 
  ChevronRight, 
  ChevronDown, 
  BookOpen, 
  HelpCircle, 
  FolderPlus,
  Video,
  X,
  Layers,
  Save,
  Clock,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamic import AzotaExamConfigModal để tránh SSR issues
const AzotaExamConfigModal = dynamic(
  () => import('@/app/admin/AzotaExamConfigModal'),
  { ssr: false }
);

export interface LessonAssignment {
  id: string;
  title: string;
  type?: 'btvn' | 'test' | 'exam';
  duration?: number;
  totalQuestions?: number;
  data?: any;
  questions?: any[];
  config?: any;
  createdAt?: string;
}

export interface Lesson {
  id: string;
  title: string;
  videoUrl?: string;
  duration?: string;
  notes?: string;
  assignments?: LessonAssignment[];
  homework?: any[]; // Dự phòng cho cấu trúc cũ
}

export interface Chapter {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface LessonsTabProps {
  chapters: Chapter[];
  setChapters?: React.Dispatch<React.SetStateAction<Chapter[]>> | ((newChapters: Chapter[]) => void);
  onUpdateChapters?: (newChapters: Chapter[]) => void;
  selectedCourseId?: string;
  supabase?: any;
  showNotification?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export default function LessonsTab({
  chapters = [],
  setChapters,
  onUpdateChapters,
  selectedCourseId,
  supabase,
  showNotification
}: LessonsTabProps) {
  // State quản lý việc mở/đóng chương
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({
    [chapters[0]?.id || '']: true
  });

  // State Modal chỉnh sửa bài học / thêm bài học
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonVideoUrl, setLessonVideoUrl] = useState('');
  const [lessonDuration, setLessonDuration] = useState('');

  // State Modal Azota
  const [isAzotaModalOpen, setIsAzotaModalOpen] = useState(false);
  const [activeTargetLesson, setActiveTargetLesson] = useState<{ chapterId: string; lessonId: string } | null>(null);
  const [activeTargetType, setActiveTargetType] = useState<'btvn' | 'test'>('btvn');
  const [activeTestFile, setActiveTestFile] = useState<File | null>(null);

  // Hidden File Input để nạp file đề trước khi mở Azota Modal
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Thông báo tiện ích nội bộ nếu cha không truyền hàm notification
  const notify = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (typeof showNotification === 'function') {
      showNotification(msg, type);
    } else {
      if (type === 'error') {
        console.error(msg);
        alert(`❌ ${msg}`);
      } else {
        console.log(msg);
        alert(`✅ ${msg}`);
      }
    }
  };

  // Toggle thu gọn/mở rộng chương
  const toggleChapter = (chapterId: string) => {
    setExpandedChapters(prev => ({
      ...prev,
      [chapterId]: !prev[chapterId]
    }));
  };

  // Cập nhật State Cha và Lưu vào LocalStorage/Supabase
  const syncChapters = async (updatedChapters: Chapter[]) => {
    console.log('[LessonsTab] Đang đồng bộ chapters:', updatedChapters);

    // 1. Cập nhật state cha tức thì
    if (typeof setChapters === 'function') {
      try {
        (setChapters as any)(updatedChapters);
      } catch (err) {
        console.error('[LessonsTab] Lỗi khi gọi setChapters:', err);
      }
    }

    if (typeof onUpdateChapters === 'function') {
      try {
        onUpdateChapters(updatedChapters);
      } catch (err) {
        console.error('[LessonsTab] Lỗi khi gọi onUpdateChapters:', err);
      }
    }

    // 2. Lưu vào LocalStorage
    try {
      if (selectedCourseId) {
        localStorage.setItem(`course_chapters_${selectedCourseId}`, JSON.stringify(updatedChapters));
      }
      localStorage.setItem('admin_latest_chapters', JSON.stringify(updatedChapters));
    } catch (e) {
      console.warn('[LessonsTab] Không thể ghi vào localStorage:', e);
    }

    // 3. Đồng bộ Supabase nếu có
    if (supabase && selectedCourseId) {
      try {
        const { error } = await supabase
          .from('courses')
          .update({ chapters: updatedChapters, updated_at: new Date().toISOString() })
          .eq('id', selectedCourseId);

        if (error) {
          console.error('[LessonsTab] Supabase update error:', error);
        } else {
          console.log('[LessonsTab] Đã đồng bộ lên Supabase thành công');
        }
      } catch (dbErr) {
        console.error('[LessonsTab] Lỗi ngoại lệ khi đẩy Supabase:', dbErr);
      }
    }
  };

  // Thêm chương mới
  const handleAddChapter = () => {
    const newChapterTitle = prompt('Nhập tên chương mới:');
    if (!newChapterTitle?.trim()) return;

    const newChapter: Chapter = {
      id: `chapter_${Date.now()}`,
      title: newChapterTitle.trim(),
      lessons: []
    };

    const nextChapters = [...chapters, newChapter];
    setExpandedChapters(prev => ({ ...prev, [newChapter.id]: true }));
    syncChapters(nextChapters);
    notify(`Đã tạo chương: "${newChapter.title}"`);
  };

  // Đổi tên chương
  const handleEditChapter = (chapter: Chapter) => {
    const updatedTitle = prompt('Đổi tên chương:', chapter.title);
    if (!updatedTitle?.trim() || updatedTitle.trim() === chapter.title) return;

    const nextChapters = chapters.map(c => 
      c.id === chapter.id ? { ...c, title: updatedTitle.trim() } : c
    );
    syncChapters(nextChapters);
  };

  // Xóa chương
  const handleDeleteChapter = (chapterId: string) => {
    if (!confirm('Bạn có chắc muốn xóa toàn bộ chương này và tất cả bài học bên trong?')) return;
    const nextChapters = chapters.filter(c => c.id !== chapterId);
    syncChapters(nextChapters);
    notify('Đã xóa chương thành công');
  };

  // Mở modal tạo/sửa bài học
  const handleOpenLessonModal = (chapterId: string, lesson?: Lesson) => {
    setActiveChapterId(chapterId);
    if (lesson) {
      setEditingLesson(lesson);
      setLessonTitle(lesson.title);
      setLessonVideoUrl(lesson.videoUrl || '');
      setLessonDuration(lesson.duration || '');
    } else {
      setEditingLesson(null);
      setLessonTitle('');
      setLessonVideoUrl('');
      setLessonDuration('');
    }
    setIsLessonModalOpen(true);
  };

  // Lưu bài học từ Modal chi tiết
  const handleSaveLesson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChapterId || !lessonTitle.trim()) {
      notify('Vui lòng nhập tên bài học!', 'error');
      return;
    }

    const nextChapters = chapters.map(chap => {
      if (chap.id !== activeChapterId) return chap;

      if (editingLesson) {
        // Chế độ sửa
        return {
          ...chap,
          lessons: chap.lessons.map(l => 
            l.id === editingLesson.id 
              ? { ...l, title: lessonTitle.trim(), videoUrl: lessonVideoUrl.trim(), duration: lessonDuration.trim() }
              : l
          )
        };
      } else {
        // Chế độ thêm mới
        const newLesson: Lesson = {
          id: `lesson_${Date.now()}`,
          title: lessonTitle.trim(),
          videoUrl: lessonVideoUrl.trim(),
          duration: lessonDuration.trim(),
          assignments: []
        };
        return {
          ...chap,
          lessons: [...chap.lessons, newLesson]
        };
      }
    });

    syncChapters(nextChapters);
    setIsLessonModalOpen(false);
    notify(editingLesson ? 'Đã cập nhật bài học' : 'Đã thêm bài học mới');
  };

  // Xóa bài học
  const handleDeleteLesson = (chapterId: string, lessonId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa bài học này?')) return;

    const nextChapters = chapters.map(chap => {
      if (chap.id !== chapterId) return chap;
      return {
        ...chap,
        lessons: chap.lessons.filter(l => l.id !== lessonId)
      };
    });

    syncChapters(nextChapters);
    notify('Đã xóa bài học');
  };

  // Kích hoạt nạp đề từ ô bài tập (BTVN hoặc Thi thử)
  const handleTriggerUploadExam = (chapterId: string, lessonId: string, type: 'btvn' | 'test') => {
    setActiveTargetLesson({ chapterId, lessonId });
    setActiveTargetType(type);
    
    // Kích hoạt input file
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Bắt file đề sau khi chọn xong
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Kiểm tra định dạng
    const validExtensions = ['.docx', '.pdf', '.txt'];
    const hasValidExt = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      notify('Hệ thống chỉ hỗ trợ định dạng .docx, .pdf hoặc .txt', 'error');
      return;
    }

    setActiveTestFile(file);
    setIsAzotaModalOpen(true);
  };

  /**
   * XỬ LÝ LƯU ĐỀ THI TỪ AZOTA MODAL VÀO BÀI HỌC
   * Nhận callback đa hình từ AzotaExamConfigModal và cập nhật tức thời
   */
  const handleSaveExamFromAzota = (payload: any) => {
    console.log('[LessonsTab] 👉 Nhận callback từ AzotaExamConfigModal:', payload);

    if (!activeTargetLesson) {
      console.error('[LessonsTab] Không tìm thấy thông tin bài học mục tiêu');
      setIsAzotaModalOpen(false);
      return;
    }

    const { chapterId, lessonId } = activeTargetLesson;

    // Chuẩn hóa dữ liệu đề thi từ payload
    const examData = payload?.examData || payload?.data || payload;
    const questions = payload?.questions || examData?.questions || [];
    const config = payload?.config || examData?.config || {};
    const title = payload?.title || examData?.title || activeTestFile?.name?.replace(/\.[^/.]+$/, '') || 'Đề thi trắc nghiệm';
    const totalQuestions = questions.length || examData?.totalQuestions || 0;
    const duration = config?.duration || examData?.duration || 45;

    const newAssignment: LessonAssignment = {
      id: `exam_${Date.now()}`,
      title: title,
      type: activeTargetType,
      duration: Number(duration),
      totalQuestions: totalQuestions,
      questions: questions,
      config: config,
      data: examData,
      createdAt: new Date().toISOString()
    };

    console.log('[LessonsTab] Chuẩn bị chèn Assignment vào bài học:', newAssignment);

    // Tính toán chapters mới
    const updatedChapters = chapters.map(chap => {
      if (chap.id !== chapterId) return chap;

      return {
        ...chap,
        lessons: chap.lessons.map(lesson => {
          if (lesson.id !== lessonId) return lesson;

          const currentAssignments = Array.isArray(lesson.assignments) ? lesson.assignments : [];
          
          // Thêm assignment mới vào danh sách
          const nextAssignments = [...currentAssignments, newAssignment];

          return {
            ...lesson,
            assignments: nextAssignments,
            homework: nextAssignments // Giữ tương thích ngược
          };
        })
      };
    });

    // 1. Thực hiện đồng bộ lập tức lên state cha & storage
    syncChapters(updatedChapters);

    // 2. Đóng Modal và giải phóng file
    setIsAzotaModalOpen(false);
    setActiveTestFile(null);
    setActiveTargetLesson(null);

    // 3. Thông báo trực quan
    const typeLabel = activeTargetType === 'btvn' ? 'Bài tập về nhà (BTVN)' : 'Đề kiểm tra/Thi thử';
    notify(`Đã xuất bản & gắn ${typeLabel} (${totalQuestions} câu) vào bài học thành công!`);
  };

  // Đếm số lượng bài tập theo phân loại
  const getAssignmentCount = (lesson: Lesson, type: 'btvn' | 'test') => {
    const list = lesson.assignments || lesson.homework || [];
    return list.filter((item: any) => (item.type || 'btvn') === type).length;
  };

  return (
    <div className="space-y-6">
      {/* Input File Ẩn để chọn đề thi */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".docx,.pdf,.txt"
        className="hidden"
      />

      {/* Header Hành Động */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            Khung Chương Trình & Bài Học
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Quản lý các chương, danh sách video bài giảng, gắn BTVN và đề thi trắc nghiệm.
          </p>
        </div>

        <button
          onClick={handleAddChapter}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm"
        >
          <FolderPlus className="w-4 h-4" />
          Thêm Chương Mới
        </button>
      </div>

      {/* Danh sách chương và bài học */}
      {chapters.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Chưa có chương học nào trong khóa này.</p>
          <button
            onClick={handleAddChapter}
            className="mt-4 text-sm font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mx-auto"
          >
            <Plus className="w-4 h-4" /> Bấm vào đây để tạo chương đầu tiên
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {chapters.map((chapter, chapterIndex) => {
            const isExpanded = !!expandedChapters[chapter.id];

            return (
              <div 
                key={chapter.id} 
                className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm transition hover:border-gray-300"
              >
                {/* Header của Chương */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50/80 border-b border-gray-100">
                  <div 
                    onClick={() => toggleChapter(chapter.id)}
                    className="flex items-center gap-3 cursor-pointer flex-1 select-none"
                  >
                    <span className="text-gray-400 hover:text-gray-600">
                      {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </span>
                    <span className="font-semibold text-gray-800 text-sm md:text-base flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                        {chapterIndex + 1}
                      </span>
                      {chapter.title}
                    </span>
                    <span className="text-xs bg-gray-200/80 text-gray-600 px-2 py-0.5 rounded-full font-medium ml-2">
                      {chapter.lessons?.length || 0} bài học
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenLessonModal(chapter.id)}
                      className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition text-xs flex items-center gap-1 font-medium mr-2"
                      title="Thêm bài học vào chương này"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="hidden sm:inline">Thêm bài</span>
                    </button>
                    <button
                      onClick={() => handleEditChapter(chapter)}
                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 rounded-md transition"
                      title="Đổi tên chương"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteChapter(chapter.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-md transition"
                      title="Xóa chương"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Nội dung danh sách bài học */}
                {isExpanded && (
                  <div className="divide-y divide-gray-100">
                    {chapter.lessons?.length === 0 ? (
                      <div className="py-8 text-center text-gray-400 text-sm">
                        Chưa có bài học trong chương này.
                        <button
                          onClick={() => handleOpenLessonModal(chapter.id)}
                          className="text-indigo-600 font-semibold ml-2 hover:underline"
                        >
                          + Thêm ngay
                        </button>
                      </div>
                    ) : (
                      chapter.lessons.map((lesson, lessonIndex) => {
                        const btvnCount = getAssignmentCount(lesson, 'btvn');
                        const testCount = getAssignmentCount(lesson, 'test');

                        return (
                          <div
                            key={lesson.id}
                            className="flex flex-col md:flex-row md:items-center justify-between p-3.5 hover:bg-slate-50/70 transition gap-3"
                          >
                            {/* Thông tin bài học */}
                            <div className="flex items-start gap-3 min-w-0">
                              <span className="text-xs font-mono text-gray-400 mt-1 min-w-[24px]">
                                {chapterIndex + 1}.{lessonIndex + 1}
                              </span>
                              <div className="min-w-0">
                                <h4 className="text-sm font-semibold text-gray-800 truncate flex items-center gap-2">
                                  {lesson.title}
                                  {lesson.videoUrl && (
                                    <span className="text-emerald-600 bg-emerald-50 text-[10px] px-1.5 py-0.5 rounded font-normal flex items-center gap-1 border border-emerald-200">
                                      <Video className="w-3 h-3" /> Video
                                    </span>
                                  )}
                                </h4>
                                {lesson.duration && (
                                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                    <Clock className="w-3 h-3" /> {lesson.duration}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Các ô Quản lý BTVN và Đề Kiểm Tra (Các ô Cell chuyển số) */}
                            <div className="flex items-center gap-2 flex-wrap self-end md:self-center">
                              {/* Ô Nạp BTVN */}
                              <button
                                onClick={() => handleTriggerUploadExam(chapter.id, lesson.id, 'btvn')}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition ${
                                  btvnCount > 0
                                    ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 shadow-sm'
                                    : 'bg-white text-gray-500 border-dashed border-gray-300 hover:border-blue-400 hover:text-blue-600'
                                }`}
                                title="Bấm để tải file đề làm Bài tập về nhà"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>BTVN:</span>
                                <span className={`font-bold px-1.5 py-0.2 rounded-full text-[11px] ${
                                  btvnCount > 0 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {btvnCount > 0 ? btvnCount : '+'}
                                </span>
                              </button>

                              {/* Ô Nạp Đề Thi Thử */}
                              <button
                                onClick={() => handleTriggerUploadExam(chapter.id, lesson.id, 'test')}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition ${
                                  testCount > 0
                                    ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 shadow-sm'
                                    : 'bg-white text-gray-500 border-dashed border-gray-300 hover:border-amber-400 hover:text-amber-600'
                                }`}
                                title="Bấm để tải file đề làm Đề thi thử"
                              >
                                <HelpCircle className="w-3.5 h-3.5" />
                                <span>Đề thi:</span>
                                <span className={`font-bold px-1.5 py-0.2 rounded-full text-[11px] ${
                                  testCount > 0 ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {testCount > 0 ? testCount : '+'}
                                </span>
                              </button>

                              {/* Chỉnh sửa & Xóa bài học */}
                              <div className="flex items-center gap-1 border-l pl-2 border-gray-200 ml-1">
                                <button
                                  onClick={() => handleOpenLessonModal(chapter.id, lesson)}
                                  className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 rounded"
                                  title="Chỉnh sửa chi tiết bài học"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteLesson(chapter.id, lesson.id)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded"
                                  title="Xóa bài học"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL THÊM / SỬA BÀI HỌC */}
      {isLessonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setIsLessonModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              {editingLesson ? 'Chỉnh Sửa Bài Học' : 'Thêm Bài Học Mới'}
            </h3>

            <form onSubmit={handleSaveLesson} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Tên bài học <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Bài 01: Sự đồng biến, nghịch biến của hàm số"
                  value={lessonTitle}
                  onChange={e => setLessonTitle(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  URL Video bài giảng (YouTube, Vimeo, Cloudinary...)
                </label>
                <input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={lessonVideoUrl}
                  onChange={e => setLessonVideoUrl(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Thời lượng bài học
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: 45 phút"
                  value={lessonDuration}
                  onChange={e => setLessonDuration(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLessonModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow"
                >
                  <Save className="w-3.5 h-3.5" />
                  {editingLesson ? 'Cập nhật bài học' : 'Tạo bài học'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AZOTA EXAM CONFIG MODAL (Đã bảo đảm bắt mọi alias callback: onSave, onSaveExam, onSuccess, onComplete) */}
      {isAzotaModalOpen && activeTestFile && (
        <AzotaExamConfigModal
          isOpen={isAzotaModalOpen}
          file={activeTestFile}
          mode="course"
          targetType={activeTargetType}
          onClose={() => {
            setIsAzotaModalOpen(false);
            setActiveTestFile(null);
            setActiveTargetLesson(null);
          }}
          onSave={handleSaveExamFromAzota}
          onSaveExam={handleSaveExamFromAzota}
          onSuccess={handleSaveExamFromAzota}
          onComplete={handleSaveExamFromAzota}
        />
      )}
    </div>
  );
}
