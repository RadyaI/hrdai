"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import toast, { Toaster } from "react-hot-toast";
import ThemeToggle from "@/components/ThemeToggle";

type CategoryScore = {
  score: number;   
  note: string;    
};

type FeedbackData = {
  company: string;
  field: string;
  level: string;
  score: number;
  verdict: string;
  summary: string;
  categories: {
    komunikasi: CategoryScore;
    technical: CategoryScore;
    confidence: CategoryScore;
    relevance: CategoryScore;
  };
  strengths: string[];
  improvements: string[];
  tips: string;
  createdAt: any;
};

// Helper buat class Tailwind berdasarkan skor
function getScoreTheme(s: number) {
  if (s >= 80) return {
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    border: "border-emerald-200 dark:border-emerald-500/20",
    bar: "bg-emerald-500 dark:bg-emerald-400"
  };
  if (s >= 60) return {
    text: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-500/10",
    border: "border-blue-200 dark:border-blue-500/20",
    bar: "bg-blue-500 dark:bg-blue-400"
  };
  if (s >= 40) return {
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-500/10",
    border: "border-amber-200 dark:border-amber-500/20",
    bar: "bg-amber-500 dark:bg-amber-400"
  };
  return {
    text: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-500/10",
    border: "border-red-200 dark:border-red-500/20",
    bar: "bg-red-500 dark:bg-red-400"
  };
}

const CATEGORY_META: Record<string, { label: string; icon: string; desc: string }> = {
  komunikasi: { label: "Komunikasi", icon: "💬", desc: "Kejelasan & cara penyampaian" },
  technical:  { label: "Technical",  icon: "⚙️", desc: "Pemahaman skill teknis" },
  confidence: { label: "Confidence", icon: "🎯", desc: "Keyakinan & ketegasan jawaban" },
  relevance:  { label: "Relevance",  icon: "🎯", desc: "Jawaban nyambung sama pertanyaan" },
};

export default function HistoryResultPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      try {
        const docRef = doc(db, "users", user.uid, "sessions", id);
        const snap = await getDoc(docRef);
        
        if (snap.exists()) {
          setFeedback(snap.data() as FeedbackData);
        } else {
          toast.error("Data interview tidak ditemukan.");
          router.push("/");
        }
      } catch (err) {
        console.error(err);
        toast.error("Gagal memuat history.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [id, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F0E8] dark:bg-zinc-950 flex flex-col items-center justify-center gap-4 transition-colors duration-300">
        <div className="w-10 h-10 border-4 border-gray-200 dark:border-zinc-800 border-t-[#0F1A0A] dark:border-t-[#D6FB61] rounded-full animate-spin" />
        <p className="text-[#6B7F60] dark:text-zinc-400 text-sm font-bold">Membuka arsip interview...</p>
      </div>
    );
  }

  if (!feedback) return null;

  const cats = feedback.categories;
  const mainTheme = getScoreTheme(feedback.score);

  return (
    <div className="min-h-screen bg-[#F4F0E8] dark:bg-zinc-950 px-4 py-10 pb-16 transition-colors duration-300">
      <Toaster position="top-center" toastOptions={{
        className: "dark:bg-zinc-800 dark:text-zinc-100 dark:border dark:border-zinc-700",
        style: { borderRadius: "12px", fontSize: "14px", fontWeight: "bold" }
      }} />

      <div className="max-w-[600px] mx-auto flex flex-col gap-5">

        <div className="flex items-center justify-between gap-2.5 mb-2">
          <div>
            <h1 className="text-2xl font-black text-[#0F1A0A] dark:text-zinc-100 m-0 tracking-tight">Arsip Interview</h1>
            <p className="text-[13px] font-bold text-[#6B7F60] dark:text-zinc-400 mt-1">
              {feedback.company} · {feedback.field}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border-2 border-gray-100 dark:border-zinc-800 text-[#0F1A0A] dark:text-zinc-100 text-[13px] font-bold cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Dashboard
            </button>
          </div>
        </div>

        <div className={`${mainTheme.bg} border-2 ${mainTheme.border} rounded-[2rem] p-8 shadow-sm transition-colors duration-300`}>
          <div className="flex items-center justify-between mb-5 flex-wrap gap-4">
            <div>
              <div className="flex items-baseline gap-1">
                <span className={`text-[64px] font-black ${mainTheme.text} leading-none tracking-[-2px]`}>{feedback.score}</span>
                <span className="text-lg font-bold text-gray-400 dark:text-zinc-500 mb-1">/100</span>
              </div>
              <span className={`text-lg font-extrabold ${mainTheme.text} block mt-1`}>{feedback.verdict}</span>
            </div>
            
            <svg width="76" height="76" viewBox="0 0 72 72" className={`shrink-0 ${mainTheme.text}`}>
              <circle cx="36" cy="36" r="28" fill="none" strokeWidth="7" className="stroke-black/5 dark:stroke-white/10" />
              <circle cx="36" cy="36" r="28" fill="none" stroke="currentColor" strokeWidth="7"
                strokeDasharray={`${(feedback.score / 100) * 175.9} 175.9`}
                strokeLinecap="round" transform="rotate(-90 36 36)" style={{ transition: "stroke-dasharray 1s ease" }}/>
              <text x="36" y="41" textAnchor="middle" fontSize="13" fontWeight="900" fill="currentColor">{feedback.score}</text>
            </svg>
          </div>
          <p className="text-[14.5px] text-gray-700 dark:text-zinc-300 leading-relaxed font-semibold m-0">{feedback.summary}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(Object.keys(cats) as (keyof typeof cats)[]).map((key) => {
            const cat  = cats[key];
            const meta = CATEGORY_META[key];
            const catTheme = getScoreTheme(cat.score);
            return (
              <div key={key} className="bg-white dark:bg-zinc-900 border-2 border-gray-100 dark:border-zinc-800 rounded-[1.2rem] p-5 transition-colors duration-300">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-[#6B7F60] dark:text-zinc-400">{meta.label}</span>
                  <div className="flex items-baseline gap-0.5">
                    <span className={`text-[22px] font-black ${catTheme.text}`}>{cat.score}</span>
                    <span className="text-xs font-bold text-gray-400 dark:text-zinc-500">/100</span>
                  </div>
                </div>
                
                <div className="h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden mb-3">
                  <div className={`h-full ${catTheme.bar} rounded-full transition-all duration-700`} style={{ width: `${cat.score}%` }} />
                </div>
                <p className="text-[13px] text-gray-600 dark:text-zinc-400 font-medium leading-relaxed m-0">{cat.note}</p>
              </div>
            );
          })}
        </div>

        <div className="bg-white dark:bg-zinc-900 border-2 border-gray-100 dark:border-zinc-800 rounded-[1.2rem] p-5 sm:p-6 transition-colors duration-300">
          <p className="text-[13px] font-extrabold text-emerald-500 dark:text-emerald-400 uppercase tracking-widest mb-3">✓ Kelebihan kamu</p>
          <div className="flex flex-col gap-3">
            {feedback.strengths.map((s, i) => (
              <div key={i} className="flex gap-2.5 items-start">
                <span className="text-emerald-500 dark:text-emerald-400 text-xs mt-1 shrink-0">●</span>
                <span className="text-[14px] text-gray-700 dark:text-zinc-300 font-semibold leading-relaxed">{s}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border-2 border-gray-100 dark:border-zinc-800 rounded-[1.2rem] p-5 sm:p-6 transition-colors duration-300">
          <p className="text-[13px] font-extrabold text-amber-500 dark:text-amber-400 uppercase tracking-widest mb-3">↑ Perlu ditingkatkan</p>
          <div className="flex flex-col gap-3">
            {feedback.improvements.map((s, i) => (
              <div key={i} className="flex gap-2.5 items-start">
                <span className="text-amber-500 dark:text-amber-400 text-xs mt-1 shrink-0">●</span>
                <span className="text-[14px] text-gray-700 dark:text-zinc-300 font-semibold leading-relaxed">{s}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-800/50 border-2 border-[#0F1A0A] dark:border-[#D6FB61]/30 rounded-[1.2rem] p-5 sm:p-6 transition-colors duration-300">
          <p className="text-[13px] font-extrabold text-[#0F1A0A] dark:text-[#D6FB61] uppercase tracking-widest mb-2.5">💡 Tips untuk sesi berikutnya</p>
          <p className="text-[14px] text-gray-800 dark:text-zinc-200 font-bold leading-relaxed m-0">{feedback.tips}</p>
        </div>

      </div>
    </div>
  );
}