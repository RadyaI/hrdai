"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import toast, { Toaster } from "react-hot-toast";
import ThemeToggle from "@/components/ThemeToggle";

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

const badgeColorMap: Record<string, string> = {
  emerald: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/30",
  blue: "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-500/10 dark:border-blue-500/30",
  amber: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-500/30",
  purple: "text-purple-700 bg-purple-50 border-purple-200 dark:text-purple-300 dark:bg-purple-500/10 dark:border-purple-500/30",
};

const colorMapSelected: Record<string, string> = {
  emerald: "border-emerald-500 bg-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/30 ring-4 ring-emerald-500/20",
  blue: "border-blue-500 bg-blue-100 dark:bg-blue-500/10 dark:border-blue-500/30 ring-4 ring-blue-500/20",
  amber: "border-amber-500 bg-amber-100 dark:bg-amber-500/10 dark:border-amber-500/30 ring-4 ring-amber-500/20",
  purple: "border-purple-500 bg-purple-100 dark:bg-purple-500/10 dark:border-purple-500/30 ring-4 ring-purple-500/20",
};

function StepDot({ active, done, n }: { active: boolean; done: boolean; n: number }) {
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold transition-all duration-300 ${
      done ? "bg-[#0F1A0A] dark:bg-[#D6FB61] text-[#D6FB61] dark:text-[#0F1A0A]" :
      active ? "bg-[#D6FB61] text-[#0F1A0A] border-2 border-[#0F1A0A] dark:border-[#D6FB61]" :
      "bg-white dark:bg-zinc-800 border-2 border-gray-200 dark:border-zinc-700 text-gray-400 dark:text-zinc-500"
    }`}>
      {done ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : n}
    </div>
  );
}

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
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
    <div className="min-h-screen bg-[#F4F0E8] dark:bg-zinc-950 text-[#0F1A0A] dark:text-zinc-100 relative pb-10 transition-colors duration-300">
      
      <Toaster position="top-center" toastOptions={{
        className: "dark:bg-zinc-800 dark:text-zinc-100 dark:border dark:border-zinc-700",
        style: { borderRadius: "12px", fontSize: "14px", fontWeight: "bold" }
      }} />

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">

        <div className="flex items-center justify-between mb-10">
          <button onClick={() => step > 0 ? setStep(step - 1) : router.push("/")}
            className="flex items-center gap-2 text-gray-500 dark:text-zinc-400 hover:text-[#0F1A0A] dark:hover:text-zinc-100 font-bold transition-colors text-sm bg-white dark:bg-zinc-900 border-2 border-gray-200 dark:border-zinc-800 px-4 py-2 rounded-xl">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {step > 0 ? "Kembali" : "Dashboard"}
          </button>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            <span className="font-extrabold text-xl tracking-tight text-[#0F1A0A] dark:text-zinc-100 hidden sm:block">
              HRD<span className="text-[#3D6B2C] dark:text-[#D6FB61]">.ai</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-10">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className="flex flex-col items-center gap-2">
                <StepDot active={i === step} done={i < step} n={i + 1} />
                <span className={`text-xs font-bold hidden sm:block transition-colors ${
                  i === step ? "text-[#0F1A0A] dark:text-zinc-100" : 
                  i < step ? "text-[#3D6B2C] dark:text-[#D6FB61]" : "text-gray-400 dark:text-zinc-500"
                }`}>
                  {s}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-1.5 rounded-full mb-6 sm:mb-5 transition-all duration-500 ${
                  i < step ? "bg-[#0F1A0A] dark:bg-[#D6FB61]" : "bg-black/5 dark:bg-white/10"
                }`} />
              )}
            </div>
          ))}
        </div>

        <div className="min-h-[420px] bg-white dark:bg-zinc-900 rounded-[2rem] p-6 sm:p-8 border-2 border-gray-100 dark:border-zinc-800 shadow-xl shadow-black/5 transition-colors duration-300">

          {step === 0 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-black mb-1">Target Perusahaan</h2>
                <p className="text-gray-500 dark:text-zinc-400 font-medium text-sm">Pilih dari list atau ketik sendiri</p>
              </div>

              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Ketik nama perusahaan..."
                className="w-full rounded-2xl px-5 py-4 text-base font-bold text-[#0F1A0A] dark:text-zinc-100 bg-gray-50 dark:bg-zinc-800/50 border-2 border-gray-200 dark:border-zinc-700 outline-none transition-all focus:border-[#0F1A0A] dark:focus:border-[#D6FB61] focus:bg-white dark:focus:bg-zinc-800 placeholder-gray-400 dark:placeholder-zinc-500"
              />

              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                {Object.keys(COMPANY_PRESETS).map((g) => (
                  <button key={g} onClick={() => setActiveGroup(g)}
                    className={`text-sm font-bold px-4 py-2 rounded-xl border-2 whitespace-nowrap transition-all ${
                      activeGroup === g
                        ? "border-[#0F1A0A] dark:border-[#D6FB61] bg-[#0F1A0A] dark:bg-[#D6FB61] text-[#D6FB61] dark:text-[#0F1A0A]"
                        : "border-gray-100 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 hover:border-gray-200 dark:hover:border-zinc-600 hover:text-[#0F1A0A] dark:hover:text-zinc-100"
                    }`}>
                    {g}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {COMPANY_PRESETS[activeGroup].map((c) => (
                  <button key={c} onClick={() => setCompany(c)}
                    className={`text-sm font-bold px-4 py-3 rounded-xl border-2 text-left transition-all ${
                      company === c
                        ? "border-[#0F1A0A] dark:border-[#D6FB61] bg-[#D6FB61] dark:bg-[#D6FB61]/10 text-[#0F1A0A] dark:text-[#D6FB61]"
                        : "border-gray-100 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-gray-600 dark:text-zinc-300 hover:border-gray-200 dark:hover:border-zinc-600 hover:text-[#0F1A0A] dark:hover:text-zinc-100"
                    }`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-black mb-1">Bidang Posisi</h2>
                <p className="text-gray-500 dark:text-zinc-400 font-medium text-sm">Pilih posisi yang ingin kamu lamar</p>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                {FIELDS.map((cat, i) => (
                  <button key={cat.category} onClick={() => setActiveFieldCat(i)}
                    className={`text-sm font-bold px-4 py-2 rounded-xl border-2 whitespace-nowrap transition-all ${
                      activeFieldCat === i
                        ? "border-[#0F1A0A] dark:border-[#D6FB61] bg-[#0F1A0A] dark:bg-[#D6FB61] text-[#D6FB61] dark:text-[#0F1A0A]"
                        : "border-gray-100 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 hover:border-gray-200 dark:hover:border-zinc-600 hover:text-[#0F1A0A] dark:hover:text-zinc-100"
                    }`}>
                    {cat.category}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {FIELDS[activeFieldCat].items.map((f) => (
                  <button key={f} onClick={() => setField(f)}
                    className={`text-sm font-bold px-4 py-3 rounded-xl border-2 text-left flex justify-between items-center transition-all ${
                      field === f
                        ? "border-[#0F1A0A] dark:border-[#D6FB61] bg-[#D6FB61] dark:bg-[#D6FB61]/10 text-[#0F1A0A] dark:text-[#D6FB61]"
                        : "border-gray-100 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-gray-600 dark:text-zinc-300 hover:border-gray-200 dark:hover:border-zinc-600 hover:text-[#0F1A0A] dark:hover:text-zinc-100"
                    }`}>
                    {f}
                    {field === f && (
                      <span className="text-[#0F1A0A] dark:text-[#0F1A0A] bg-white dark:bg-[#D6FB61] rounded-full p-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {field && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-[#0F1A0A] dark:border-zinc-700 bg-[#D6FB61]/20 dark:bg-zinc-800 mt-4">
                  <span className="text-[#0F1A0A] dark:text-zinc-400 font-bold text-sm">✓ Terpilih:</span>
                  <span className="text-[#0F1A0A] dark:text-[#D6FB61] text-sm font-black">{field}</span>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-black mb-1">Level Pengalaman</h2>
                <p className="text-gray-500 dark:text-zinc-400 font-medium text-sm">Sesuaikan dengan kondisi kamu saat ini</p>
              </div>

              <div className="space-y-3">
                {LEVELS.map((l) => (
                  <button key={l.id} onClick={() => setLevel(l.id)}
                    className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 text-left transition-all ${
                      level === l.id
                        ? "border-[#0F1A0A] dark:border-[#D6FB61] bg-[#D6FB61] dark:bg-[#D6FB61]/10"
                        : "border-gray-100 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 hover:border-gray-200 dark:hover:border-zinc-600"
                    }`}>
                    <span className="text-3xl bg-white dark:bg-zinc-800 p-2 rounded-xl border-2 border-gray-100 dark:border-zinc-700">{l.icon}</span>
                    <div className="flex-1">
                      <p className={`text-base font-black ${level === l.id ? "text-[#0F1A0A] dark:text-[#D6FB61]" : "text-gray-800 dark:text-zinc-200"}`}>{l.id}</p>
                      <p className={`text-sm font-medium mt-0.5 ${level === l.id ? "text-[#0F1A0A]/70 dark:text-[#D6FB61]/70" : "text-gray-500 dark:text-zinc-400"}`}>{l.desc}</p>
                    </div>
                    {level === l.id && (
                      <div className="w-6 h-6 rounded-full bg-[#0F1A0A] dark:bg-[#D6FB61] flex items-center justify-center shrink-0">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="stroke-[#D6FB61] dark:stroke-[#0F1A0A]" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-black mb-1">Gaya HRD-nya</h2>
                <p className="text-gray-500 dark:text-zinc-400 font-medium text-sm">Pilih kepribadian interviewer yang kamu mau</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {PERSONALITIES.map((p) => (
                  <button key={p.id} onClick={() => setPersonality(p.id)}
                    className={`flex flex-col items-start p-5 rounded-2xl border-2 transition-all ${
                      personality === p.id
                        ? colorMapSelected[p.color]
                        : "border-gray-100 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 hover:border-gray-200 dark:hover:border-zinc-600"
                    }`}>
                    <div className="flex justify-between w-full items-start mb-3">
                      <span className="text-4xl bg-white dark:bg-zinc-800 p-2 rounded-xl shadow-sm border border-gray-50 dark:border-zinc-700">{p.emoji}</span>
                      {personality === p.id && (
                        <span className={`text-[10px] font-bold px-3 py-1 rounded-full border ${badgeColorMap[p.color]}`}>
                          Terpilih
                        </span>
                      )}
                    </div>
                    <p className={`text-lg font-black mb-1 ${personality === p.id ? "text-gray-900 dark:text-zinc-100" : "text-gray-800 dark:text-zinc-300"}`}>
                      {p.label}
                    </p>
                    <p className="text-sm font-medium text-gray-500 dark:text-zinc-400">{p.desc}</p>
                  </button>
                ))}
              </div>

              <div className="rounded-2xl border-2 border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/30 p-5 mt-6">
                <p className="text-xs text-gray-400 dark:text-zinc-500 font-black uppercase tracking-widest mb-4">Ringkasan Setup</p>
                <div className="space-y-3">
                  {[
                    { label: "Perusahaan", value: company },
                    { label: "Posisi", value: field },
                    { label: "Level", value: level },
                    { label: "Gaya HRD", value: PERSONALITIES.find(p => p.id === personality)?.label ?? personality },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-zinc-800 last:border-0 last:pb-0">
                      <span className="text-gray-500 dark:text-zinc-400 font-bold text-sm">{item.label}</span>
                      <span className="text-[#0F1A0A] dark:text-zinc-100 text-sm font-black text-right max-w-[60%] truncate">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 sm:mt-8">
          <button onClick={next}
            className="w-full py-4 rounded-2xl font-black text-base transition-all active:scale-[0.98] hover:-translate-y-1 hover:shadow-lg flex items-center justify-center gap-2 bg-[#0F1A0A] dark:bg-[#D6FB61] text-[#D6FB61] dark:text-[#0F1A0A]">
            {step < 3 ? (
              <>
                Lanjut
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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