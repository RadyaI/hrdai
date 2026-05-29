"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import toast, { Toaster } from "react-hot-toast";

const FEEDBACK_API = "https://radya.my.id/api/chat/gemini";

type CategoryScore = {
  score: number;   
  note: string;    
};

type Feedback = {
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
};

function scoreColor(s: number): string {
  if (s >= 80) return "#4ade80";
  if (s >= 60) return "#60a5fa";
  if (s >= 40) return "#fbbf24";
  return "#f87171";
}

function scoreBg(s: number): string {
  if (s >= 80) return "rgba(74,222,128,0.08)";
  if (s >= 60) return "rgba(96,165,250,0.08)";
  if (s >= 40) return "rgba(251,191,36,0.08)";
  return "rgba(248,113,113,0.08)";
}

function scoreBorder(s: number): string {
  if (s >= 80) return "rgba(74,222,128,0.2)";
  if (s >= 60) return "rgba(96,165,250,0.2)";
  if (s >= 40) return "rgba(251,191,36,0.2)";
  return "rgba(248,113,113,0.2)";
}

const CATEGORY_META: Record<string, { label: string; icon: string; desc: string }> = {
  komunikasi: { label: "Komunikasi", icon: "💬", desc: "Kejelasan & cara penyampaian" },
  technical:  { label: "Technical",  icon: "⚙️", desc: "Pemahaman skill teknis" },
  confidence: { label: "Confidence", icon: "🎯", desc: "Keyakinan & ketegasan jawaban" },
  relevance:  { label: "Relevance",  icon: "🎯", desc: "Jawaban nyambung sama pertanyaan" },
};

export default function ResultPage() {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const rawMessages = sessionStorage.getItem("interview_messages");
    const rawConfig   = sessionStorage.getItem("interview_config");
    if (!rawMessages || !rawConfig) return router.replace("/setup");
    generateFeedback(JSON.parse(rawMessages), JSON.parse(rawConfig));
  }, []);

  async function generateFeedback(
    messages: { role: string; text: string }[],
    config: { company: string; field: string; level: string }
  ) {
    setLoading(true);
    try {
      const prompt = `Kamu adalah evaluator interview profesional. Balas HANYA dengan JSON murni, tanpa teks apapun di luar JSON.

Berikut transkrip sesi interview untuk posisi ${config.field} level ${config.level} di ${config.company}:

TRANSKRIP:
${messages.map((m) => `${m.role === "user" ? "Kandidat" : "HRD"}: ${m.text}`).join("\n\n")}

Evaluasi kandidat dan kembalikan JSON dengan format PERSIS seperti ini (tanpa markdown, tanpa backtick):
{
  "score": <angka 0-100, kamu yang tentukan berdasarkan keseluruhan performa>,
  "verdict": "<Sangat Berpeluang|Berpeluang|Perlu Latihan|Belum Siap>",
  "summary": "<ringkasan 2-3 kalimat performa keseluruhan>",
  "categories": {
    "komunikasi": { "score": <0-100>, "note": "<1 kalimat evaluasi>" },
    "technical":  { "score": <0-100>, "note": "<1 kalimat evaluasi>" },
    "confidence": { "score": <0-100>, "note": "<1 kalimat evaluasi>" },
    "relevance":  { "score": <0-100>, "note": "<1 kalimat evaluasi>" }
  },
  "strengths":    ["<kelebihan 1>", "<kelebihan 2>", "<kelebihan 3>"],
  "improvements": ["<perlu diperbaiki 1>", "<perlu diperbaiki 2>"],
  "tips": "<satu saran konkret paling penting untuk sesi berikutnya>"
}`;

      const res = await fetch(FEEDBACK_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: [{ role: "user", text: prompt }], persona: "default" }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const cleaned   = data.text.replace(/```json|```/g, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Format feedback tidak valid");

      const parsed: Feedback = JSON.parse(jsonMatch[0]);
      setFeedback(parsed);
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
        ...config, messages,
        name: user.displayName,
        email: user.email,
        score: fb.score, verdict: fb.verdict, summary: fb.summary,
        categories: fb.categories,
        strengths: fb.strengths, improvements: fb.improvements, tips: fb.tips,
        createdAt: serverTimestamp(),
      });
      setSaved(true);
    } catch (e) {
      console.warn("Gagal simpan ke Firestore:", e);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f0f10", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ width: 36, height: 36, border: "2px solid rgba(255,255,255,0.1)", borderTop: "2px solid #7c3aed", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>AI lagi analisis interview kamu...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!feedback) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f0f10", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "rgba(255,255,255,0.4)", marginBottom: 12, fontSize: 14 }}>Gagal memuat hasil.</p>
          <button onClick={() => router.push("/setup")} style={{ color: "#a78bfa", fontSize: 13, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
            Coba lagi
          </button>
        </div>
      </div>
    );
  }

  const cats = feedback.categories;

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f10", fontFamily: "var(--font-sans, system-ui)", padding: "40px 24px 60px" }}>
      <Toaster position="top-center" toastOptions={{ style: { background: "#1c1c1e", color: "#fff", border: "0.5px solid rgba(255,255,255,0.1)" } }} />

      <div style={{ maxWidth: 600, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        {}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 500, color: "rgba(255,255,255,0.9)", margin: 0 }}>Hasil Interview</h1>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>Analisis AI dari sesi yang baru selesai</p>
          </div>
          <button
            onClick={() => router.push("/")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.45)", fontSize: 12, cursor: "pointer" }}
          >
            Dashboard
          </button>
        </div>

        {}
        <div style={{ background: scoreBg(feedback.score), border: `0.5px solid ${scoreBorder(feedback.score)}`, borderRadius: 16, padding: "28px 24px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 64, fontWeight: 700, color: scoreColor(feedback.score), lineHeight: 1 }}>{feedback.score}</span>
                <span style={{ fontSize: 18, color: "rgba(255,255,255,0.25)", marginBottom: 4 }}>/100</span>
              </div>
              <span style={{ fontSize: 16, fontWeight: 500, color: scoreColor(feedback.score) }}>{feedback.verdict}</span>
            </div>
            {}
            <svg width="72" height="72" viewBox="0 0 72 72">
              <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7"/>
              <circle cx="36" cy="36" r="28" fill="none" stroke={scoreColor(feedback.score)} strokeWidth="7"
                strokeDasharray={`${(feedback.score / 100) * 175.9} 175.9`}
                strokeLinecap="round" transform="rotate(-90 36 36)" style={{ transition: "stroke-dasharray 1s ease" }}/>
              <text x="36" y="40" textAnchor="middle" fontSize="13" fontWeight="600" fill={scoreColor(feedback.score)}>{feedback.score}</text>
            </svg>
          </div>
          <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.65, margin: 0 }}>{feedback.summary}</p>
        </div>

        {}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {(Object.keys(cats) as (keyof typeof cats)[]).map((key) => {
            const cat  = cats[key];
            const meta = CATEGORY_META[key];
            const col  = scoreColor(cat.score);
            return (
              <div key={key} style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "16px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{meta.label}</span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
                    <span style={{ fontSize: 22, fontWeight: 600, color: col }}>{cat.score}</span>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>/100</span>
                  </div>
                </div>
                {}
                <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 99, overflow: "hidden", marginBottom: 10 }}>
                  <div style={{ height: "100%", width: `${cat.score}%`, background: col, borderRadius: 99, transition: "width 0.8s ease" }} />
                </div>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.5, margin: 0 }}>{cat.note}</p>
              </div>
            );
          })}
        </div>

        {}
        <div style={{ background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "18px 20px" }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.5)", marginBottom: 12 }}>✓ Kelebihan kamu</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {feedback.strengths.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ color: "#4ade80", fontSize: 14, marginTop: 1, flexShrink: 0 }}>●</span>
                <span style={{ fontSize: 13.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.55 }}>{s}</span>
              </div>
            ))}
          </div>
        </div>

        {}
        <div style={{ background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "18px 20px" }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.5)", marginBottom: 12 }}>↑ Perlu ditingkatkan</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {feedback.improvements.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ color: "#fbbf24", fontSize: 14, marginTop: 1, flexShrink: 0 }}>●</span>
                <span style={{ fontSize: 13.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.55 }}>{s}</span>
              </div>
            ))}
          </div>
        </div>

        {}
        <div style={{ background: "rgba(124,58,237,0.07)", border: "0.5px solid rgba(124,58,237,0.2)", borderRadius: 14, padding: "18px 20px" }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: "rgba(167,139,250,0.7)", marginBottom: 8 }}>💡 Tips untuk sesi berikutnya</p>
          <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.65, margin: 0 }}>{feedback.tips}</p>
        </div>

        {}
        <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
          <button
            onClick={() => { sessionStorage.removeItem("interview_messages"); router.push("/setup"); }}
            style={{ flex: 1, background: "#7c3aed", border: "none", borderRadius: 12, padding: "14px 0", fontSize: 14, fontWeight: 500, color: "white", cursor: "pointer" }}
          >
            Interview Lagi
          </button>
          <button
            onClick={() => router.push("/")}
            style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.09)", borderRadius: 12, padding: "14px 0", fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.5)", cursor: "pointer" }}
          >
            Dashboard
          </button>
        </div>

      </div>
    </div>
  );
}