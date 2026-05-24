"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import toast, { Toaster } from "react-hot-toast";

const MAX_QUESTIONS = 2;
const AI_API = "https://radya.my.id/api/chat/groq";

type Message = { role: "user" | "model"; text: string };

function buildSystemPrompt(company: string, field: string, level: string): string {
  return `Kamu adalah HRD profesional dari perusahaan ${company}, divisi ${field}.
Kamu sedang melakukan sesi interview untuk posisi ${level}.

ATURAN PENTING:
- Mulai dengan memperkenalkan diri singkat sebagai HRD ${company}, lalu langsung tanya pertanyaan pertama.
- Tanyakan tepat ${MAX_QUESTIONS} pertanyaan, satu per satu. Tunggu jawaban sebelum lanjut.
- Pertanyaan harus relevan dengan bidang ${field} dan level ${level}.
- Campuran: pertanyaan soft skill, teknikal ringan, dan situasional.
- Setelah pertanyaan ke-${MAX_QUESTIONS} dijawab, ucapkan penutup singkat dan tambahkan marker: [INTERVIEW_SELESAI]
- Gunakan bahasa Indonesia yang profesional tapi tidak kaku.
- Jangan keluar dari peran HRD.`;
}

export default function SessionPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [done, setDone] = useState(false);
  const [config, setConfig] = useState<{ company: string; field: string; level: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load config dari sessionStorage
  useEffect(() => {
    const raw = sessionStorage.getItem("interview_config");
    if (!raw) return router.replace("/setup");
    const cfg = JSON.parse(raw);
    setConfig(cfg);
    // Kirim pesan pertama (trigger AI mulai interview)
    startInterview(cfg);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function startInterview(cfg: { company: string; field: string; level: string }) {
    setLoading(true);
    try {
      const systemPrompt = buildSystemPrompt(cfg.company, cfg.field, cfg.level);
      // History kosong, tapi kita kasih trigger awal
      const res = await fetch(AI_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: [
            // Sisipkan system prompt sebagai konteks di pesan pertama
            {
              role: "user",
              text: `[INSTRUKSI SISTEM - IKUTI INI]\n${systemPrompt}\n\n---\nHalo, saya siap untuk interview.`
            }
          ],
          persona: "hrd_interview",
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setMessages([
        { role: "user", text: "Halo, saya siap untuk interview." },
        { role: "model", text: data.text },
      ]);
    } catch {
      toast.error("Gagal memulai interview. Coba refresh.");
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    if (!input.trim() || loading || done || !config) return;

    const userMsg: Message = { role: "user", text: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const systemPrompt = buildSystemPrompt(config.company, config.field, config.level);
      const res = await fetch(AI_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: newMessages,
          persona: "hrd_interview",
          systemPrompt,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const aiText: string = data.text;
      const isFinished = aiText.includes("[INTERVIEW_SELESAI]");
      const cleanText = aiText.replace("[INTERVIEW_SELESAI]", "").trim();

      const updatedMessages: Message[] = [...newMessages, { role: "model", text: cleanText }];
      setMessages(updatedMessages);
      setQuestionCount((q) => q + 1);

      if (isFinished) {
        setDone(true);
        // Simpan ke sessionStorage buat halaman result
        sessionStorage.setItem("interview_messages", JSON.stringify(updatedMessages));
        sessionStorage.setItem("interview_config", JSON.stringify(config));
      }
    } catch {
      toast.error("AI error. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <Toaster position="top-center" />

      {/* Header */}
      <div className="border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-white">
            {config ? `HRD ${config.company}` : "Interview Session"}
          </h2>
          <p className="text-xs text-zinc-500">
            {config ? `${config.field} · ${config.level}` : "Memuat..."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500">
            {questionCount}/{MAX_QUESTIONS} pertanyaan
          </span>
          {/* Progress bar */}
          <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all"
              style={{ width: `${(questionCount / MAX_QUESTIONS) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-2xl mx-auto w-full">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "model" && (
              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs text-white mr-2 mt-1 shrink-0">
                HR
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === "user"
                  ? "bg-white text-zinc-900 rounded-br-sm"
                  : "bg-white/[0.06] text-zinc-200 rounded-bl-sm border border-white/10"
                }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs text-white mr-2 mt-1 shrink-0">HR</div>
            <div className="bg-white/[0.06] border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-white/10 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          {done ? (
            <div className="text-center space-y-3">
              <p className="text-zinc-400 text-sm">Sesi interview selesai! 🎉</p>
              <button
                onClick={() => router.push("/result")}
                className="bg-white text-zinc-900 font-semibold text-sm rounded-xl px-8 py-3 hover:bg-zinc-100 active:scale-[0.98] transition-all"
              >
                Lihat Hasil & Feedback →
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ketik jawaban kamu... (Enter untuk kirim)"
                rows={2}
                disabled={loading}
                className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-white/25 resize-none transition-colors disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="bg-white text-zinc-900 font-medium text-sm rounded-xl px-5 hover:bg-zinc-100 active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
              >
                Kirim
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}