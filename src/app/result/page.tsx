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
  if (s >= 80) return "#10b981";
  if (s >= 60) return "#3b82f6";
  if (s >= 40) return "#f59e0b";
  return "#ef4444";
}

function scoreBg(s: number): string {
  if (s >= 80) return "#f0fdf4";
  if (s >= 60) return "#eff6ff";
  if (s >= 40) return "#fffbeb";
  return "#fef2f2";
}

function scoreBorder(s: number): string {
  if (s >= 80) return "#bbf7d0";
  if (s >= 60) return "#bfdbfe";
  if (s >= 40) return "#fef3c7";
  return "#ffeeee";
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
      <div style={{ minHeight: "100vh", background: "#F4F0E8", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, justifyContent: "center" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
          * { font-family: 'Nunito', sans-serif; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
        <div style={{ width: 40, height: 40, border: "4px solid rgba(0,0,0,0.06)", borderTop: "4px solid #0F1A0A", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <p style={{ color: "#6B7F60", fontSize: 14, fontWeight: 700 }}>AI lagi analisis interview kamu...</p>
      </div>
    );
  }

  if (!feedback) {
    return (
      <div style={{ minHeight: "100vh", background: "#F4F0E8", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
          * { font-family: 'Nunito', sans-serif; }
        `}</style>
        <div style={{ textAlign: "center", background: "#fff", padding: "24px", borderRadius: "20px", border: "2px solid border-gray-100" }}>
          <p style={{ color: "#0F1A0A", marginBottom: 12, fontSize: 15, fontWeight: 700 }}>Gagal memuat hasil.</p>
          <button onClick={() => router.push("/setup")} style={{ color: "#3D6B2C", fontSize: 14, fontWeight: 800, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
            Coba lagi
          </button>
        </div>
      </div>
    );
  }

  const cats = feedback.categories;

  return (
    <div style={{ minHeight: "100vh", background: "#F4F0E8", padding: "40px 16px 60px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
        * { font-family: 'Nunito', sans-serif; }
        
        .cats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .actions-wrap {
          display: flex;
          gap: 12px;
          padding-top: 4px;
        }

        @media (max-width: 600px) {
          .cats-grid {
            grid-template-columns: 1fr;
          }
          .actions-wrap {
            flex-direction: column;
          }
        }
      `}</style>

      <Toaster position="top-center" toastOptions={{ style: { background: "#0F1A0A", color: "#D6FB61", borderRadius: "12px", fontSize: "14px", fontWeight: "bold" } }} />

      <div style={{ maxWidth: 600, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0F1A0A", margin: 0, letterSpacing: "-0.5px" }}>Hasil Interview</h1>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#6B7F60", marginTop: 4 }}>Analisis AI dari sesi yang baru selesai</p>
          </div>
          <button
            onClick={() => router.push("/")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 12, background: "#fff", border: "2px solid rgba(0,0,0,0.06)", color: "#0F1A0A", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            Dashboard
          </button>
        </div>

        <div style={{ background: scoreBg(feedback.score), border: `2px solid ${scoreBorder(feedback.score)}`, borderRadius: "2rem", padding: "32px 24px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.02)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: 64, fontWeight: 900, color: scoreColor(feedback.score), lineHeight: 1, letterSpacing: "-2px" }}>{feedback.score}</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: "#9ca3af", marginBottom: 4 }}>/100</span>
              </div>
              <span style={{ fontSize: 18, fontWeight: 800, color: scoreColor(feedback.score), display: "block", marginTop: 4 }}>{feedback.verdict}</span>
            </div>
            
            <svg width="76" height="76" viewBox="0 0 72 72" style={{ flexShrink: 0 }}>
              <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(0,0,0,0.04)" strokeWidth="7"/>
              <circle cx="36" cy="36" r="28" fill="none" stroke={scoreColor(feedback.score)} strokeWidth="7"
                strokeDasharray={`${(feedback.score / 100) * 175.9} 175.9`}
                strokeLinecap="round" transform="rotate(-90 36 36)" style={{ transition: "stroke-dasharray 1s ease" }}/>
              <text x="36" y="41" textAnchor="middle" fontSize="13" fontWeight="900" fill={scoreColor(feedback.score)}>{feedback.score}</text>
            </svg>
          </div>
          <p style={{ fontSize: 14.5, color: "#374151", lineHeight: 1.6, fontWeight: 600, margin: 0 }}>{feedback.summary}</p>
        </div>

        <div className="cats-grid">
          {(Object.keys(cats) as (keyof typeof cats)[]).map((key) => {
            const cat  = cats[key];
            const meta = CATEGORY_META[key];
            const col  = scoreColor(cat.score);
            return (
              <div key={key} style={{ background: "#fff", border: "2px solid rgba(0,0,0,0.03)", borderRadius: 20, padding: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#6B7F60" }}>{meta.label}</span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                    <span style={{ fontSize: 22, fontWeight: 900, color: col }}>{cat.score}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af" }}>/100</span>
                  </div>
                </div>
                
                <div style={{ height: 6, background: "rgba(0,0,0,0.04)", borderRadius: 99, overflow: "hidden", marginBottom: 12 }}>
                  <div style={{ height: "100%", width: `${cat.score}%`, background: col, borderRadius: 99, transition: "width 0.8s ease" }} />
                </div>
                <p style={{ fontSize: 13, color: "#4b5563", fontWeight: 500, lineHeight: 1.5, margin: 0 }}>{cat.note}</p>
              </div>
            );
          })}
        </div>

        <div style={{ background: "#fff", border: "2px solid rgba(0,0,0,0.03)", borderRadius: 20, padding: "22px 20px" }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 14 }}>✓ Kelebihan kamu</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {feedback.strengths.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ color: "#10b981", fontSize: 12, marginTop: 3, flexShrink: 0 }}>●</span>
                <span style={{ fontSize: 14, color: "#374151", fontWeight: 600, lineHeight: 1.5 }}>{s}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: "#fff", border: "2px solid rgba(0,0,0,0.03)", borderRadius: 20, padding: "22px 20px" }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 14 }}>↑ Perlu ditingkatkan</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {feedback.improvements.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ color: "#f59e0b", fontSize: 12, marginTop: 3, flexShrink: 0 }}>●</span>
                <span style={{ fontSize: 14, color: "#374151", fontWeight: 600, lineHeight: 1.5 }}>{s}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: "#fff", border: "2px solid #0F1A0A", borderRadius: 20, padding: "22px 20px" }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: "#0F1A0A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>💡 Tips untuk sesi berikutnya</p>
          <p style={{ fontSize: 14, color: "#374151", fontWeight: 600, lineHeight: 1.6, margin: 0 }}>{feedback.tips}</p>
        </div>

        <div className="actions-wrap">
          <button
            onClick={() => { sessionStorage.removeItem("interview_messages"); router.push("/setup"); }}
            style={{ flex: 1, background: "#0F1A0A", border: "none", borderRadius: 16, padding: "16px 0", fontSize: 15, fontWeight: 800, color: "#D6FB61", cursor: "pointer", transition: "all 0.15s" }}
            onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.98)"}
            onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
          >
            Interview Lagi
          </button>
          <button
            onClick={() => router.push("/")}
            style={{ flex: 1, background: "#fff", border: "2px solid rgba(0,0,0,0.06)", borderRadius: 16, padding: "16px 0", fontSize: 15, fontWeight: 800, color: "#0F1A0A", cursor: "pointer", transition: "all 0.15s" }}
            onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.98)"}
            onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
          >
            Dashboard
          </button>
        </div>

      </div>
    </div>
  );
}