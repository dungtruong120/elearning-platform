import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { quiz_id, student_id, answers } = await req.json();

    if (!quiz_id || !student_id || !answers) {
      return NextResponse.json({ error: "Thiếu dữ liệu bài làm." }, { status: 400 });
    }

    const { data: questions, error: qError } = await supabaseAdmin
      .from("quiz_questions")
      .select("id, question_text, options, correct_option, explanation, order_index")
      .eq("quiz_id", quiz_id)
      .order("order_index", { ascending: true });

    if (qError || !questions || questions.length === 0) {
      return NextResponse.json({ error: "Không tìm thấy câu hỏi của bài kiểm tra." }, { status: 404 });
    }

    let correctCount = 0;
    const totalQuestions = questions.length;

    const details = questions.map((q) => {
      const userAnswer = answers[q.id] || "";
      const isCorrect = userAnswer.toUpperCase() === q.correct_option.toUpperCase();
      if (isCorrect) correctCount++;

      return {
        question_id: q.id,
        question_text: q.question_text,
        options: q.options,
        user_answer: userAnswer,
        correct_option: q.correct_option,
        is_correct: isCorrect,
        explanation: q.explanation,
      };
    });

    const finalScore = Number(((correctCount / totalQuestions) * 10).toFixed(2));

    await supabaseAdmin.from("quiz_results").insert([
      {
        quiz_id,
        student_id,
        score: finalScore,
        total_score: 10,
        answers,
      },
    ]);

    const { data: quizInfo } = await supabaseAdmin
      .from("quizzes")
      .select("lesson_id")
      .eq("id", quiz_id)
      .single();

    if (quizInfo) {
      await supabaseAdmin.from("submissions").insert([
        {
          lesson_id: quizInfo.lesson_id,
          student_id,
          file_url: `quiz_score:${finalScore}/10`,
          status: "graded",
          score: finalScore,
        },
      ]);
    }

    return NextResponse.json({
      success: true,
      score: finalScore,
      total_score: 10,
      correct_count: correctCount,
      total_questions: totalQuestions,
      details,
    });
  } catch (error: any) {
    console.error("Lỗi chấm điểm:", error);
    return NextResponse.json({ error: error.message || "Lỗi máy chủ khi chấm điểm." }, { status: 500 });
  }
}