"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import ReactMarkdown from "react-markdown";
import {
    doc, getDoc, setDoc, serverTimestamp, Timestamp,
} from "firebase/firestore";
import toast, { Toaster } from "react-hot-toast";

// ============================================================
// CONFIG
// ============================================================
const GEMINI_API = "https://radya.my.id/api/chat/gemini";
const GROQ_API = "https://radya.my.id/api/chat/groq";
const RATE_LIMIT = 2;       // max request per window
const WINDOW_MS = 60 * 60 * 1000; // 1 jam

// Akun bebas limit — isi dengan Firebase UID
const VIP_UIDS: string[] = [
    "7fH9uSsGWJeonS7Vb37EBRTyOFs1", //radyaiftikhar@gmail.com
    // "omhSJyCzETS24T42AVKMQgBelIC3" //nurainistudy08@gmail.com

];

// ============================================================
// TYPES
// ============================================================
type DocType = "cv" | "motivation_letter";
type RoastTone = "savage" | "balanced" | "constructive";
type InputMode = "paste" | "upload";

// ============================================================
// RATE LIMIT HELPER
// ============================================================
async function checkRateLimit(uid: string): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
    if (VIP_UIDS.includes(uid)) return { allowed: true, remaining: 999, resetIn: 0 };

    const ref = doc(db, "users", uid, "rateLimit", "cv_roast");
    const snap = await getDoc(ref);

    const now = Date.now();

    if (!snap.exists()) {
        await setDoc(ref, { count: 1, windowStart: serverTimestamp() });
        return { allowed: true, remaining: RATE_LIMIT - 1, resetIn: WINDOW_MS };
    }

    const data = snap.data();
    const windowStart = (data.windowStart as Timestamp).toMillis();
    const elapsed = now - windowStart;

    if (elapsed > WINDOW_MS) {
        // Reset window
        await setDoc(ref, { count: 1, windowStart: serverTimestamp() });
        return { allowed: true, remaining: RATE_LIMIT - 1, resetIn: WINDOW_MS };
    }

    if (data.count >= RATE_LIMIT) {
        const resetIn = WINDOW_MS - elapsed;
        return { allowed: false, remaining: 0, resetIn };
    }

    await setDoc(ref, { count: data.count + 1, windowStart: data.windowStart });
    return { allowed: true, remaining: RATE_LIMIT - data.count - 1, resetIn: WINDOW_MS - elapsed };
}

// ============================================================
// TEXT EXTRACTION
// ============================================================
async function extractFromPDF(file: File): Promise<string> {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.mjs",
        import.meta.url
    ).toString();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = "";

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: unknown) => (item as { str: string }).str).join(" ") + "\n";
    }

    return text.trim();
}

async function extractFromDOCX(file: File): Promise<string> {
    const mammoth = await import("mammoth");
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim();
}

// ============================================================
// AI CALL w/ FALLBACK
// ============================================================
async function callAI(prompt: string): Promise<string> {
    // Try Gemini first
    try {
        const res = await fetch(GEMINI_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                history: [{ role: "user", text: prompt }],
                persona: "default",
            }),
        });
        const data = await res.json();
        if (!data.error && data.text) return data.text;
        throw new Error(data.error ?? "Gemini error");
    } catch (e) {
        console.warn("Gemini gagal, fallback ke Groq:", e);
    }

    // Fallback: Groq
    const res = await fetch(GROQ_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            history: [{ role: "user", text: prompt }],
            persona: "default",
        }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.text;
}

// ============================================================
// BUILD PROMPT
// ============================================================
function buildRoastPrompt(text: string, docType: DocType, tone: RoastTone, target: string): string {
    const docLabel = docType === "cv" ? "CV / Resume" : "Motivation Letter";

    const toneInstructions: Record<RoastTone, string> = {
        savage: `Roasting dengan gaya SANGAT jujur, pedas, dan tanpa basa-basi. Boleh sedikit sarkastik tapi tetap konstruktif di bagian akhir. Anggap kamu HRD yang udah capek liat CV jelek seharian.`,
        balanced: `Roasting dengan gaya seimbang — jujur tapi tetap sopan. Campur kritik tajam dengan pujian yang jujur. Nada profesional tapi tetap engaging.`,
        constructive: `Roasting dengan gaya membangun — kritik semua kelemahan tapi selalu sertakan solusi konkret. Nada mentor yang peduli tapi jujur.`,
    };

    return `Kamu adalah career coach dan roaster profesional yang ahli di bidang rekrutmen.

DOKUMEN YANG DIANALISIS: ${docLabel}
TARGET POSISI/INDUSTRI: ${target || "Umum"}
GAYA ROASTING: ${toneInstructions[tone]}

ISI DOKUMEN:
---
${text.slice(0, 6000)}
---

Berikan roasting yang komprehensif dengan format MARKDOWN seperti ini:

## 💀 First Impression
[Kesan pertama HRD dalam 5 detik lihat dokumen ini]

## 🔥 KACAUU
[3-5 poin kelemahan paling parah, dengan penjelasan kenapa itu masalah]

## ✅ Sudah okelah~
[2-3 hal yang sudah bagus atau bisa diselamatkan]

## 🚑 Rekomendasi
[3-5 saran konkret yang HARUS diperbaiki sebelum dikirim ke mana pun]

## 🎯 Verdict
[Kesimpulan 2-3 kalimat: layak kirim atau perlu revisi total?]

Gunakan bahasa Indonesia yang natural, tidak kaku, dan sesuai tone yang diminta.`;
}

// ============================================================
// RESULT RENDERER (Markdown sederhana)
// ============================================================
function RoastResult({ text }: { text: string }) {
    const lines = text.split("\n");

    return (
        <div className="space-y-1">
            {lines.map((line, i) => {
                if (line.startsWith("## ")) {
                    return (
                        <h3 key={i} className="text-base font-bold text-white mt-6 mb-2 first:mt-0">
                            {line.replace("## ", "")}
                        </h3>
                    );
                }
                if (line.startsWith("- ") || line.startsWith("* ")) {
                    return (
                        <div key={i} className="flex gap-2 text-sm text-white/70 leading-relaxed">
                            <span className="text-purple-400 mt-0.5 shrink-0">•</span>
                            <span>{line.replace(/^[-*] /, "")}</span>
                        </div>
                    );
                }
                if (line.trim() === "") return <div key={i} className="h-1" />;
                return (
                    <p key={i} className="text-sm text-white/70 leading-relaxed">{line}</p>
                );
            })}
        </div>
    );
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function CVRoastPage() {
    const router = useRouter();
    const fileRef = useRef<HTMLInputElement>(null);
    const user = auth.currentUser;

    const [inputMode, setInputMode] = useState<InputMode>("paste");
    const [pastedText, setPastedText] = useState("");
    const [fileName, setFileName] = useState("");
    const [docType, setDocType] = useState<DocType>("cv");
    const [tone, setTone] = useState<RoastTone>("balanced");
    const [target, setTarget] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState("");
    const [remaining, setRemaining] = useState<number | null>(null);
    const [extracting, setExtracting] = useState(false);
    const [rawText, setRawText] = useState(""); // teks dari file

    useEffect(() => {
        if (!user) return;
        // Load sisa limit
        checkRateLimit(user.uid).then(() => {
            // Just peek — we'll re-check on submit
            // To just show remaining without consuming, we do a read-only check
            const ref = doc(db, "users", user.uid, "rateLimit", "cv_roast");
            getDoc(ref).then((snap) => {
                if (VIP_UIDS.includes(user.uid)) { setRemaining(999); return; }
                if (!snap.exists()) { setRemaining(RATE_LIMIT); return; }
                const data = snap.data();
                const elapsed = Date.now() - (data.windowStart as Timestamp).toMillis();
                if (elapsed > WINDOW_MS) { setRemaining(RATE_LIMIT); return; }
                setRemaining(Math.max(0, RATE_LIMIT - data.count));
            });
        });
    }, [user]);

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        const ext = file.name.split(".").pop()?.toLowerCase();
        if (!["pdf", "docx"].includes(ext ?? "")) {
            return toast.error("Hanya PDF dan DOCX yang didukung!");
        }

        setFileName(file.name);
        setExtracting(true);
        try {
            const text = ext === "pdf"
                ? await extractFromPDF(file)
                : await extractFromDOCX(file);

            if (!text.trim()) throw new Error("Dokumen kosong atau tidak bisa dibaca");
            setRawText(text);
            toast.success("File berhasil dibaca!");
        } catch (err) {
            toast.error("Gagal baca file. Coba paste teks manual.");
            setFileName("");
        } finally {
            setExtracting(false);
        }
    }

    async function handleRoast() {
        if (!user) return router.replace("/login");

        const textToRoast = inputMode === "paste" ? pastedText : rawText;
        if (!textToRoast.trim()) return toast.error("Isi dokumennya dulu!");
        if (textToRoast.trim().length < 50) return toast.error("Teksnya terlalu pendek bro!");

        setLoading(true);
        setResult("");

        try {
            // Rate limit check
            const { allowed, remaining: rem, resetIn } = await checkRateLimit(user.uid);
            if (!allowed) {
                const menit = Math.ceil(resetIn / 60000);
                toast.error(`Limit tercapai! Coba lagi dalam ${menit} menit.`);
                setLoading(false);
                return;
            }
            setRemaining(rem);

            const prompt = buildRoastPrompt(textToRoast, docType, tone, target);
            const output = await callAI(prompt);
            setResult(output);

            // Scroll ke result
            setTimeout(() => {
                document.getElementById("roast-result")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 100);
        } catch (err) {
            console.error(err);
            toast.error("AI error. Coba lagi!");
        } finally {
            setLoading(false);
        }
    }

    const isVIP = user ? VIP_UIDS.includes(user.uid) : false;

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white">
            <Toaster position="top-right" toastOptions={{
                style: { background: "#1a1a2e", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" }
            }} />

            {/* Aurora */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-40 left-1/4 w-[500px] h-[500px] rounded-full opacity-15"
                    style={{ background: "radial-gradient(circle, #dc2626, transparent 70%)" }} />
                <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full opacity-10"
                    style={{ background: "radial-gradient(circle, #7c3aed, transparent 70%)" }} />
                <div className="absolute inset-0 opacity-[0.025]"
                    style={{
                        backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
                        backgroundSize: "60px 60px"
                    }} />
            </div>

            <div className="relative z-10 max-w-3xl mx-auto px-6 py-10">

                {/* Navbar */}
                <nav className="flex items-center justify-between mb-12">
                    <button onClick={() => router.push("/")}
                        className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                        Dashboard
                    </button>
                    <span className="font-bold text-lg tracking-tight">HRD<span className="text-purple-400">.ai</span></span>
                </nav>

                {/* Header */}
                <div className="mb-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-500/30 bg-red-500/10 text-red-300 text-xs font-medium mb-5">
                        <span className="text-base">🔥</span>
                        CV & Motivation Letter Roaster
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-3">
                        Roast{" "}
                        <span style={{ background: "linear-gradient(90deg, #f87171, #fb923c)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                            Dokumenmu
                        </span>
                    </h1>
                    <p className="text-white/40 text-base">Upload CV atau motivation letter kamu, biar AI kasih feedback jujur tanpa basa-basi.</p>
                    {/* <p className="text-white/40 text-base">Kami tidak menyimpan file kamu.</p> */}

                    {/* Rate limit badge */}
                    {remaining !== null && !isVIP && (
                        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-white/50 text-xs">
                            <span className={remaining === 0 ? "text-red-400" : "text-emerald-400"}>●</span>
                            {remaining === 0 ? "Limit tercapai — coba lagi 1 jam kemudian" : `Sisa ${remaining}x percobaan jam ini`}
                        </div>
                    )}
                    {isVIP && (
                        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs">
                            👑 Akun VIP - unlimited access
                        </div>
                    )}
                </div>

                {/* Setup card */}
                <div className="rounded-3xl border border-white/[0.07] p-6 sm:p-8 mb-6 space-y-6"
                    style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(12px)" }}>

                    {/* Doc type */}
                    <div>
                        <label className="text-xs font-semibold text-white/30 uppercase tracking-widest block mb-3">
                            Jenis Dokumen
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            {([
                                { id: "cv", label: "📄 CV / Resume", desc: "Riwayat hidup & pengalaman" },
                                { id: "motivation_letter", label: "✉️ Motivation Letter", desc: "Surat lamaran kerja" },
                            ] as const).map((d) => (
                                <button key={d.id} onClick={() => setDocType(d.id)}
                                    className={`p-4 rounded-2xl border text-left transition-all ${docType === d.id
                                        ? "border-red-400/60 bg-red-500/10 ring-2 ring-red-500/10"
                                        : "border-white/08 hover:border-white/20"
                                        }`}
                                    style={{ background: docType === d.id ? undefined : "rgba(255,255,255,0.02)" }}>
                                    <p className={`text-sm font-semibold mb-0.5 ${docType === d.id ? "text-white" : "text-white/60"}`}>{d.label}</p>
                                    <p className="text-xs text-white/30">{d.desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Target */}
                    <div>
                        <label className="text-xs font-semibold text-white/30 uppercase tracking-widest block mb-3">
                            Target Posisi / Industri <span className="text-white/20 normal-case font-normal">(opsional)</span>
                        </label>
                        <input
                            type="text"
                            value={target}
                            onChange={(e) => setTarget(e.target.value)}
                            placeholder="contoh: Software Engineer di startup, Marketing fresh grad..."
                            className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none border border-white/10 focus:border-red-500/40 focus:ring-2 focus:ring-red-500/10 transition-all"
                            style={{ background: "rgba(255,255,255,0.04)" }}
                        />
                    </div>

                    {/* Tone */}
                    <div>
                        <label className="text-xs font-semibold text-white/30 uppercase tracking-widest block mb-3">
                            Tone Roasting
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {([
                                { id: "savage", emoji: "💀", label: "Savage", desc: "Pedas abis" },
                                { id: "balanced", emoji: "⚖️", label: "Balanced", desc: "Jujur & adil" },
                                { id: "constructive", emoji: "🌱", label: "Constructive", desc: "Membangun" },
                            ] as const).map((t) => (
                                <button key={t.id} onClick={() => setTone(t.id)}
                                    className={`p-3 rounded-xl border text-center transition-all ${tone === t.id
                                        ? "border-orange-400/60 bg-orange-500/10 ring-2 ring-orange-500/10"
                                        : "border-white/08 hover:border-white/20"
                                        }`}
                                    style={{ background: tone === t.id ? undefined : "rgba(255,255,255,0.02)" }}>
                                    <div className="text-xl mb-1">{t.emoji}</div>
                                    <p className={`text-xs font-semibold ${tone === t.id ? "text-white" : "text-white/60"}`}>{t.label}</p>
                                    <p className="text-[10px] text-white/30 mt-0.5">{t.desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Input mode toggle */}
                    <div>
                        <label className="text-xs font-semibold text-white/30 uppercase tracking-widest block mb-3">
                            Input Dokumen
                        </label>
                        <div className="flex gap-2 mb-4">
                            {([
                                { id: "paste", label: "📝 Paste Teks" },
                                { id: "upload", label: "📎 Upload File" },
                            ] as const).map((m) => (
                                <button key={m.id} onClick={() => setInputMode(m.id)}
                                    className={`text-sm px-4 py-2 rounded-xl border transition-all ${inputMode === m.id
                                        ? "border-white/30 bg-white/10 text-white font-medium"
                                        : "border-white/08 text-white/40 hover:text-white/70"
                                        }`}>
                                    {m.label}
                                </button>
                            ))}
                        </div>

                        {inputMode === "paste" ? (
                            <textarea
                                value={pastedText}
                                onChange={(e) => setPastedText(e.target.value)}
                                placeholder="Paste isi CV atau motivation letter kamu di sini..."
                                rows={10}
                                className="custom-scrollbar w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none border border-white/10 focus:border-red-500/40 focus:ring-2 focus:ring-red-500/10 resize-none transition-all"
                                style={{ background: "rgba(255,255,255,0.04)" }}
                            />
                        ) : (
                            <div>
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept=".pdf,.docx"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                                <button onClick={() => fileRef.current?.click()}
                                    className={`w-full rounded-2xl border-2 border-dashed py-10 flex flex-col items-center gap-3 transition-all ${fileName
                                        ? "border-emerald-500/40 bg-emerald-500/5"
                                        : "border-white/10 hover:border-white/20 bg-white/[0.02]"
                                        }`}>
                                    {extracting ? (
                                        <>
                                            <div className="w-6 h-6 border-2 border-white/20 border-t-red-400 rounded-full animate-spin" />
                                            <p className="text-white/40 text-sm">Membaca file...</p>
                                        </>
                                    ) : fileName ? (
                                        <>
                                            <span className="text-3xl">✅</span>
                                            <p className="text-emerald-300 text-sm font-medium">{fileName}</p>
                                            <p className="text-white/30 text-xs">Klik untuk ganti file</p>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-3xl">📂</span>
                                            <p className="text-white/50 text-sm">Klik untuk upload PDF atau DOCX</p>
                                            <p className="text-white/20 text-xs">Maks. ukuran yang dianjurkan: 5MB</p>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Submit */}
                    <button
                        onClick={handleRoast}
                        disabled={loading || extracting || (remaining !== null && remaining <= 0)}
                        className="w-full py-4 rounded-2xl font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:opacity-90"
                        style={{ background: "linear-gradient(135deg, #dc2626, #ea580c)" }}
                    >
                        {loading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                AI lagi baca dokumenmu...
                            </>
                        ) : (
                            <>🔥 Roast Sekarang!</>
                        )}
                    </button>
                </div>

                {/* Result */}
                {result && (
                    <div id="roast-result"
                        className="rounded-3xl border border-white/[0.07] p-6 sm:p-8"
                        style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(12px)" }}>
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                                    style={{ background: "linear-gradient(135deg, #dc2626, #ea580c)" }}>
                                    🔥
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white">Hasil Roasting</p>
                                    <p className="text-xs text-white/30">Powered by AI</p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(result);
                                    toast.success("Disalin!");
                                }}
                                className="text-xs text-white/30 hover:text-white/70 border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition-all">
                                Salin
                            </button>
                        </div>

                        <ReactMarkdown
                            components={{
                                h2: ({ children }) => (
                                    <h2 className="text-base font-bold text-white mt-6 mb-2 first:mt-0">{children}</h2>
                                ),
                                p: ({ children }) => (
                                    <p className="text-sm text-white/70 leading-relaxed mb-2">{children}</p>
                                ),
                                li: ({ children }) => (
                                    <li className="flex gap-2 text-sm text-white/70 leading-relaxed mb-1">
                                        <span className="text-red-400 mt-0.5 shrink-0">•</span>
                                        <span>{children}</span>
                                    </li>
                                ),
                                ul: ({ children }) => <ul className="space-y-1 mb-3">{children}</ul>,
                                strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                            }}
                        >
                            {result}
                        </ReactMarkdown>
                        <div className="mt-8 pt-6 border-t border-white/[0.06] flex gap-3">
                            <button
                                onClick={() => { setResult(""); setPastedText(""); setRawText(""); setFileName(""); }}
                                className="flex-1 py-3 rounded-xl border border-white/10 text-white/50 text-sm font-medium hover:bg-white/5 transition-all">
                                Roast Lagi
                            </button>
                            <button
                                onClick={() => router.push("/setup")}
                                className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
                                style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}>
                                Coba Interview →
                            </button>
                        </div>
                    </div>
                )}

                <p className="text-center text-white/10 text-xs mt-12">
                    HRD.ai
                </p>
            </div>
        </div>
    );
}