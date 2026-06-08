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
    "omhSJyCzETS24T42AVKMQgBelIC3" //nurainistudy08@gmail.com
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
    const [rawText, setRawText] = useState("");

    useEffect(() => {
        if (!user) return;
        checkRateLimit(user.uid).then(() => {
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
        <div className="min-h-screen bg-[#F4F0E8] text-[#0F1A0A] relative overflow-hidden pb-16">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
                * { font-family: 'Nunito', sans-serif; }
                
                /* Animasi "Suhu Panas" buat elemen dekoratif & border */
                @keyframes heatUpBg {
                    0%   { background-color: rgba(250, 204, 21, 0.15); transform: scale(0.9); } /* Yellow */
                    50%  { background-color: rgba(249, 115, 22, 0.12); transform: scale(1.05); } /* Orange */
                    100% { background-color: rgba(220, 38, 38, 0.1); transform: scale(1); } /* Red */
                }
                
                @keyframes heatUpBorder {
                    0%   { border-top-color: #facc15; } /* Yellow */
                    50%  { border-top-color: #f97316; } /* Orange */
                    100% { border-top-color: #dc2626; } /* Red */
                }

                .heat-blob {
                    animation: heatUpBg 4s ease-in-out forwards;
                }
                
                .heat-border {
                    border-top: 6px solid #facc15;
                    animation: heatUpBorder 4s ease-in-out forwards;
                }

                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.02); borderRadius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); borderRadius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.2); }
            `}</style>

            <Toaster position="top-right" toastOptions={{
                style: { background: "#0F1A0A", color: "#D6FB61", border: "none", borderRadius: "12px", fontWeight: "bold" }
            }} />

            <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">

                <nav className="flex items-center justify-between mb-10">
                    <button onClick={() => router.push("/")}
                        className="flex items-center gap-2 text-gray-500 hover:text-[#0F1A0A] font-bold transition-colors text-sm bg-white border-2 border-gray-200 px-4 py-2 rounded-xl">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                        Dashboard
                    </button>
                    <span className="font-extrabold text-xl tracking-tight text-[#0F1A0A]">
                        HRD<span className="text-[#3D6B2C]">.ai</span>
                    </span>
                </nav>

                <div className="mb-10">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 border-red-200 bg-red-50 text-red-700 text-xs font-bold mb-5">
                        <span className="text-base">🔥</span>
                        CV & Motivation Letter Roaster
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-3 text-[#0F1A0A]">
                        Roast{" "}
                        <span className="text-red-600">
                            Dokumenmu
                        </span>
                    </h1>
                    <p className="text-gray-500 font-medium text-base">Upload CV atau motivation letter kamu, biar AI kasih feedback jujur tanpa basa-basi.</p>

                    {remaining !== null && !isVIP && (
                        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 border-gray-200 bg-white text-gray-600 font-bold text-xs">
                            <span className={remaining === 0 ? "text-red-500" : "text-[#3D6B2C]"}>●</span>
                            {remaining === 0 ? "Limit tercapai — coba lagi 1 jam kemudian" : `Sisa ${remaining}x percobaan jam ini`}
                        </div>
                    )}
                    {isVIP && (
                        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 border-[#0F1A0A] bg-[#D6FB61] text-[#0F1A0A] font-bold text-xs">
                            👑 Akun VIP - unlimited access
                        </div>
                    )}
                </div>

                <div className="rounded-[2rem] border-2 border-gray-100 bg-white p-6 sm:p-8 mb-8 shadow-xl shadow-black/5 space-y-8">

                    <div>
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-3">
                            Jenis Dokumen
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {([
                                { id: "cv", label: "📄 CV / Resume", desc: "Riwayat hidup & pengalaman" },
                                { id: "motivation_letter", label: "✉️ Motivation Letter", desc: "Surat lamaran kerja" },
                            ] as const).map((d) => (
                                <button key={d.id} onClick={() => setDocType(d.id)}
                                    className={`p-4 rounded-2xl border-2 text-left transition-all ${docType === d.id
                                        ? "border-[#0F1A0A] bg-[#0F1A0A] text-white"
                                        : "border-gray-100 bg-gray-50 hover:border-gray-200 text-[#0F1A0A]"
                                        }`}>
                                    <p className="text-sm font-black mb-1">{d.label}</p>
                                    <p className={`text-xs font-semibold ${docType === d.id ? "text-gray-300" : "text-gray-500"}`}>{d.desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-3">
                            Target Posisi / Industri <span className="normal-case font-semibold">(opsional)</span>
                        </label>
                        <input
                            type="text"
                            value={target}
                            onChange={(e) => setTarget(e.target.value)}
                            placeholder="contoh: Software Engineer di startup, Marketing fresh grad..."
                            className="w-full rounded-2xl px-5 py-4 text-sm font-bold text-[#0F1A0A] placeholder-gray-400 bg-gray-50 border-2 border-gray-100 outline-none focus:border-[#0F1A0A] focus:bg-white transition-all"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-3">
                            Tone Roasting
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {([
                                { id: "savage", emoji: "💀", label: "Savage", desc: "Pedas abis" },
                                { id: "balanced", emoji: "⚖️", label: "Balanced", desc: "Jujur & adil" },
                                { id: "constructive", emoji: "🌱", label: "Constructive", desc: "Membangun" },
                            ] as const).map((t) => (
                                <button key={t.id} onClick={() => setTone(t.id)}
                                    className={`p-3 rounded-2xl border-2 text-center transition-all ${tone === t.id
                                        ? "border-[#0F1A0A] bg-[#0F1A0A] text-white"
                                        : "border-gray-100 bg-gray-50 hover:border-gray-200 text-[#0F1A0A]"
                                        }`}>
                                    <div className="text-2xl mb-2 bg-white inline-block p-2 rounded-xl shadow-sm border border-gray-100">{t.emoji}</div>
                                    <p className="text-xs font-black">{t.label}</p>
                                    <p className={`text-[10px] font-semibold mt-1 hidden sm:block ${tone === t.id ? "text-gray-300" : "text-gray-500"}`}>{t.desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-3">
                            Input Dokumen
                        </label>
                        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-none pb-1">
                            {([
                                { id: "paste", label: "📝 Paste Teks" },
                                { id: "upload", label: "📎 Upload File" },
                            ] as const).map((m) => (
                                <button key={m.id} onClick={() => setInputMode(m.id)}
                                    className={`text-sm font-bold px-5 py-3 rounded-xl border-2 whitespace-nowrap transition-all ${inputMode === m.id
                                        ? "border-[#0F1A0A] bg-[#D6FB61] text-[#0F1A0A]"
                                        : "border-gray-100 bg-white text-gray-500 hover:border-gray-200 hover:text-[#0F1A0A]"
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
                                rows={8}
                                className="custom-scrollbar w-full rounded-2xl px-5 py-4 text-sm font-medium text-[#0F1A0A] placeholder-gray-400 bg-gray-50 border-2 border-gray-100 outline-none focus:border-[#0F1A0A] focus:bg-white resize-none transition-all"
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
                                    className={`w-full rounded-2xl border-2 border-dashed py-12 flex flex-col items-center gap-3 transition-all ${fileName
                                        ? "border-[#3D6B2C] bg-[#D6FB61]/20"
                                        : "border-gray-300 hover:border-[#0F1A0A] bg-gray-50"
                                        }`}>
                                    {extracting ? (
                                        <>
                                            <div className="w-8 h-8 border-4 border-gray-200 border-t-[#0F1A0A] rounded-full animate-spin" />
                                            <p className="text-[#0F1A0A] font-bold text-sm mt-2">Membaca file...</p>
                                        </>
                                    ) : fileName ? (
                                        <>
                                            <span className="text-4xl bg-white p-3 rounded-2xl shadow-sm border border-gray-100">✅</span>
                                            <p className="text-[#0F1A0A] text-sm font-black mt-2">{fileName}</p>
                                            <p className="text-gray-500 font-semibold text-xs">Klik untuk ganti file</p>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-4xl bg-white p-3 rounded-2xl shadow-sm border border-gray-100">📂</span>
                                            <p className="text-[#0F1A0A] font-black text-sm mt-2">Klik untuk upload PDF atau DOCX</p>
                                            <p className="text-gray-500 font-semibold text-xs">Maks. ukuran yang dianjurkan: 5MB</p>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleRoast}
                        disabled={loading || extracting || (remaining !== null && remaining <= 0)}
                        className={`w-full py-4 rounded-2xl font-black text-base transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${loading ? "bg-gray-200 text-gray-500 cursor-not-allowed" : "bg-[#0F1A0A] text-[#D6FB61] hover:-translate-y-1 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"}`}
                    >
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-4 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                                Menyusun kalimat pedas...
                            </>
                        ) : (
                            <>🔥 Roast Sekarang!</>
                        )}
                    </button>
                </div>

                {result && (
                    <div id="roast-result" className="relative mt-12">
                        {/* Background blob transisi panas */}
                        <div className="absolute -inset-4 rounded-[3rem] heat-blob blur-2xl -z-10" />

                        <div className="rounded-[2.5rem] bg-white shadow-2xl shadow-red-900/5 heat-border overflow-hidden relative">
                            <div className="p-8 sm:p-10">
                                <div className="flex items-center justify-between mb-8 pb-6 border-b-2 border-gray-100">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl bg-red-50 border-2 border-red-100">
                                            🔥
                                        </div>
                                        <div>
                                            <p className="text-lg font-black text-[#0F1A0A] tracking-tight">Hasil Roasting</p>
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Powered by AI</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(result);
                                            toast.success("Disalin ke clipboard!");
                                        }}
                                        className="text-xs font-bold text-gray-500 hover:text-[#0F1A0A] bg-gray-50 hover:bg-gray-100 border-2 border-gray-200 px-4 py-2 rounded-xl transition-all">
                                        Salin Teks
                                    </button>
                                </div>

                                <div className="text-[#374151]">
                                    <ReactMarkdown
                                        components={{
                                            h2: ({ children }) => (
                                                <h2 className="text-xl font-black text-[#0F1A0A] mt-8 mb-3 first:mt-0 flex items-center gap-2">
                                                    {children}
                                                </h2>
                                            ),
                                            p: ({ children }) => (
                                                <p className="text-sm font-medium leading-relaxed mb-4 text-gray-700">{children}</p>
                                            ),
                                            li: ({ children }) => (
                                                <li className="flex gap-3 text-sm font-medium leading-relaxed mb-2 text-gray-700">
                                                    <span className="text-red-500 mt-0.5 shrink-0 text-lg leading-none">•</span>
                                                    <span>{children}</span>
                                                </li>
                                            ),
                                            ul: ({ children }) => <ul className="space-y-2 mb-6">{children}</ul>,
                                            strong: ({ children }) => <strong className="text-[#0F1A0A] font-black bg-red-50 px-1 rounded">{children}</strong>,
                                        }}
                                    >
                                        {result}
                                    </ReactMarkdown>
                                </div>

                                <div className="mt-10 pt-8 border-t-2 border-gray-100 flex flex-col sm:flex-row gap-4">
                                    <button
                                        onClick={() => { setResult(""); setPastedText(""); setRawText(""); setFileName(""); }}
                                        className="flex-1 py-4 rounded-xl border-2 border-gray-200 text-gray-600 bg-white text-sm font-black hover:bg-gray-50 hover:border-gray-300 transition-all text-center">
                                        Roast Dokumen Lain
                                    </button>
                                    <button
                                        onClick={() => router.push("/setup")}
                                        className="flex-1 py-4 rounded-xl font-black text-sm transition-all hover:-translate-y-1 hover:shadow-lg bg-[#0F1A0A] text-[#D6FB61] flex items-center justify-center gap-2">
                                        Lanjut Simulasi Interview
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <p className="text-center text-gray-400 font-bold text-xs mt-12 uppercase tracking-widest">
                    HRD.ai • Made with 🤖🫰
                </p>
            </div>
        </div>
    );
}