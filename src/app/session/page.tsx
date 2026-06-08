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
- Jangan keluar dari peran HRD.
- FORMAT JAWABAN: Gunakan markdown sederhana untuk keterbacaan.
  - Gunakan **teks** untuk penekanan penting.
  - Gunakan bullet point (- item) jika ada lebih dari 2 hal yang ingin disebutkan.
  - Jika pertanyaan panjang, pecah menjadi poin-poin singkat, jangan satu paragraf panjang.
  - Hindari kalimat yang terlalu panjang dan bertele-tele.`;
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
    error: string;
  }
}

function getTime(): string {
  return new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let bulletBuffer: string[] = [];

  function flushBullets(key: string) {
    if (bulletBuffer.length === 0) return;
    nodes.push(
      <ul key={key} style={{ margin: "6px 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 3 }}>
        {bulletBuffer.map((item, i) => (
          <li key={i} style={{ lineHeight: 1.6 }}>{renderInline(item)}</li>
        ))}
      </ul>
    );
    bulletBuffer = [];
  }

  lines.forEach((line, idx) => {
    const isBullet = /^[-*]\s+/.test(line);
    if (isBullet) {
      bulletBuffer.push(line.replace(/^[-*]\s+/, ""));
    } else {
      flushBullets(`ul-${idx}`);
      if (line.trim() === "") {
        nodes.push(<br key={`br-${idx}`} />);
      } else {
        nodes.push(
          <p key={`p-${idx}`} style={{ margin: "3px 0", lineHeight: 1.65 }}>
            {renderInline(line)}
          </p>
        );
      }
    }
  });
  flushBullets("ul-end");
  return <>{nodes}</>;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  );
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
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const autoSendRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadingStartRef = useRef<number>(0);

  function resizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }

  useEffect(() => { resizeTextarea(); }, [input]);

  useEffect(() => {
    const raw = sessionStorage.getItem("interview_config");
    if (!raw) { router.replace("/setup"); return; }
    const cfg = JSON.parse(raw) as { company: string; field: string; level: string };
    setConfig(cfg);
    startInterview(cfg);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (loading) {
      loadingStartRef.current = Date.now();
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - loadingStartRef.current) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (loadingStartRef.current > 0) {
        setResponseTime(+(((Date.now() - loadingStartRef.current) / 1000).toFixed(1)));
        loadingStartRef.current = 0;
      }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loading]);

  async function startInterview(cfg: { company: string; field: string; level: string }) {
    setLoading(true);
    setResponseTime(null);
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
      const data = (await res.json()) as { text?: string; error?: string };
      if (data.error) throw new Error(data.error);
      setMessages([
        { role: "user", text: "Halo, saya siap untuk interview.", time: getTime() },
        { role: "model", text: data.text ?? "", time: getTime() },
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
    const newCount = questionCount + 1;

    setMessages(newMessages);
    setInput("");
    setQuestionCount(newCount);
    setLoading(true);
    setResponseTime(null);

    try {
      const systemPrompt = buildSystemPrompt(config.company, config.field, config.level);
      const res = await fetch(AI_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: newMessages, persona: "hrd_interview", systemPrompt }),
      });
      const data = (await res.json()) as { text?: string; error?: string };
      if (data.error) throw new Error(data.error);

      const aiText = data.text ?? "";
      const hasMarker = aiText.includes("[INTERVIEW_SELESAI]");
      const cleanText = aiText.replace("[INTERVIEW_SELESAI]", "").trim();
      const updated: Message[] = [...newMessages, { role: "model", text: cleanText, time: getTime() }];

      setMessages(updated);

      if (hasMarker || newCount >= MAX_QUESTIONS) {
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

  function toggleMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast.error("Browser kamu tidak support voice input 😢"); return; }
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }

    finalTranscriptRef.current = "";
    const rec = new SR();
    rec.lang = "id-ID";
    rec.interimResults = true;
    rec.continuous = false;

    rec.onstart = () => setIsListening(true);

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      if (final) finalTranscriptRef.current = final;
      setInput(final || interim);
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      toast.error(`Voice error: ${e.error}`);
      setIsListening(false);
    };

    rec.onend = () => {
      setIsListening(false);
      const transcript = finalTranscriptRef.current.trim();
      if (autoSendRef.current && transcript) {
        setInput(transcript);
        setTimeout(() => sendMessage(), 50);
      }
    };

    recognitionRef.current = rec;
    rec.start();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  const progress = (questionCount / MAX_QUESTIONS) * 100;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
        html, body { height: 100%; margin: 0; background: #F4F0E8; }
        * { font-family: 'Nunito', sans-serif; }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-5px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        #msg-scroll {
          color-scheme: light;
          scrollbar-width: thin;
          scrollbar-color: rgba(0,0,0,0.1) transparent;
        }
        #msg-scroll::-webkit-scrollbar { width: 5px; }
        #msg-scroll::-webkit-scrollbar-track { background: transparent; }
        #msg-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 99px; }
        #msg-scroll::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.2); }
        .md-msg ul { margin: 6px 0; padding-left: 18px; }
        .md-msg li { line-height: 1.6; margin-bottom: 2px; }
        .md-msg p { margin: 3px 0; }
        .md-msg strong { color: #0F1A0A; font-weight: 800; }
      `}</style>

      <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#F4F0E8", overflow: "hidden" }}>
        <Toaster position="top-center" toastOptions={{ style: { background: "#0F1A0A", color: "#D6FB61", border: "none", borderRadius: "12px", fontWeight: "bold" } }} />

        <div style={{ borderBottom: "2px solid rgba(0,0,0,0.04)", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, background: "#fff", zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => router.back()}
              style={{ width: 36, height: 36, borderRadius: 10, background: "#fff", border: "2px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#0F1A0A" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div>
              <p style={{ fontSize: 15, fontWeight: 800, color: "#0F1A0A", margin: 0, letterSpacing: "-0.3px" }}>
                {config ? `HRD ${config.company}` : "Interview Session"}
              </p>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#6B7F60", margin: 0 }}>
                {config ? `${config.field} · ${config.level}` : "Memuat..."}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="hidden sm:block" style={{ fontSize: 12, fontWeight: 700, color: "#6B7F60" }}>{questionCount}/{MAX_QUESTIONS} pertanyaan</span>
            <div style={{ width: 80, height: 6, background: "rgba(0,0,0,0.05)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: "#0F1A0A", borderRadius: 99, transition: "width 0.4s ease" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 99, background: "#D6FB61", border: "2px solid #0F1A0A" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#0F1A0A" }} />
              <span style={{ fontSize: 11, fontWeight: 800, color: "#0F1A0A" }}>Live</span>
            </div>
          </div>
        </div>

        <div id="msg-scroll" style={{ flex: 1, overflowY: "auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ maxWidth: 760, width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>
                  {msg.role === "model" && (
                    <div style={{ width: 34, height: 34, borderRadius: "10px", background: "#D6FB61", border: "2px solid #0F1A0A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#0F1A0A", flexShrink: 0 }}>HR</div>
                  )}
                  <div
                    className={msg.role === "model" ? "md-msg" : undefined}
                    style={{
                      maxWidth: "75%", padding: "14px 18px",
                      borderRadius: msg.role === "user" ? "20px 20px 6px 20px" : "20px 20px 20px 6px",
                      fontSize: 14, lineHeight: 1.6, fontWeight: 500,
                      background: msg.role === "user" ? "#0F1A0A" : "#fff",
                      border: msg.role === "user" ? "none" : "2px solid rgba(0,0,0,0.04)",
                      color: msg.role === "user" ? "#fff" : "#374151",
                      boxShadow: msg.role === "user" ? "0 4px 14px rgba(15,26,10,0.15)" : "0 4px 14px rgba(0,0,0,0.02)",
                    }}
                  >
                    {msg.role === "model" ? renderMarkdown(msg.text) : msg.text}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: msg.role === "model" ? 44 : 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#a1a1aa" }}>{msg.time}</span>
                  {msg.role === "model" && i === messages.length - 1 && responseTime !== null && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#6B7F60", background: "rgba(0,0,0,0.04)", borderRadius: 99, padding: "2px 8px" }}>
                      {responseTime}s
                    </span>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: "10px", background: "#D6FB61", border: "2px solid #0F1A0A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#0F1A0A", flexShrink: 0 }}>HR</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ padding: "16px 20px", borderRadius: "20px 20px 20px 6px", background: "#fff", border: "2px solid rgba(0,0,0,0.04)", boxShadow: "0 4px 14px rgba(0,0,0,0.02)" }}>
                    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                      {[0, 1, 2].map((i) => (
                        <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#0F1A0A", animation: "bounce 1s ease-in-out infinite", animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#a1a1aa", paddingLeft: 4 }}>{elapsedSeconds}s...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div style={{ borderTop: "2px solid rgba(0,0,0,0.04)", padding: "16px 24px 24px", flexShrink: 0, background: "#fff", zIndex: 10 }}>
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            {done ? (
              <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#6B7F60" }}>Sesi interview selesai! 🎉</p>
                <button
                  onClick={() => router.push("/result")}
                  style={{ background: "#0F1A0A", color: "#D6FB61", border: "none", borderRadius: 14, padding: "14px 32px", fontSize: 15, fontWeight: 800, cursor: "pointer", transition: "transform 0.15s", boxShadow: "0 4px 14px rgba(15,26,10,0.2)" }}
                  onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.97)"}
                  onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
                >
                  Lihat Hasil & Feedback →
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "#a1a1aa", display: "flex", alignItems: "center", gap: 4, margin: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    Enter untuk kirim · Shift+Enter baris baru · atau jawab pake suara
                  </p>
                  <button
                    onClick={() => { setAutoSend((v) => { autoSendRef.current = !v; return !v; }); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, color: autoSend ? "#0F1A0A" : "#a1a1aa" }}>
                      {autoSend ? "Langsung kirim" : "Koreksi dulu"}
                    </span>
                    <div style={{ width: 40, height: 22, borderRadius: 99, background: autoSend ? "#D6FB61" : "rgba(0,0,0,0.05)", border: autoSend ? "2px solid #0F1A0A" : "2px solid rgba(0,0,0,0.1)", position: "relative", transition: "all 0.2s" }}>
                      <div style={{ position: "absolute", top: 2, left: autoSend ? 18 : 2, width: 14, height: 14, borderRadius: "50%", background: autoSend ? "#0F1A0A" : "rgba(0,0,0,0.2)", transition: "all 0.2s" }} />
                    </div>
                  </button>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => { setInput(e.target.value); resizeTextarea(); }}
                    onKeyDown={handleKeyDown}
                    placeholder={isListening ? "🎤  Lagi dengerin kamu..." : "Tulis jawaban kamu..."}
                    rows={2}
                    disabled={loading}
                    style={{
                      flex: 1, background: "#F4F0E8",
                      border: isListening ? "2px solid #ef4444" : "2px solid transparent",
                      borderRadius: 16, padding: "14px 18px",
                      color: "#0F1A0A", fontSize: 14, lineHeight: 1.6, fontWeight: 600,
                      resize: "none", outline: "none",
                      transition: "border-color 0.2s, height 0.1s",
                      minHeight: 56, maxHeight: 180, overflowY: "auto",
                    }}
                    onFocus={(e) => e.target.style.border = "2px solid #0F1A0A"}
                    onBlur={(e) => e.target.style.border = isListening ? "2px solid #ef4444" : "2px solid transparent"}
                  />

                  <button
                    onClick={toggleMic}
                    disabled={loading}
                    title={isListening ? "Stop recording" : "Voice input"}
                    style={{
                      width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                      background: isListening ? "rgba(239,68,68,0.1)" : "#F4F0E8",
                      border: isListening ? "2px solid #ef4444" : "2px solid transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", color: isListening ? "#ef4444" : "#6B7F60",
                      animation: isListening ? "pulse 1.5s ease-in-out infinite" : "none",
                      transition: "all 0.2s",
                    }}
                  >
                    {isListening ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z" /></svg>
                    )}
                  </button>

                  <button
                    onClick={sendMessage}
                    disabled={loading || !input.trim()}
                    style={{
                      height: 52, padding: "0 24px", borderRadius: 14, flexShrink: 0,
                      background: input.trim() && !loading ? "#0F1A0A" : "rgba(0,0,0,0.05)",
                      border: "none",
                      color: input.trim() && !loading ? "#D6FB61" : "rgba(0,0,0,0.2)",
                      fontSize: 14, fontWeight: 800,
                      cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                      transition: "all 0.2s", display: "flex", alignItems: "center", gap: 8,
                    }}
                  >
                    Kirim
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
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