"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import ThemeToggle from "@/components/ThemeToggle";

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
      <ul key={key} className="my-1.5 pl-5 flex flex-col gap-1">
        {bulletBuffer.map((item, i) => (
          <li key={i} className="leading-relaxed list-disc marker:text-[#D6FB61]">{renderInline(item)}</li>
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
          <p key={`p-${idx}`} className="my-1 leading-relaxed">
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
      ? <strong key={i} className="font-extrabold text-[#0F1A0A] dark:text-zinc-100">{part.slice(2, -2)}</strong>
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
        * { font-family: 'Nunito', sans-serif; }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-5px); }
        }
        @keyframes pulse-ring {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        #msg-scroll { scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.1) transparent; }
        .dark #msg-scroll { scrollbar-color: rgba(255,255,255,0.15) transparent; }
        #msg-scroll::-webkit-scrollbar { width: 5px; }
        #msg-scroll::-webkit-scrollbar-track { background: transparent; }
        #msg-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 99px; }
        .dark #msg-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); }
        #msg-scroll::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.2); }
        .dark #msg-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }
      `}</style>

      <div className="h-screen flex flex-col bg-[#F4F0E8] dark:bg-zinc-950 overflow-hidden transition-colors duration-300">
        <Toaster position="top-center" toastOptions={{
          className: "dark:bg-zinc-800 dark:text-zinc-100 dark:border dark:border-zinc-700",
        }} />

        <div className="shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-4 bg-white dark:bg-zinc-900 border-b-2 border-gray-100 dark:border-zinc-800 z-10 transition-colors duration-300">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 border-2 border-gray-100 dark:border-zinc-700 flex items-center justify-center cursor-pointer text-[#0F1A0A] dark:text-zinc-100 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <div>
              <p className="text-[15px] font-extrabold text-[#0F1A0A] dark:text-zinc-100 m-0 tracking-tight">
                {config ? `HRD ${config.company}` : "Interview Session"}
              </p>
              <p className="text-xs font-bold text-[#6B7F60] dark:text-[#D6FB61]/80 m-0">
                {config ? `${config.field} · ${config.level}` : "Memuat..."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-3">
              <span className="hidden sm:block text-xs font-bold text-[#6B7F60] dark:text-zinc-400">
                {questionCount}/{MAX_QUESTIONS} pertanyaan
              </span>
              <div className="w-20 h-2 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-[#0F1A0A] dark:bg-[#D6FB61] rounded-full transition-all duration-400" style={{ width: `${progress}%` }} />
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D6FB61] border-2 border-[#0F1A0A]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#0F1A0A]" />
                <span className="text-[11px] font-extrabold text-[#0F1A0A]">Live</span>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>

        <div id="msg-scroll" className="flex-1 overflow-y-auto px-4 sm:px-6 py-7 flex flex-col gap-5">
          <div className="max-w-3xl w-full mx-auto flex flex-col gap-6">
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col gap-1.5 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`flex items-end gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"} w-full`}>
                  {msg.role === "model" && (
                    <div className="w-10 h-10 rounded-xl bg-[#D6FB61] border-2 border-[#0F1A0A] flex items-center justify-center text-xs font-extrabold text-[#0F1A0A] shrink-0 shadow-sm">HR</div>
                  )}
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] px-5 py-4 text-sm font-medium leading-relaxed ${
                      msg.role === "user" 
                        ? "bg-[#0F1A0A] dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-[24px_24px_6px_24px] shadow-[0_4px_14px_rgba(15,26,10,0.15)] dark:shadow-none" 
                        : "bg-white dark:bg-zinc-900 border-2 border-gray-100 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 rounded-[24px_24px_24px_6px] shadow-[0_4px_14px_rgba(0,0,0,0.02)] dark:shadow-none transition-colors duration-300"
                    }`}
                  >
                    {msg.role === "model" ? renderMarkdown(msg.text) : msg.text}
                  </div>
                </div>
                <div className={`flex items-center gap-2 ${msg.role === "model" ? "pl-14" : "pr-2"}`}>
                  <span className="text-[11px] font-bold text-gray-400 dark:text-zinc-500">{msg.time}</span>
                  {msg.role === "model" && i === messages.length - 1 && responseTime !== null && (
                    <span className="text-[10px] font-extrabold text-[#6B7F60] dark:text-[#D6FB61] bg-black/5 dark:bg-white/10 rounded-full px-2 py-0.5">
                      {responseTime}s
                    </span>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-end gap-3 w-full">
                <div className="w-10 h-10 rounded-xl bg-[#D6FB61] border-2 border-[#0F1A0A] flex items-center justify-center text-xs font-extrabold text-[#0F1A0A] shrink-0 shadow-sm">HR</div>
                <div className="flex flex-col gap-1.5">
                  <div className="px-5 py-4 rounded-[24px_24px_24px_6px] bg-white dark:bg-zinc-900 border-2 border-gray-100 dark:border-zinc-800 shadow-[0_4px_14px_rgba(0,0,0,0.02)] transition-colors duration-300">
                    <div className="flex gap-1.5 items-center">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="w-2 h-2 rounded-full bg-[#0F1A0A] dark:bg-zinc-100" style={{ animation: "bounce 1s ease-in-out infinite", animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-gray-400 dark:text-zinc-500 pl-1">{elapsedSeconds}s...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="shrink-0 p-4 sm:p-6 bg-white dark:bg-zinc-900 border-t-2 border-gray-100 dark:border-zinc-800 z-10 transition-colors duration-300">
          <div className="max-w-3xl mx-auto">
            {done ? (
              <div className="text-center flex flex-col items-center gap-4">
                <p className="text-[15px] font-bold text-[#6B7F60] dark:text-[#D6FB61]">Sesi interview selesai! 🎉</p>
                <button
                  onClick={() => router.push("/result")}
                  className="bg-[#0F1A0A] dark:bg-[#D6FB61] text-[#D6FB61] dark:text-[#0F1A0A] rounded-2xl px-8 py-4 text-[15px] font-black cursor-pointer transition-all active:scale-[0.97] shadow-[0_4px_14px_rgba(15,26,10,0.2)] dark:shadow-none hover:-translate-y-1 hover:shadow-lg"
                >
                  Lihat Hasil & Feedback →
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 gap-2">
                  <p className="text-[11px] font-bold text-gray-400 dark:text-zinc-500 flex items-center gap-1.5 m-0">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    Enter untuk kirim · Shift+Enter baris baru · Jawab pakai suara
                  </p>
                  <button
                    onClick={() => { setAutoSend((v) => { autoSendRef.current = !v; return !v; }); }}
                    className="flex items-center gap-2 bg-transparent border-none cursor-pointer p-0"
                  >
                    <span className={`text-xs font-extrabold ${autoSend ? "text-[#0F1A0A] dark:text-[#D6FB61]" : "text-gray-400 dark:text-zinc-500"}`}>
                      {autoSend ? "Langsung kirim" : "Koreksi dulu"}
                    </span>
                    <div className={`w-[38px] h-[22px] rounded-full relative transition-all duration-200 border-2 ${autoSend ? "bg-[#D6FB61] border-[#0F1A0A] dark:border-[#D6FB61] dark:bg-[#D6FB61]/20" : "bg-gray-100 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"}`}>
                      <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all duration-200 ${autoSend ? "left-[18px] bg-[#0F1A0A] dark:bg-[#D6FB61]" : "left-[2px] bg-gray-400 dark:bg-zinc-500"}`} />
                    </div>
                  </button>
                </div>

                <div className="flex gap-2.5 items-end">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => { setInput(e.target.value); resizeTextarea(); }}
                    onKeyDown={handleKeyDown}
                    placeholder={isListening ? "🎤  Lagi dengerin kamu..." : "Tulis jawaban kamu..."}
                    rows={1}
                    disabled={loading}
                    className={`flex-1 rounded-[1.2rem] px-5 py-4 text-sm font-bold leading-relaxed resize-none outline-none transition-all duration-200 min-h-[56px] max-h-[180px] overflow-y-auto ${
                      isListening 
                        ? "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-2 border-red-500 placeholder-red-400 dark:placeholder-red-500/50" 
                        : "bg-[#F4F0E8] dark:bg-zinc-950 text-[#0F1A0A] dark:text-zinc-100 border-2 border-transparent focus:border-[#0F1A0A] dark:focus:border-[#D6FB61] placeholder-gray-400 dark:placeholder-zinc-600"
                    }`}
                  />

                  <button
                    onClick={toggleMic}
                    disabled={loading}
                    title={isListening ? "Stop recording" : "Voice input"}
                    className={`w-[56px] h-[56px] rounded-2xl shrink-0 flex items-center justify-center cursor-pointer transition-all duration-200 border-2 ${
                      isListening 
                        ? "bg-red-100 dark:bg-red-500/20 border-red-500 text-red-600 dark:text-red-400" 
                        : "bg-[#F4F0E8] dark:bg-zinc-950 border-transparent text-[#6B7F60] dark:text-zinc-500 hover:text-[#0F1A0A] dark:hover:text-zinc-300"
                    }`}
                    style={isListening ? { animation: "pulse-ring 1.5s ease-in-out infinite" } : {}}
                  >
                    {isListening ? (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                    ) : (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z" /></svg>
                    )}
                  </button>

                  <button
                    onClick={sendMessage}
                    disabled={loading || !input.trim()}
                    className={`h-[56px] px-6 rounded-2xl shrink-0 text-sm font-extrabold flex items-center gap-2 transition-all duration-200 ${
                      input.trim() && !loading 
                        ? "bg-[#0F1A0A] dark:bg-[#D6FB61] text-[#D6FB61] dark:text-[#0F1A0A] cursor-pointer hover:-translate-y-1 hover:shadow-lg" 
                        : "bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-600 cursor-not-allowed"
                    }`}
                  >
                    <span className="hidden sm:inline">Kirim</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
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