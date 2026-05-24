"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import toast, { Toaster } from "react-hot-toast";

const FIELDS = [
  "Software Engineering", "Frontend Development", "Backend Development",
  "Mobile Development", "DevOps / Cloud", "Data Science", "Data Engineering",
  "Machine Learning / AI", "Cybersecurity", "QA / Quality Assurance",
  "Product Management", "UI/UX Design", "Graphic Design",
  "Business Analyst", "Project Management", "Consulting",
  "Marketing Digital", "Content & Social Media", "Sales", "Business Development",
  "Finance & Accounting", "Human Resources", "Legal",
  "Logistics & Supply Chain", "Customer Service",
];

const LEVELS = [
  "Internship / Magang",
  "Fresh Graduate",
  "Junior (1-2 thn)",
  "Mid-level (3-5 thn)",
  "Senior (5+ thn)",
];

const PERSONALITIES = [
  {
    id: "friendly",
    label: "Ramah",
    desc: "Santai, suportif, bikin nyaman",
    icon: "😊",
  },
  {
    id: "neutral",
    label: "Netral",
    desc: "Profesional, to the point, standar",
    icon: "🧑‍💼",
  },
  {
    id: "critical",
    label: "Kritis",
    desc: "Tajam, banyak follow-up, pressure tinggi",
    icon: "🔍",
  },
  {
    id: "formal",
    label: "Formal",
    desc: "Sangat struktural, kaku, korporat banget",
    icon: "👔",
  },
];

const COMPANY_PRESETS: Record<string, string[]> = {
  "🇮🇩 Startup Indonesia": [
    "Gojek", "Tokopedia", "Shopee Indonesia", "Traveloka", "Bukalapak",
    "Tiket.com", "Koinworks", "Xendit", "Kata.ai", "Ruangguru",
    "Zenius", "Flip", "Stockbit", "Midtrans", "Modalku",
  ],
  "🏦 BUMN & Korporat": [
    "Pertamina", "Bank BRI", "Bank BNI", "Bank Mandiri", "Bank BCA",
    "Telkom Indonesia", "PLN", "Astra International", "Unilever Indonesia",
    "Indofood", "Garuda Indonesia", "BPJS Ketenagakerjaan",
  ],
  "🌍 Perusahaan Global": [
    "Google", "Microsoft", "Meta", "Amazon", "Apple",
    "Netflix", "Grab", "Sea Group", "ByteDance / TikTok",
    "McKinsey", "Deloitte", "Accenture", "IBM", "Oracle",
  ],
  "🎮 Gaming & Kreatif": [
    "Riot Games", "Ubisoft", "Garena", "VNG", "Agate Studio",
    "Touchten Games", "Lyto Game",
  ],
};

export default function SetupPage() {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [field, setField] = useState("");
  const [level, setLevel] = useState("");
  const [personality, setPersonality] = useState("neutral");
  const [activeGroup, setActiveGroup] = useState(Object.keys(COMPANY_PRESETS)[0]);

  function handleStart() {
    if (!company.trim()) return toast.error("Isi nama perusahaan dulu ya!");
    if (!field) return toast.error("Pilih bidang posisinya!");
    if (!level) return toast.error("Pilih level pengalamannya!");
    if (!auth.currentUser) return router.replace("/login");

    sessionStorage.setItem(
      "interview_config",
      JSON.stringify({ company, field, level, personality })
    );
    router.push("/session");
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-10">
      <Toaster position="top-center" />
      <div className="max-w-xl mx-auto">

        {}
        <div className="mb-8">
          <button
            onClick={() => router.push("/")}
            className="text-zinc-500 hover:text-white text-sm mb-5 flex items-center gap-1 transition-colors"
          >
            ← Kembali
          </button>
          <h1 className="text-2xl font-semibold text-white">Setup Interview</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Sesuaikan sesi interview sesuai target karir kamu
          </p>
        </div>

        <div className="space-y-8">

          {}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Nama Perusahaan
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Ketik nama perusahaan..."
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-white/25 transition-colors"
            />

            {}
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
              {Object.keys(COMPANY_PRESETS).map((group) => (
                <button
                  key={group}
                  onClick={() => setActiveGroup(group)}
                  className={`text-xs px-3 py-1.5 rounded-lg border whitespace-nowrap transition-all ${
                    activeGroup === group
                      ? "bg-white text-zinc-900 border-white"
                      : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-white"
                  }`}
                >
                  {group}
                </button>
              ))}
            </div>

            {}
            <div className="flex flex-wrap gap-2 mt-2">
              {COMPANY_PRESETS[activeGroup].map((c) => (
                <button
                  key={c}
                  onClick={() => setCompany(c)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                    company === c
                      ? "bg-white text-zinc-900 border-white"
                      : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-white"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Bidang Posisi
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
              {FIELDS.map((f) => (
                <button
                  key={f}
                  onClick={() => setField(f)}
                  className={`text-sm px-4 py-2.5 rounded-xl border text-left transition-all ${
                    field === f
                      ? "bg-white text-zinc-900 border-white font-medium"
                      : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-white"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Level Pengalaman
            </label>
            <div className="grid grid-cols-2 gap-2">
              {LEVELS.map((l) => (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className={`text-sm px-4 py-2.5 rounded-xl border text-left transition-all ${
                    level === l
                      ? "bg-white text-zinc-900 border-white font-medium"
                      : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-white"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Kepribadian HRD
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PERSONALITIES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPersonality(p.id)}
                  className={`px-4 py-3 rounded-xl border text-left transition-all ${
                    personality === p.id
                      ? "bg-white border-white"
                      : "border-white/10 hover:border-white/25"
                  }`}
                >
                  <div className={`flex items-center gap-2 mb-0.5 ${personality === p.id ? "text-zinc-900" : "text-white"}`}>
                    <span>{p.icon}</span>
                    <span className="text-sm font-medium">{p.label}</span>
                  </div>
                  <p className={`text-xs ${personality === p.id ? "text-zinc-600" : "text-zinc-500"}`}>
                    {p.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {}
          <button
            onClick={handleStart}
            className="w-full bg-white text-zinc-900 font-semibold text-sm rounded-xl py-3.5 hover:bg-zinc-100 active:scale-[0.98] transition-all"
          >
            Mulai Interview →
          </button>

        </div>
      </div>
    </div>
  );
}