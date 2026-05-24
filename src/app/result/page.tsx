"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import toast, { Toaster } from "react-hot-toast";

const FEEDBACK_API = "https://radya.my.id/api/chat/gemini";

type Feedback = {
  score: number;          // 0-100
  verdict: string;        // "Sangat Berpeluang" | "Berpeluang" | "Perlu Latihan" | "Belum Siap"
  summary: string;        // ringkasan performa
  strengths: string[];    // poin kelebihan
  improvements: string[]; // poin yang perlu diperbaiki
  tips: string;           // saran akhir
};

function getVerdictColor(score: number) {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-blue-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

function getVerdictBg(score: number) {
  if (score >= 80) return "bg-emerald-400/10 border-emerald-400/20";
  if (score >= 60) return "bg-blue-400/10 border-blue-400/20";
  if (score >= 40) return "bg-amber-400/10 border-amber-400/20";
  return "bg-red-400/10 border-red-400/20";
}

export default function ResultPage() {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const rawMessages = sessionStorage.getItem("interview_messages");
    const rawConfig = sessionStorage.getItem("interview_config");
    if (!rawMessages || !rawConfig) return router.replace("/setup");

    const messages = JSON.parse(rawMessages);
    const config = JSON.parse(rawConfig);
    generateFeedback(messages, config);
  }, []);

  async function generateFeedback(
    messages: { role: string; text: string }[],
    config: { company: string; field: string; level: string }
  ) {
    setLoading(true);
    try {
      const prompt = `Kamu adalah evaluator interview. Balas HANYA dengan JSON murni, tanpa teks apapun sebelum atau sesudah JSON. Berikut adalah transkrip sesi interview untuk posisi ${config.field} level ${config.level} di ${config.company}.

TRANSKRIP:
${messages.map((m: { role: string; text: string }) => `${m.role === "user" ? "Kandidat" : "HRD"}: ${m.text}`).join("\n\n")}

Evaluasi performa kandidat dan berikan output dalam format JSON SAJA (tanpa markdown, tanpa backtick) seperti ini:
{
  "score": <angka 0-100>,
  "verdict": "<Sangat Berpeluang|Berpeluang|Perlu Latihan|Belum Siap>",
  "summary": "<ringkasan 2-3 kalimat tentang performa secara keseluruhan>",
  "strengths": ["<kelebihan 1>", "<kelebihan 2>", "<kelebihan 3>"],
  "improvements": ["<hal yang perlu diperbaiki 1>", "<hal yang perlu diperbaiki 2>"],
  "tips": "<satu saran konkret yang paling penting untuk sesi berikutnya>"
}`;

      const res = await fetch(FEEDBACK_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: [{ role: "user", text: prompt }],
          persona: "default",
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Sesudah - cari JSON object dulu baru parse
      const cleaned = data.text.replace(/```json|```/g, "").trim();

      // Cari { ... } yang valid dari dalam response
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Format feedback tidak valid");

      const parsed: Feedback = JSON.parse(jsonMatch[0]);
      setFeedback(parsed);

      // Auto-save ke Firestore
      await saveToFirestore(messages, config, parsed);
    } catch (err) {
      console.error(err);
      toast.error("Gagal generate feedback. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  async function saveToFirestore(
    messages: { role: string; text: string }[],
    config: { company: string; field: string; level: string },
    fb: Feedback
  ) {
    const user = auth.currentUser;
    if (!user || saved) return;
    try {
      await addDoc(collection(db, "users", user.uid, "sessions"), {
        ...config,
        messages,
        score: fb.score,
        verdict: fb.verdict,
        summary: fb.summary,
        strengths: fb.strengths,
        improvements: fb.improvements,
        tips: fb.tips,
        createdAt: serverTimestamp(),
      });
      setSaved(true);
    } catch (e) {
      console.warn("Gagal simpan ke Firestore:", e);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        <p className="text-zinc-500 text-sm">AI sedang menganalisis interview kamu...</p>
      </div>
    );
  }

  if (!feedback) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 mb-4">Gagal memuat hasil.</p>
          <button onClick={() => router.push("/setup")} className="text-white underline text-sm">
            Coba lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-12">
      <Toaster position="top-center" />
      <div className="max-w-xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-white">Hasil Interview</h1>
          <p className="text-zinc-500 text-sm mt-1">Analisis dari AI berdasarkan sesi tadi</p>
        </div>

        {/* Score Card */}
        <div className={`rounded-2xl border p-6 ${getVerdictBg(feedback.score)}`}>
          <div className="flex items-end gap-4 mb-3">
            <span className={`text-6xl font-bold ${getVerdictColor(feedback.score)}`}>
              {feedback.score}
            </span>
            <span className="text-zinc-500 text-sm mb-2">/100</span>
          </div>
          <span className={`text-lg font-semibold ${getVerdictColor(feedback.score)}`}>
            {feedback.verdict}
          </span>
          <p className="text-zinc-300 text-sm mt-3 leading-relaxed">{feedback.summary}</p>
        </div>

        {/* Kelebihan */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">✓ Kelebihan Kamu</h3>
          <ul className="space-y-2">
            {feedback.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-400">
                <span className="text-emerald-400 mt-0.5 shrink-0">●</span>
                {s}
              </li>
            ))}
          </ul>
        </div>

        {/* Yang perlu diperbaiki */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">↑ Perlu Ditingkatkan</h3>
          <ul className="space-y-2">
            {feedback.improvements.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-400">
                <span className="text-amber-400 mt-0.5 shrink-0">●</span>
                {s}
              </li>
            ))}
          </ul>
        </div>

        {/* Tips */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
          <h3 className="text-sm font-medium text-zinc-300 mb-2">💡 Tips untuk Sesi Berikutnya</h3>
          <p className="text-sm text-zinc-400 leading-relaxed">{feedback.tips}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => {
              sessionStorage.removeItem("interview_messages");
              router.push("/setup");
            }}
            className="flex-1 bg-white text-zinc-900 font-semibold text-sm rounded-xl py-3 hover:bg-zinc-100 active:scale-[0.98] transition-all"
          >
            Interview Lagi
          </button>
          <button
            onClick={() => router.push("/")}
            className="flex-1 border border-white/10 text-zinc-300 font-medium text-sm rounded-xl py-3 hover:bg-white/5 active:scale-[0.98] transition-all"
          >
            Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}