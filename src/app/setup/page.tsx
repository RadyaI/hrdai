"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import toast, { Toaster } from "react-hot-toast";

const FIELDS: { category: string; items: string[] }[] = [
  {
    category: "💻 Tech",
    items: [
      "Software Engineering", "Frontend Development", "Backend Development",
      "Mobile Development", "DevOps / Cloud", "Data Science", "Data Engineering",
      "Machine Learning / AI", "Cybersecurity", "QA / Quality Assurance",
    ],
  },
  {
    category: "🎨 Product & Design",
    items: ["Product Management", "UI/UX Design", "Graphic Design"],
  },
  {
    category: "📊 Business",
    items: [
      "Business Analyst", "Project Management", "Consulting",
      "Marketing Digital", "Content & Social Media", "Sales", "Business Development",
    ],
  },
  {
    category: "💰 Finance & HR",
    items: ["Finance & Accounting", "Human Resources", "Legal"],
  },
  {
    category: "🚚 Other",
    items: ["Logistics & Supply Chain", "Customer Service"],
  },
];

const LEVELS = [
  { id: "Internship / Magang", icon: "🌱", desc: "Belum ada pengalaman kerja" },
  { id: "Fresh Graduate", icon: "🎓", desc: "Baru lulus, 0–1 tahun" },
  { id: "Junior (1–2 thn)", icon: "🚀", desc: "Mulai membangun karir" },
  { id: "Mid-level (3–5 thn)", icon: "⚡", desc: "Sudah berpengalaman" },
  { id: "Senior (5+ thn)", icon: "👑", desc: "Expert di bidangnya" },
];

const PERSONALITIES = [
  { id: "friendly", emoji: "😊", label: "Ramah", desc: "Santai & suportif", color: "emerald" },
  { id: "neutral", emoji: "🧑‍💼", label: "Netral", desc: "Profesional, standar", color: "blue" },
  { id: "critical", emoji: "🔍", label: "Kritis", desc: "Tajam & pressure tinggi", color: "amber" },
  { id: "formal", emoji: "👔", label: "Formal", desc: "Kaku & korporat banget", color: "purple" },
];

const COMPANY_PRESETS: Record<string, string[]> = {
  "🇮🇩 Startup": [
    "Gojek", "Tokopedia", "Shopee", "Traveloka", "Bukalapak",
    "Tiket.com", "Koinworks", "Xendit", "Ruangguru", "Flip",
    "Stockbit", "Midtrans", "Modalku", "Kata.ai", "Zenius",
  ],
  "🏦 BUMN": [
    "Pertamina", "Bank BRI", "Bank BNI", "Bank Mandiri", "Bank BCA",
    "Telkom Indonesia", "PLN", "Astra International", "Unilever Indonesia",
    "Indofood", "Garuda Indonesia", "BPJS Ketenagakerjaan",
  ],
  "🌍 Global": [
    "Google", "Microsoft", "Meta", "Amazon", "Apple",
    "Netflix", "Grab", "Sea Group", "ByteDance / TikTok",
    "McKinsey", "Deloitte", "Accenture", "IBM", "Oracle",
  ],
  "🎮 Gaming": [
    "Riot Games", "Ubisoft", "Garena", "VNG",
    "Agate Studio", "Touchten Games", "Lyto Game",
  ],
};

const colorMap: Record<string, string> = {
  emerald: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  blue: "border-blue-500/40 bg-blue-500/10 text-blue-300",
  amber: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  purple: "border-purple-500/40 bg-purple-500/10 text-purple-300",
};

const colorMapSelected: Record<string, string> = {
  emerald: "border-emerald-400 bg-emerald-500/20 ring-2 ring-emerald-500/20",
  blue: "border-blue-400 bg-blue-500/20 ring-2 ring-blue-500/20",
  amber: "border-amber-400 bg-amber-500/20 ring-2 ring-amber-500/20",
  purple: "border-purple-400 bg-purple-500/20 ring-2 ring-purple-500/20",
};

// Step indicator
function StepDot({ active, done, n }: { active: boolean; done: boolean; n: number }) {
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
      done ? "bg-purple-500 text-white" :
      active ? "bg-white text-zinc-900" :
      "bg-white/10 text-white/30"
    }`}>
      {done ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : n}
    </div>
  );
}

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0=company, 1=field, 2=level, 3=personality
  const [company, setCompany] = useState("");
  const [field, setField] = useState("");
  const [level, setLevel] = useState("");
  const [personality, setPersonality] = useState("neutral");
  const [activeGroup, setActiveGroup] = useState(Object.keys(COMPANY_PRESETS)[0]);
  const [activeFieldCat, setActiveFieldCat] = useState(0);

  const steps = ["Perusahaan", "Posisi", "Level", "HRD Style"];

  function next() {
    if (step === 0 && !company.trim()) return toast.error("Isi nama perusahaan dulu!");
    if (step === 1 && !field) return toast.error("Pilih bidang posisi dulu!");
    if (step === 2 && !level) return toast.error("Pilih level dulu!");
    if (step < 3) setStep(step + 1);
    else handleStart();
  }

  function handleStart() {
    if (!auth.currentUser) return router.replace("/login");
    sessionStorage.setItem("interview_config", JSON.stringify({ company, field, level, personality }));
    router.push("/session");
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <Toaster position="top-center" toastOptions={{
        style: { background: "#1a1a2e", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" }
      }} />

      {/* Aurora */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-60 right-0 w-[500px] h-[500px] rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #7c3aed, transparent 70%)" }} />
        <div className="absolute bottom-0 -left-20 w-[400px] h-[400px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #2563eb, transparent 70%)" }} />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-6 py-10">

        {/* Top nav */}
        <div className="flex items-center justify-between mb-10">
          <button onClick={() => step > 0 ? setStep(step - 1) : router.push("/")}
            className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {step > 0 ? "Kembali" : "Dashboard"}
          </button>

          <span className="font-bold text-lg tracking-tight">HRD<span className="text-purple-400">.ai</span></span>
        </div>

        {/* Step progress */}
        <div className="flex items-center gap-2 mb-10">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className="flex flex-col items-center gap-1">
                <StepDot active={i === step} done={i < step} n={i + 1} />
                <span className={`text-[10px] hidden sm:block transition-colors ${i === step ? "text-white" : i < step ? "text-purple-400" : "text-white/20"}`}>
                  {s}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className="flex-1 h-px mb-4 transition-all duration-500"
                  style={{ background: i < step ? "linear-gradient(90deg, #7c3aed, #2563eb)" : "rgba(255,255,255,0.08)" }} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="min-h-[420px]">

          {/* Step 0 — Perusahaan */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-black mb-1">Target Perusahaan</h2>
                <p className="text-white/40 text-sm">Pilih dari list atau ketik sendiri</p>
              </div>

              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Ketik nama perusahaan..."
                className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition-all border border-white/10 focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/10"
                style={{ background: "rgba(255,255,255,0.04)" }}
              />

              {/* Group tabs */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {Object.keys(COMPANY_PRESETS).map((g) => (
                  <button key={g} onClick={() => setActiveGroup(g)}
                    className={`text-xs px-3 py-1.5 rounded-lg border whitespace-nowrap transition-all ${
                      activeGroup === g
                        ? "border-purple-500/50 bg-purple-500/15 text-purple-300"
                        : "border-white/10 text-white/40 hover:text-white/70 hover:border-white/20"
                    }`}>
                    {g}
                  </button>
                ))}
              </div>

              {/* Company grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {COMPANY_PRESETS[activeGroup].map((c) => (
                  <button key={c} onClick={() => setCompany(c)}
                    className={`text-sm px-3 py-2.5 rounded-xl border text-left transition-all ${
                      company === c
                        ? "border-purple-400 bg-purple-500/15 text-white font-semibold"
                        : "border-white/08 text-white/50 hover:text-white hover:border-white/20"
                    }`}
                    style={{ background: company === c ? undefined : "rgba(255,255,255,0.02)" }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1 — Bidang */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-black mb-1">Bidang Posisi</h2>
                <p className="text-white/40 text-sm">Pilih posisi yang ingin kamu lamar</p>
              </div>

              {/* Category tabs */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {FIELDS.map((cat, i) => (
                  <button key={cat.category} onClick={() => setActiveFieldCat(i)}
                    className={`text-xs px-3 py-1.5 rounded-lg border whitespace-nowrap transition-all ${
                      activeFieldCat === i
                        ? "border-blue-500/50 bg-blue-500/15 text-blue-300"
                        : "border-white/10 text-white/40 hover:text-white/70 hover:border-white/20"
                    }`}>
                    {cat.category}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {FIELDS[activeFieldCat].items.map((f) => (
                  <button key={f} onClick={() => setField(f)}
                    className={`text-sm px-4 py-3 rounded-xl border text-left transition-all ${
                      field === f
                        ? "border-blue-400 bg-blue-500/15 text-white font-semibold"
                        : "border-white/08 text-white/50 hover:text-white hover:border-white/20"
                    }`}
                    style={{ background: field === f ? undefined : "rgba(255,255,255,0.02)" }}>
                    {f}
                    {field === f && (
                      <span className="float-right text-blue-400">✓</span>
                    )}
                  </button>
                ))}
              </div>

              {field && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-500/30 bg-blue-500/10">
                  <span className="text-blue-400 text-xs">✓ Terpilih:</span>
                  <span className="text-white text-xs font-semibold">{field}</span>
                </div>
              )}
            </div>
          )}

          {/* Step 2 — Level */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-black mb-1">Level Pengalaman</h2>
                <p className="text-white/40 text-sm">Sesuaikan dengan kondisi kamu saat ini</p>
              </div>

              <div className="space-y-2">
                {LEVELS.map((l) => (
                  <button key={l.id} onClick={() => setLevel(l.id)}
                    className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl border text-left transition-all ${
                      level === l.id
                        ? "border-emerald-400/60 bg-emerald-500/10 ring-2 ring-emerald-500/10"
                        : "border-white/08 hover:border-white/20"
                    }`}
                    style={{ background: level === l.id ? undefined : "rgba(255,255,255,0.02)" }}>
                    <span className="text-2xl">{l.icon}</span>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${level === l.id ? "text-white" : "text-white/70"}`}>{l.id}</p>
                      <p className="text-white/30 text-xs">{l.desc}</p>
                    </div>
                    {level === l.id && (
                      <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3 — Personality */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-black mb-1">Gaya HRD-nya</h2>
                <p className="text-white/40 text-sm">Pilih kepribadian interviewer yang kamu mau</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {PERSONALITIES.map((p) => (
                  <button key={p.id} onClick={() => setPersonality(p.id)}
                    className={`flex flex-col items-start p-5 rounded-2xl border transition-all ${
                      personality === p.id
                        ? colorMapSelected[p.color]
                        : "border-white/08 hover:border-white/20"
                    }`}
                    style={{ background: personality === p.id ? undefined : "rgba(255,255,255,0.02)" }}>
                    <span className="text-3xl mb-3">{p.emoji}</span>
                    <p className={`text-sm font-bold mb-0.5 ${personality === p.id ? "text-white" : "text-white/70"}`}>
                      {p.label}
                    </p>
                    <p className="text-xs text-white/30">{p.desc}</p>
                    {personality === p.id && (
                      <span className={`mt-3 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${colorMap[p.color]}`}>
                        Dipilih
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Summary card */}
              <div className="rounded-2xl border border-white/10 p-4 space-y-2"
                style={{ background: "rgba(255,255,255,0.03)" }}>
                <p className="text-xs text-white/30 font-semibold uppercase tracking-widest mb-3">Ringkasan</p>
                {[
                  { label: "Perusahaan", value: company },
                  { label: "Posisi", value: field },
                  { label: "Level", value: level },
                  { label: "Gaya HRD", value: PERSONALITIES.find(p => p.id === personality)?.label ?? personality },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-white/30 text-xs">{item.label}</span>
                    <span className="text-white text-xs font-semibold">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="mt-8">
          <button onClick={next}
            className="w-full py-4 rounded-2xl font-bold text-sm transition-all active:scale-[0.98] hover:opacity-90 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}>
            {step < 3 ? (
              <>
                Lanjut
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </>
            ) : (
              <>
                🎤 Mulai Interview Sekarang!
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}