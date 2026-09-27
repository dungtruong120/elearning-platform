import { createClient } from "@supabase/supabase-js";

// Điền trực tiếp giá trị thật của dự án bạn
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nxfohdszxiwurbyihgyg.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54Zm9oZHN6eGl3dXJieWloZ3lnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2NjE4ODAsImV4cCI6MjEwNTIzNzg4MH0.twd7dEiV3-tpQP17HZ1LQ_AI0lq2OKopsLRAoOgSQC0";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
