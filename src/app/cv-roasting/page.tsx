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
const RATE_LIMIT = 2;
const WINDOW_MS = 60 * 60 * 1000;

const VIP_UIDS: string[] = [
    "7fH9uSsGWJeonS7Vb37EBRTyOFs1",
    "omhSJyCzETS24T42AVKMQgBelIC3"
];

// ============================================================
// TYPES
// ============================================================
type DocType = "cv" | "motivation_letter";
type RoastTone = "savage" | "balanced" | "constructive";
type InputMode = "paste" | "upload";
// "idle" = normal kuning/putih
// "loading" = animasi panas kuning -> orange
// "done" = merah
type HeatState = "idle" | "loading" | "done";

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
        await setDoc(ref, { count: 1, windowStart: serverTimestamp() });
        return { allowed: true, remaining: RATE_LIMIT - 1, resetIn: WINDOW_MS };
    }

    if (data.count >= RATE_LIMIT) {
        return { allowed: false, remaining: 0, resetIn: WINDOW_MS - elapsed };
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
    try {
        const res = await fetch(GEMINI_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ history: [{ role: "user", text: prompt }], persona: "default" }),
        });
        const data = await res.json();
        if (!data.error && data.text) return data.text;
        throw new Error(data.error ?? "Gemini error");
    } catch (e) {
        console.warn("Gemini gagal, fallback ke Groq:", e);
    }

    const res = await fetch(GROQ_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: [{ role: "user", text: prompt }], persona: "default" }),
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
        savage: `Roasting dengan gaya SANGAT jujur, pedas, dan tanpa basa-basi, ga usah sok baik, kalau jelek ya jelek titik. Boleh banget kalau mau sarkastik biar makin brutal, karena user yang pilih mode ini pasti udah siap mental buat diroasting sampai ke tulang tulang.`,
        balanced: `Roasting dengan gaya seimbang — jujur tapi tetap sopan. Campur kritik tajam dengan pujian yang jujur.`,
        constructive: `Roasting dengan gaya membangun — kritik semua kelemahan tapi selalu sertakan solusi konkret.`,
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
[3-5 poin kelemahan paling parah ga ketolong yang bikin hrd pengen langsung resign karena capek liatnya, dengan penjelasan kenapa itu masalah]

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
    const [heatState, setHeatState] = useState<HeatState>("idle");

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
        if (!["pdf", "docx"].includes(ext ?? "")) return toast.error("Hanya PDF dan DOCX yang didukung!");

        setFileName(file.name);
        setExtracting(true);
        try {
            const text = ext === "pdf" ? await extractFromPDF(file) : await extractFromDOCX(file);
            if (!text.trim()) throw new Error("Dokumen kosong");
            setRawText(text);
            toast.success("File berhasil dibaca!");
        } catch {
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
        setHeatState("loading");

        try {
            const { allowed, remaining: rem, resetIn } = await checkRateLimit(user.uid);
            if (!allowed) {
                const menit = Math.ceil(resetIn / 60000);
                toast.error(`Limit tercapai! Coba lagi dalam ${menit} menit.`);
                setLoading(false);
                setHeatState("idle");
                return;
            }
            setRemaining(rem);
            const prompt = buildRoastPrompt(textToRoast, docType, tone, target);
            const output = await callAI(prompt);
            setResult(output);
            setHeatState("done");
        } catch (err) {
            console.error(err);
            toast.error("AI error. Coba lagi!");
            setHeatState("idle");
        } finally {
            setLoading(false);
        }
    }

    function handleReset() {
        setResult("");
        setPastedText("");
        setRawText("");
        setFileName("");
        setHeatState("idle");
    }

    const isVIP = user ? VIP_UIDS.includes(user.uid) : false;

    // Dynamic theme tokens berdasarkan heatState
    const theme = {
        idle: {
            pageBg: "#FAFAF7",
            accent: "#D6FB61",
            accentText: "#0F1A0A",
            cardBg: "#FFFFFF",
            headerGlow: "transparent",
            sidebarBg: "#FFFFFF",
            sidebarBorder: "#E5E7EB",
            btnPrimary: "bg-[#0F1A0A] text-[#D6FB61]",
            badge: "border-red-200 bg-red-50 text-red-700",
            glowClass: "",
        },
        loading: {
            pageBg: "#FFF8ED",
            accent: "#FB923C",
            accentText: "#7C2D12",
            cardBg: "#FFFBF5",
            headerGlow: "rgba(251,146,60,0.15)",
            sidebarBg: "#FFFBF5",
            sidebarBorder: "#FED7AA",
            btnPrimary: "bg-orange-500 text-white",
            badge: "border-orange-200 bg-orange-50 text-orange-700",
            glowClass: "glow-orange",
        },
        done: {
            pageBg: "#FFF5F5",
            accent: "#EF4444",
            accentText: "#FFFFFF",
            cardBg: "#FFFFFF",
            headerGlow: "rgba(239,68,68,0.1)",
            sidebarBg: "#FFFFFF",
            sidebarBorder: "#FECACA",
            btnPrimary: "bg-red-600 text-white",
            badge: "border-red-300 bg-red-50 text-red-700",
            glowClass: "glow-red",
        },
    }[heatState];

    return (
        <div
            className="min-h-screen transition-colors duration-700 relative"
            style={{ backgroundColor: theme.pageBg, color: "#0F1A0A" }}
        >
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
                * { font-family: 'Nunito', sans-serif; }

                /* ---- Heat pulse animasi background saat loading ---- */
                @keyframes heatPulse {
                    0%   { background-color: #FAFAF7; }
                    25%  { background-color: #FFF8ED; }
                    50%  { background-color: #FFF0D6; }
                    75%  { background-color: #FFE8C2; }
                    100% { background-color: #FFF8ED; }
                }
                .bg-heat-loading {
                    animation: heatPulse 2.5s ease-in-out infinite;
                }

                /* ---- Glow efek card ---- */
                @keyframes glowOrange {
                    0%   { box-shadow: 0 0 0 0 rgba(251,146,60,0); }
                    50%  { box-shadow: 0 0 40px 8px rgba(251,146,60,0.18); }
                    100% { box-shadow: 0 0 0 0 rgba(251,146,60,0); }
                }
                @keyframes glowRed {
                    0%   { box-shadow: 0 0 20px 4px rgba(239,68,68,0.12); }
                    50%  { box-shadow: 0 0 40px 10px rgba(239,68,68,0.2); }
                    100% { box-shadow: 0 0 20px 4px rgba(239,68,68,0.12); }
                }
                .glow-orange { animation: glowOrange 2s ease-in-out infinite; }
                .glow-red    { animation: glowRed 3s ease-in-out infinite; }

                /* ---- Border top transisi warna ---- */
                .heat-top-idle    { border-top: 4px solid #D6FB61; }
                .heat-top-loading { border-top: 4px solid #FB923C; transition: border-color 0.6s ease; }
                .heat-top-done    { border-top: 4px solid #EF4444; transition: border-color 0.6s ease; }

                /* ---- Loading flame dots ---- */
                @keyframes flameDot {
                    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
                    40%            { transform: scale(1.2); opacity: 1; }
                }
                .flame-dot { display: inline-block; animation: flameDot 1.2s ease-in-out infinite; }
                .flame-dot:nth-child(2) { animation-delay: 0.2s; }
                .flame-dot:nth-child(3) { animation-delay: 0.4s; }

                /* ---- Scrollbar ---- */
                .custom-scroll::-webkit-scrollbar { width: 5px; }
                .custom-scroll::-webkit-scrollbar-track { background: transparent; }
                .custom-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }

                /* ---- Smooth transition semua warna ---- */
                .heat-transition { transition: background-color 0.7s ease, border-color 0.7s ease, color 0.5s ease; }

                /* ---- Fade in result ---- */
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(16px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                .fade-in-up { animation: fadeInUp 0.5s ease forwards; }

                /* ---- Sidebar fixed height ---- */
                .sidebar-sticky {
                    position: sticky;
                    top: 0;
                    height: 100vh;
                    overflow-y: auto;
                }
            `}</style>

            <Toaster position="top-right" toastOptions={{
                style: { background: "#0F1A0A", color: "#D6FB61", borderRadius: "12px", fontWeight: "bold" }
            }} />

            {/* ====== LAYOUT: 2-column ====== */}
            <div className="flex min-h-screen w-full">

                {/* ===== KOLOM KIRI: Form (fixed/sticky) ===== */}
                <div
                    className={`sidebar-sticky w-full max-w-[480px] xl:max-w-[520px] shrink-0 flex flex-col border-r-2 heat-transition ${heatState === "loading" ? "bg-heat-loading" : ""}`}
                    style={{
                        borderRightColor: theme.sidebarBorder,
                        backgroundColor: heatState === "loading" ? undefined : theme.sidebarBg,
                    }}
                >
                    {/* Top accent bar */}
                    <div className={`heat-top-${heatState} heat-transition`} />

                    <div className="flex flex-col flex-1 px-7 py-7 overflow-y-auto custom-scroll">

                        {/* Nav */}
                        <nav className="flex items-center justify-between mb-8">
                            <button
                                onClick={() => router.push("/")}
                                className="flex items-center gap-2 text-gray-500 hover:text-[#0F1A0A] font-bold transition-colors text-sm bg-white border-2 border-gray-200 px-4 py-2 rounded-xl"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="15 18 9 12 15 6" />
                                </svg>
                                Dashboard
                            </button>
                            <span className="font-extrabold text-lg tracking-tight text-[#0F1A0A]">
                                HRD<span style={{ color: heatState === "done" ? "#EF4444" : "#3D6B2C" }} className="heat-transition">.ai</span>
                            </span>
                        </nav>

                        {/* Header */}
                        <div className="mb-7">
                            <div
                                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border-2 text-xs font-bold mb-4 heat-transition`}
                                style={{ borderColor: theme.sidebarBorder, backgroundColor: heatState === "done" ? "#FEF2F2" : heatState === "loading" ? "#FFF7ED" : "#FEF2F2", color: heatState === "done" ? "#B91C1C" : heatState === "loading" ? "#C2410C" : "#B91C1C" }}
                            >
                                <span className="text-sm">🔥</span>
                                CV & Motivation Letter Roaster
                            </div>
                            <h1 className="text-3xl xl:text-4xl font-black tracking-tight mb-2 text-[#0F1A0A]">
                                Roast{" "}
                                <span
                                    className="heat-transition"
                                    style={{ color: heatState === "done" ? "#DC2626" : heatState === "loading" ? "#EA580C" : "#DC2626" }}
                                >
                                    Dokumenmu
                                </span>
                            </h1>
                            <p className="text-gray-500 font-medium text-sm leading-relaxed">
                                Upload CV atau motivation letter kamu, biar AI kasih feedback jujur tanpa basa-basi.
                            </p>

                            {remaining !== null && !isVIP && (
                                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border-2 border-gray-200 bg-white text-gray-600 font-bold text-xs">
                                    <span className={remaining === 0 ? "text-red-500" : "text-[#3D6B2C]"}>●</span>
                                    {remaining === 0 ? "Limit tercapai — coba lagi 1 jam" : `Sisa ${remaining}x jam ini`}
                                </div>
                            )}
                            {isVIP && (
                                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border-2 border-[#0F1A0A] bg-[#D6FB61] text-[#0F1A0A] font-bold text-xs">
                                    👑 VIP — unlimited
                                </div>
                            )}
                        </div>

                        {/* ===== FORM CARD ===== */}
                        <div
                            className={`rounded-[1.75rem] border-2 p-5 xl:p-6 space-y-6 heat-transition ${theme.glowClass}`}
                            style={{ backgroundColor: theme.cardBg, borderColor: theme.sidebarBorder }}
                        >
                            {/* Jenis Dokumen */}
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                                    Jenis Dokumen
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {([
                                        { id: "cv", label: "📄 CV / Resume", desc: "Riwayat hidup" },
                                        { id: "motivation_letter", label: "✉️ Motivation Letter", desc: "Surat lamaran" },
                                    ] as const).map((d) => (
                                        <button key={d.id} onClick={() => setDocType(d.id)}
                                            className={`p-3 rounded-xl border-2 text-left transition-all ${docType === d.id ? "border-[#0F1A0A] bg-[#0F1A0A] text-white" : "border-gray-100 bg-gray-50 hover:border-gray-300 text-[#0F1A0A]"}`}>
                                            <p className="text-xs font-black">{d.label}</p>
                                            <p className={`text-[10px] font-semibold mt-0.5 ${docType === d.id ? "text-gray-300" : "text-gray-400"}`}>{d.desc}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Target */}
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                                    Target Posisi <span className="normal-case font-semibold">(opsional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={target}
                                    onChange={(e) => setTarget(e.target.value)}
                                    placeholder="contoh: Software Engineer, Marketing fresh grad..."
                                    className="w-full rounded-xl px-4 py-3 text-sm font-bold text-[#0F1A0A] placeholder-gray-400 bg-gray-50 border-2 border-gray-100 outline-none focus:border-[#0F1A0A] focus:bg-white transition-all"
                                />
                            </div>

                            {/* Tone */}
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                                    Tone Roasting
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {([
                                        { id: "savage", emoji: "💀", label: "Savage", desc: "Pedas abis" },
                                        { id: "balanced", emoji: "⚖️", label: "Balanced", desc: "Jujur & adil" },
                                        { id: "constructive", emoji: "🌱", label: "Constructive", desc: "Membangun" },
                                    ] as const).map((t) => (
                                        <button key={t.id} onClick={() => setTone(t.id)}
                                            className={`p-2.5 rounded-xl border-2 text-center transition-all ${tone === t.id ? "border-[#0F1A0A] bg-[#0F1A0A] text-white" : "border-gray-100 bg-gray-50 hover:border-gray-300"}`}>
                                            <div className="text-xl mb-1 bg-white inline-block p-1.5 rounded-lg shadow-sm border border-gray-100">{t.emoji}</div>
                                            <p className="text-[10px] font-black">{t.label}</p>
                                            <p className={`text-[9px] font-semibold mt-0.5 ${tone === t.id ? "text-gray-300" : "text-gray-400"}`}>{t.desc}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Input Dokumen */}
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                                    Input Dokumen
                                </label>
                                <div className="flex gap-2 mb-3">
                                    {([
                                        { id: "paste", label: "📝 Paste Teks" },
                                        { id: "upload", label: "📎 Upload File" },
                                    ] as const).map((m) => (
                                        <button key={m.id} onClick={() => setInputMode(m.id)}
                                            className={`text-xs font-bold px-4 py-2 rounded-xl border-2 whitespace-nowrap transition-all ${inputMode === m.id
                                                ? "border-[#0F1A0A] bg-[#D6FB61] text-[#0F1A0A]"
                                                : "border-gray-100 bg-white text-gray-500 hover:border-gray-300"
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
                                        rows={6}
                                        className="custom-scroll w-full rounded-xl px-4 py-3 text-sm font-medium text-[#0F1A0A] placeholder-gray-400 bg-gray-50 border-2 border-gray-100 outline-none focus:border-[#0F1A0A] focus:bg-white resize-none transition-all"
                                    />
                                ) : (
                                    <div>
                                        <input ref={fileRef} type="file" accept=".pdf,.docx" onChange={handleFileUpload} className="hidden" />
                                        <button onClick={() => fileRef.current?.click()}
                                            className={`w-full rounded-xl border-2 border-dashed py-8 flex flex-col items-center gap-2 transition-all ${fileName ? "border-[#3D6B2C] bg-[#D6FB61]/10" : "border-gray-300 hover:border-[#0F1A0A] bg-gray-50"}`}>
                                            {extracting ? (
                                                <>
                                                    <div className="w-6 h-6 border-4 border-gray-200 border-t-[#0F1A0A] rounded-full animate-spin" />
                                                    <p className="text-[#0F1A0A] font-bold text-xs">Membaca file...</p>
                                                </>
                                            ) : fileName ? (
                                                <>
                                                    <span className="text-2xl">✅</span>
                                                    <p className="text-[#0F1A0A] text-xs font-black">{fileName}</p>
                                                    <p className="text-gray-400 font-semibold text-[10px]">Klik untuk ganti</p>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="text-2xl">📂</span>
                                                    <p className="text-[#0F1A0A] font-black text-xs">Klik untuk upload PDF / DOCX</p>
                                                    <p className="text-gray-400 font-semibold text-[10px]">Maks. 5MB</p>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Tombol Roast */}
                            <button
                                onClick={handleRoast}
                                disabled={loading || extracting || (remaining !== null && remaining <= 0)}
                                className={`w-full py-4 rounded-xl font-black text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${loading
                                    ? "bg-orange-500 text-white cursor-not-allowed"
                                    : `${theme.btnPrimary} hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed heat-transition`
                                    }`}
                            >
                                {loading ? (
                                    <span className="flex items-center gap-2">
                                        <span className="text-lg">
                                            <span className="flame-dot">🔥</span>
                                            <span className="flame-dot">🔥</span>
                                            <span className="flame-dot">🔥</span>
                                        </span>
                                        Menyusun kalimat pedas...
                                    </span>
                                ) : (
                                    <>🔥 Roast Sekarang!</>
                                )}
                            </button>
                        </div>

                        <p className="text-center text-gray-400 font-bold text-[10px] mt-6 uppercase tracking-widest">
                            HRD.ai • Made with 🤖🫰
                        </p>
                    </div>
                </div>

                {/* ===== KOLOM KANAN: Hasil (scrollable) ===== */}
                <div
                    className="flex-1 min-w-0 overflow-y-auto custom-scroll heat-transition"
                    style={{ backgroundColor: heatState === "loading" ? "#FFF8ED" : theme.pageBg }}
                >
                    {/* Top accent bar kanan */}
                    <div className={`heat-top-${heatState} heat-transition`} />

                    <div className="px-8 xl:px-12 py-10 max-w-3xl">

                        {/* State: idle — empty state */}
                        {heatState === "idle" && !result && (
                            <div className="flex flex-col items-center justify-center min-h-[70vh] text-center gap-6 select-none">
                                <div className="w-24 h-24 rounded-[2rem] bg-white border-2 border-gray-100 flex items-center justify-center text-5xl shadow-sm">
                                    📋
                                </div>
                                <div>
                                    <p className="text-2xl font-black text-[#0F1A0A] mb-2">Belum ada roasting</p>
                                    <p className="text-gray-400 font-medium text-sm max-w-xs leading-relaxed">
                                        Isi form, tekan <strong className="text-[#0F1A0A]">Roast Sekarang</strong>, dan tunggu feedback jujurnya di sini.
                                    </p>
                                </div>
                                <div className="flex gap-3 mt-2">
                                    {["💀 Savage", "⚖️ Balanced", "🌱 Constructive"].map(tag => (
                                        <span key={tag} className="text-xs font-bold px-3 py-1.5 rounded-full bg-white border-2 border-gray-100 text-gray-500">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* State: loading */}
                        {heatState === "loading" && (
                            <div className="flex flex-col items-center justify-center min-h-[70vh] text-center gap-6">
                                <div className="relative">
                                    <div className="w-20 h-20 rounded-[1.5rem] bg-orange-50 border-2 border-orange-200 flex items-center justify-center text-4xl">
                                        🔥
                                    </div>
                                    {/* Pulse ring */}
                                    <div className="absolute inset-0 rounded-[1.5rem] border-2 border-orange-300 animate-ping opacity-30" />
                                </div>
                                <div>
                                    <p className="text-2xl font-black text-orange-700 mb-2">AI lagi pemanasan...</p>
                                    <p className="text-orange-400 font-medium text-sm max-w-xs leading-relaxed">
                                        Dokumen kamu lagi dibakar habis-habisan. Sabar ya, ini demi kebaikanmu 😈
                                    </p>
                                </div>
                                {/* Animated bar */}
                                <div className="w-48 h-2 bg-orange-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 rounded-full animate-[loadBar_2s_ease-in-out_infinite]"
                                        style={{ width: "60%", animation: "pulse 1.5s ease-in-out infinite" }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* State: done — tampilkan hasil */}
                        {heatState === "done" && result && (
                            <div className="fade-in-up">
                                {/* Result header */}
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl bg-red-50 border-2 border-red-100">
                                            🔥
                                        </div>
                                        <div>
                                            <p className="text-xl font-black text-[#0F1A0A]">Hasil Roasting</p>
                                            <p className="text-xs font-bold text-red-400 uppercase tracking-widest mt-0.5">Powered by AI</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => { navigator.clipboard.writeText(result); toast.success("Disalin!"); }}
                                        className="text-xs font-bold text-gray-500 hover:text-[#0F1A0A] bg-gray-50 hover:bg-gray-100 border-2 border-gray-200 px-4 py-2 rounded-xl transition-all">
                                        Salin Teks
                                    </button>
                                </div>

                                {/* Result content */}
                                <div
                                    className="rounded-[1.75rem] border-2 p-7 xl:p-9 glow-red"
                                    style={{ backgroundColor: theme.cardBg, borderColor: "#FECACA" }}
                                >
                                    <div className="text-[#374151]">
                                        <ReactMarkdown
                                            components={{
                                                h2: ({ children }) => (
                                                    <h2 className="text-lg font-black text-[#0F1A0A] mt-7 mb-3 first:mt-0 flex items-center gap-2">
                                                        {children}
                                                    </h2>
                                                ),
                                                p: ({ children }) => (
                                                    <p className="text-sm font-medium leading-relaxed mb-4 text-gray-700">{children}</p>
                                                ),
                                                li: ({ children }) => (
                                                    <li className="flex gap-3 text-sm font-medium leading-relaxed mb-2 text-gray-700">
                                                        <span className="text-red-400 mt-0.5 shrink-0 text-base leading-none">•</span>
                                                        <span>{children}</span>
                                                    </li>
                                                ),
                                                ul: ({ children }) => <ul className="space-y-1 mb-5">{children}</ul>,
                                                strong: ({ children }) => (
                                                    <strong className="text-[#0F1A0A] font-black bg-red-50 px-1 rounded">{children}</strong>
                                                ),
                                            }}
                                        >
                                            {result}
                                        </ReactMarkdown>
                                    </div>
                                </div>

                                {/* Action buttons */}
                                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                                    <button
                                        onClick={handleReset}
                                        className="flex-1 py-3.5 rounded-xl border-2 border-gray-200 text-gray-600 bg-white text-sm font-black hover:bg-gray-50 hover:border-gray-300 transition-all text-center">
                                        Roast Dokumen Lain
                                    </button>
                                    <button
                                        onClick={() => router.push("/setup")}
                                        className="flex-1 py-3.5 rounded-xl font-black text-sm transition-all hover:-translate-y-0.5 hover:shadow-lg bg-red-600 text-white flex items-center justify-center gap-2">
                                        Lanjut Simulasi Interview
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ===== MOBILE: Single column (< md) ===== */}
            <style>{`
                @media (max-width: 767px) {
                    .sidebar-sticky {
                        position: relative !important;
                        height: auto !important;
                        max-width: 100% !important;
                        overflow-y: visible !important;
                    }
                    /* Di mobile, layout flex jadi column */
                    .flex.min-h-screen.w-full {
                        flex-direction: column !important;
                    }
                    /* Sembunyiin border kanan di mobile */
                    .sidebar-sticky {
                        border-right: none !important;
                        border-bottom: 2px solid #E5E7EB;
                    }
                }
            `}</style>
        </div>
    );
}