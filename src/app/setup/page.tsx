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
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  purple: "border-purple-200 bg-purple-50 text-purple-700",
};

const colorMapSelected: Record<string, string> = {
  emerald: "border-emerald-500 bg-emerald-100 ring-4 ring-emerald-500/20",
  blue: "border-blue-500 bg-blue-100 ring-4 ring-blue-500/20",
  amber: "border-amber-500 bg-amber-100 ring-4 ring-amber-500/20",
  purple: "border-purple-500 bg-purple-100 ring-4 ring-purple-500/20",
};

function StepDot({ active, done, n }: { active: boolean; done: boolean; n: number }) {
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold transition-all duration-300 ${
      done ? "bg-[#0F1A0A] text-[#D6FB61]" :
      active ? "bg-[#D6FB61] text-[#0F1A0A] border-2 border-[#0F1A0A]" :
      "bg-white border-2 border-gray-200 text-gray-400"
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
    <div className="min-h-screen bg-[#F4F0E8] text-[#0F1A0A] relative pb-10">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
        * { font-family: 'Nunito', sans-serif; }
      `}</style>

      <Toaster position="top-center" toastOptions={{
        style: { background: "#0F1A0A", color: "#D6FB61", borderRadius: "12px", fontSize: "14px", fontWeight: "bold" }
      }} />

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">

        <div className="flex items-center justify-between mb-10">
          <button onClick={() => step > 0 ? setStep(step - 1) : router.push("/")}
            className="flex items-center gap-2 text-gray-500 hover:text-[#0F1A0A] font-bold transition-colors text-sm bg-white border-2 border-gray-200 px-4 py-2 rounded-xl">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {step > 0 ? "Kembali" : "Dashboard"}
          </button>

          <span className="font-extrabold text-xl tracking-tight text-[#0F1A0A]">
            HRD<span className="text-[#3D6B2C]">.ai</span>
          </span>
        </div>

        <div className="flex items-center gap-2 mb-10">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className="flex flex-col items-center gap-2">
                <StepDot active={i === step} done={i < step} n={i + 1} />
                <span className={`text-xs font-bold hidden sm:block transition-colors ${i === step ? "text-[#0F1A0A]" : i < step ? "text-[#3D6B2C]" : "text-gray-400"}`}>
                  {s}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className="flex-1 h-1.5 rounded-full mb-6 sm:mb-5 transition-all duration-500"
                  style={{ background: i < step ? "#0F1A0A" : "rgba(0,0,0,0.06)" }} />
              )}
            </div>
          ))}
        </div>

        <div className="min-h-[420px] bg-white rounded-[2rem] p-6 sm:p-8 border-2 border-gray-100 shadow-xl shadow-black/5">

          {step === 0 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-black mb-1">Target Perusahaan</h2>
                <p className="text-gray-500 font-medium text-sm">Pilih dari list atau ketik sendiri</p>
              </div>

              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Ketik nama perusahaan..."
                className="w-full rounded-2xl px-5 py-4 text-base font-bold text-[#0F1A0A] bg-gray-50 border-2 border-gray-200 outline-none transition-all focus:border-[#0F1A0A] focus:bg-white placeholder-gray-400"
              />

              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                {Object.keys(COMPANY_PRESETS).map((g) => (
                  <button key={g} onClick={() => setActiveGroup(g)}
                    className={`text-sm font-bold px-4 py-2 rounded-xl border-2 whitespace-nowrap transition-all ${
                      activeGroup === g
                        ? "border-[#0F1A0A] bg-[#0F1A0A] text-[#D6FB61]"
                        : "border-gray-100 bg-white text-gray-500 hover:border-gray-200 hover:text-[#0F1A0A]"
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
                        ? "border-[#0F1A0A] bg-[#D6FB61] text-[#0F1A0A]"
                        : "border-gray-100 bg-white text-gray-600 hover:border-gray-200 hover:text-[#0F1A0A]"
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
                <p className="text-gray-500 font-medium text-sm">Pilih posisi yang ingin kamu lamar</p>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                {FIELDS.map((cat, i) => (
                  <button key={cat.category} onClick={() => setActiveFieldCat(i)}
                    className={`text-sm font-bold px-4 py-2 rounded-xl border-2 whitespace-nowrap transition-all ${
                      activeFieldCat === i
                        ? "border-[#0F1A0A] bg-[#0F1A0A] text-[#D6FB61]"
                        : "border-gray-100 bg-white text-gray-500 hover:border-gray-200 hover:text-[#0F1A0A]"
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
                        ? "border-[#0F1A0A] bg-[#D6FB61] text-[#0F1A0A]"
                        : "border-gray-100 bg-white text-gray-600 hover:border-gray-200 hover:text-[#0F1A0A]"
                    }`}>
                    {f}
                    {field === f && (
                      <span className="text-[#0F1A0A] bg-white rounded-full p-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {field && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-[#0F1A0A] bg-[#D6FB61]/20 mt-4">
                  <span className="text-[#0F1A0A] font-bold text-sm">✓ Terpilih:</span>
                  <span className="text-[#0F1A0A] text-sm font-black">{field}</span>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-black mb-1">Level Pengalaman</h2>
                <p className="text-gray-500 font-medium text-sm">Sesuaikan dengan kondisi kamu saat ini</p>
              </div>

              <div className="space-y-3">
                {LEVELS.map((l) => (
                  <button key={l.id} onClick={() => setLevel(l.id)}
                    className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 text-left transition-all ${
                      level === l.id
                        ? "border-[#0F1A0A] bg-[#D6FB61]"
                        : "border-gray-100 bg-white hover:border-gray-200"
                    }`}>
                    <span className="text-3xl bg-white p-2 rounded-xl border-2 border-gray-100">{l.icon}</span>
                    <div className="flex-1">
                      <p className={`text-base font-black ${level === l.id ? "text-[#0F1A0A]" : "text-gray-800"}`}>{l.id}</p>
                      <p className={`text-sm font-medium mt-0.5 ${level === l.id ? "text-[#0F1A0A]/70" : "text-gray-500"}`}>{l.desc}</p>
                    </div>
                    {level === l.id && (
                      <div className="w-6 h-6 rounded-full bg-[#0F1A0A] flex items-center justify-center shrink-0">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D6FB61" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
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
                <p className="text-gray-500 font-medium text-sm">Pilih kepribadian interviewer yang kamu mau</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {PERSONALITIES.map((p) => (
                  <button key={p.id} onClick={() => setPersonality(p.id)}
                    className={`flex flex-col items-start p-5 rounded-2xl border-2 transition-all ${
                      personality === p.id
                        ? colorMapSelected[p.color]
                        : "border-gray-100 bg-white hover:border-gray-200"
                    }`}>
                    <div className="flex justify-between w-full items-start mb-3">
                      <span className="text-4xl bg-white p-2 rounded-xl shadow-sm border border-gray-50">{p.emoji}</span>
                      {personality === p.id && (
                        <span className={`text-[10px] font-bold px-3 py-1 rounded-full border bg-white ${colorMap[p.color].split(' ')[2]}`}>
                          Terpilih
                        </span>
                      )}
                    </div>
                    <p className={`text-lg font-black mb-1 ${personality === p.id ? "text-gray-900" : "text-gray-800"}`}>
                      {p.label}
                    </p>
                    <p className="text-sm font-medium text-gray-500">{p.desc}</p>
                  </button>
                ))}
              </div>

              <div className="rounded-2xl border-2 border-gray-100 bg-gray-50 p-5 mt-6">
                <p className="text-xs text-gray-400 font-black uppercase tracking-widest mb-4">Ringkasan Setup</p>
                <div className="space-y-3">
                  {[
                    { label: "Perusahaan", value: company },
                    { label: "Posisi", value: field },
                    { label: "Level", value: level },
                    { label: "Gaya HRD", value: PERSONALITIES.find(p => p.id === personality)?.label ?? personality },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between pb-3 border-b border-gray-200 last:border-0 last:pb-0">
                      <span className="text-gray-500 font-bold text-sm">{item.label}</span>
                      <span className="text-[#0F1A0A] text-sm font-black text-right max-w-[60%] truncate">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 sm:mt-8">
          <button onClick={next}
            className="w-full py-4 rounded-2xl font-black text-base transition-all active:scale-[0.98] hover:-translate-y-1 hover:shadow-lg flex items-center justify-center gap-2 bg-[#0F1A0A] text-[#D6FB61]">
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