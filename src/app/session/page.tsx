"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";

const MAX_QUESTIONS = 5;
const AI_API = "https://radya.my.id/api/chat/groq";

type Message = { role: "user" | "model"; text: string; time?: string };

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

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
  interface SpeechRecognition extends EventTarget {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    start(): void;
    stop(): void;
    onstart: ((e: Event) => void) | null;
    onend: ((e: Event) => void) | null;
    onresult: ((e: SpeechRecognitionEvent) => void) | null;
    onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  }
  interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
  }
  interface SpeechRecognitionErrorEvent extends Event {
    error: SpeechRecognitionErrorCode;
  }
}

function getTime() {
  return new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export default function SessionPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [done, setDone] = useState(false);
  const [config, setConfig] = useState<{ company: string; field: string; level: string } | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [autoSend, setAutoSend] = useState(false);
  const autoSendRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("interview_config");
    if (!raw) return router.replace("/setup");
    const cfg = JSON.parse(raw);
    setConfig(cfg);
    startInterview(cfg);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function toggleMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast.error("Browser kamu tidak support voice input 😢"); return; }
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const rec = new SR();
    rec.lang = "id-ID";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onstart = () => setIsListening(true);
    let finalTranscript = "";
    rec.onresult = (e) => {
      const transcript = Array.from(e.results).map((r) => r[0].transcript).join("");
      setInput(transcript);
      if (e.results[e.results.length - 1].isFinal) finalTranscript = transcript;
    };
    rec.onerror = (e) => { toast.error(`Voice error: ${e.error}`); setIsListening(false); };
    rec.onend = () => {
      setIsListening(false);
      if (autoSendRef.current && finalTranscript.trim()) {
        setInput(finalTranscript.trim());
        setTimeout(() => sendMessage(), 100);
      }
    };
    recognitionRef.current = rec;
    rec.start();
  }

  async function startInterview(cfg: { company: string; field: string; level: string }) {
    setLoading(true);
    try {
      const systemPrompt = buildSystemPrompt(cfg.company, cfg.field, cfg.level);
      const res = await fetch(AI_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: [{ role: "user", text: `[INSTRUKSI SISTEM - IKUTI INI]\n${systemPrompt}\n\n---\nHalo, saya siap untuk interview.` }],
          persona: "hrd_interview",
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessages([
        { role: "user", text: "Halo, saya siap untuk interview.", time: getTime() },
        { role: "model", text: data.text, time: getTime() },
      ]);
    } catch {
      toast.error("Gagal memulai interview. Coba refresh.");
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    if (!input.trim() || loading || done || !config) return;
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); }

    const userMsg: Message = { role: "user", text: input.trim(), time: getTime() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const systemPrompt = buildSystemPrompt(config.company, config.field, config.level);
      const res = await fetch(AI_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: newMessages, persona: "hrd_interview", systemPrompt }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const aiText: string = data.text;
      const isFinished = aiText.includes("[INTERVIEW_SELESAI]");
      const cleanText = aiText.replace("[INTERVIEW_SELESAI]", "").trim();
      const updated: Message[] = [...newMessages, { role: "model", text: cleanText, time: getTime() }];

      setMessages(updated);
      setQuestionCount((q) => q + 1);
      if (isFinished) {
        setDone(true);
        sessionStorage.setItem("interview_messages", JSON.stringify(updated));
        sessionStorage.setItem("interview_config", JSON.stringify(config));
      }
    } catch {
      toast.error("AI error. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  const progress = (questionCount / MAX_QUESTIONS) * 100;

  return (
    <>
      <style>{`
        html, body { height: 100%; margin: 0; }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-5px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        #msg-scroll {
          color-scheme: dark;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.15) transparent;
        }
        #msg-scroll::-webkit-scrollbar { width: 5px; }
        #msg-scroll::-webkit-scrollbar-track { background: transparent; }
        #msg-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.15);
          border-radius: 99px;
        }
        #msg-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.25);
        }
      `}</style>

      <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0f0f10", fontFamily: "var(--font-sans, system-ui)", overflow: "hidden" }}>
        <Toaster position="top-center" toastOptions={{ style: { background: "#1c1c1e", color: "#fff", border: "0.5px solid rgba(255,255,255,0.1)" } }} />

        {/* ── TOPBAR (sticky) ── */}
        <div style={{ borderBottom: "0.5px solid rgba(255,255,255,0.07)", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, background: "#0f0f10", zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => router.back()}
              style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.09)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,0.5)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            </button>
            <div>
              <p style={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.85)", margin: 0 }}>
                {config ? `HRD ${config.company}` : "Interview Session"}
              </p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", margin: 0 }}>
                {config ? `${config.field} · ${config.level}` : "Memuat..."}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>{questionCount}/{MAX_QUESTIONS} pertanyaan</span>
            <div style={{ width: 80, height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: "#7c3aed", borderRadius: 99, transition: "width 0.4s ease" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 99, background: "rgba(74,222,128,0.08)", border: "0.5px solid rgba(74,222,128,0.2)" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80" }} />
              <span style={{ fontSize: 11, color: "#4ade80" }}>Live</span>
            </div>
          </div>
        </div>

        {/* ── MESSAGES (scrollable) ── */}
        <div
          id="msg-scroll"
          style={{ flex: 1, overflowY: "auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 20 }}
        >
          <div style={{ maxWidth: 760, width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8, flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>
                  {msg.role === "model" && (
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(124,58,237,0.2)", border: "0.5px solid rgba(124,58,237,0.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 500, color: "#c4b5fd", flexShrink: 0 }}>HR</div>
                  )}
                  <div style={{
                    maxWidth: "68%", padding: "11px 15px",
                    borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                    fontSize: 13.5, lineHeight: 1.65,
                    background: msg.role === "user" ? "#6d28d9" : "rgba(255,255,255,0.045)",
                    border: msg.role === "user" ? "none" : "0.5px solid rgba(255,255,255,0.08)",
                    color: msg.role === "user" ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.78)",
                  }}>
                    {msg.text}
                  </div>
                </div>
                <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.2)", paddingLeft: msg.role === "model" ? 38 : 0 }}>{msg.time}</span>
              </div>
            ))}

            {loading && (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(124,58,237,0.2)", border: "0.5px solid rgba(124,58,237,0.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 500, color: "#c4b5fd", flexShrink: 0 }}>HR</div>
                <div style={{ padding: "13px 16px", borderRadius: "14px 14px 14px 4px", background: "rgba(255,255,255,0.045)", border: "0.5px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    {[0, 1, 2].map((i) => (
                      <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.25)", animation: "bounce 1s ease-in-out infinite", animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* ── INPUT AREA (sticky) ── */}
        <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.07)", padding: "14px 24px 20px", flexShrink: 0, background: "#0f0f10", zIndex: 10 }}>
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            {done ? (
              <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Sesi interview selesai! 🎉</p>
                <button
                  onClick={() => router.push("/result")}
                  style={{ background: "#7c3aed", color: "white", border: "none", borderRadius: 12, padding: "12px 28px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}
                >
                  Lihat Hasil & Feedback →
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", gap: 4, margin: 0 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    Enter untuk kirim · Shift+Enter baris baru · atau jawab pake suara
                  </p>
                  <button
                    onClick={() => { setAutoSend((v) => { autoSendRef.current = !v; return !v; }); }}
                    style={{ display: "flex", alignItems: "center", gap: 7, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    <span style={{ fontSize: 11, color: autoSend ? "#c4b5fd" : "rgba(255,255,255,0.3)" }}>
                      {autoSend ? "Langsung kirim" : "Koreksi dulu"}
                    </span>
                    <div style={{ width: 36, height: 20, borderRadius: 99, background: autoSend ? "rgba(124,58,237,0.5)" : "rgba(255,255,255,0.08)", border: autoSend ? "0.5px solid rgba(124,58,237,0.5)" : "0.5px solid rgba(255,255,255,0.12)", position: "relative", transition: "all 0.2s" }}>
                      <div style={{ position: "absolute", top: 3, left: autoSend ? 19 : 3, width: 14, height: 14, borderRadius: "50%", background: autoSend ? "#a78bfa" : "rgba(255,255,255,0.3)", transition: "all 0.2s" }} />
                    </div>
                  </button>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isListening ? "🎤  Lagi dengerin kamu..." : "Tulis jawaban kamu..."}
                    rows={2}
                    disabled={loading}
                    style={{
                      flex: 1, background: "rgba(255,255,255,0.04)",
                      border: isListening ? "0.5px solid rgba(239,68,68,0.45)" : "0.5px solid rgba(255,255,255,0.09)",
                      borderRadius: 12, padding: "12px 14px",
                      color: "rgba(255,255,255,0.85)", fontSize: 13.5, lineHeight: 1.55,
                      resize: "none", outline: "none", fontFamily: "inherit", transition: "border-color 0.2s",
                    }}
                  />

                  <button
                    onClick={toggleMic}
                    disabled={loading}
                    title={isListening ? "Stop recording" : "Voice input"}
                    style={{
                      width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                      background: isListening ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.05)",
                      border: isListening ? "0.5px solid rgba(239,68,68,0.35)" : "0.5px solid rgba(255,255,255,0.09)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", color: isListening ? "#f87171" : "rgba(255,255,255,0.4)",
                      animation: isListening ? "pulse 1.5s ease-in-out infinite" : "none",
                      transition: "all 0.2s",
                    }}
                  >
                    {isListening ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/></svg>
                    )}
                  </button>

                  <button
                    onClick={sendMessage}
                    disabled={loading || !input.trim()}
                    style={{
                      height: 46, padding: "0 20px", borderRadius: 12, flexShrink: 0,
                      background: input.trim() && !loading ? "#7c3aed" : "rgba(255,255,255,0.06)",
                      border: "none",
                      color: input.trim() && !loading ? "white" : "rgba(255,255,255,0.2)",
                      fontSize: 13.5, fontWeight: 500,
                      cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                      transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    Kirim
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}