"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  collection, query, orderBy, limit, getDocs, Timestamp
} from "firebase/firestore";
import toast, { Toaster } from "react-hot-toast";
import ThemeToggle from "@/components/ThemeToggle";

type Session = {
  id: string;
  company: string;
  field: string;
  level: string;
  score: number;
  verdict: string;
  createdAt: Timestamp;
};

function ScoreRing({ score }: { score: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color =
    score >= 80 ? "#4ade80" : score >= 60 ? "#60a5fa" : score >= 40 ? "#fbbf24" : "#f87171";

  return (
    <svg width="72" height="72" className="rotate-[-90deg]">
      <circle cx="36" cy="36" r={r} fill="none" strokeWidth="5" className="stroke-gray-100 dark:stroke-zinc-800 transition-colors duration-300" />
      <circle
        cx="36" cy="36" r={r} fill="none"
        stroke={color} strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s ease" }}
      />
      <text
        x="36" y="36"
        textAnchor="middle" dominantBaseline="central"
        style={{
          fill: color, fontSize: "15px", fontWeight: 700,
          transform: "rotate(90deg)", transformOrigin: "36px 36px",
          fontFamily: "inherit"
        }}
      >
        {score}
      </text>
    </svg>
  );
}

function VerdictBadge({ verdict, score }: { verdict: string; score: number }) {
  const cfg =
    score >= 80 ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20" :
      score >= 60 ? "bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20" :
        score >= 40 ? "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20" :
          "bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20";
  return (
    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border transition-colors duration-300 ${cfg}`}>
      {verdict}
    </span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [mounted, setMounted] = useState(false);
  const user = auth.currentUser;

  useEffect(() => {
    setMounted(true);
    if (!user) return;
    fetchHistory();
  }, [user]);

  async function fetchHistory() {
    setLoadingHistory(true);
    try {
      const q = query(
        collection(db, "users", user!.uid, "sessions"),
        orderBy("createdAt", "desc"),
        limit(10)
      );
      const snap = await getDocs(q);
      setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Session)));
    } catch (e) {
      console.warn(e);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function handleLogout() {
    await signOut(auth);
    toast.success("Sampai jumpa!");
    router.replace("/login");
  }

  const avgScore = sessions.length
    ? Math.round(sessions.reduce((s, sess) => s + sess.score, 0) / sessions.length)
    : null;

  const bestScore = sessions.length ? Math.max(...sessions.map((s) => s.score)) : null;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F4F0E8] dark:bg-zinc-950 transition-colors duration-300 pb-16">

      <style>{`
        .fade-up {
          opacity: 0;
          transform: translateY(16px);
          animation: fadeUp 0.5s ease forwards;
        }
        @keyframes fadeUp {
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <Toaster position="top-right" toastOptions={{
        className: "dark:bg-zinc-800 dark:text-zinc-100 dark:border dark:border-zinc-700"
      }} />

      <nav className="px-4 sm:px-10 h-[70px] bg-white dark:bg-zinc-900 border-b-2 border-gray-100 dark:border-zinc-800 flex items-center justify-between sticky top-0 z-50 transition-colors duration-300">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#0F1A0A] rounded-xl flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D6FB61" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <span className="font-extrabold text-xl text-[#0F1A0A] dark:text-zinc-100 tracking-tight">
            HRD<span className="text-[#3D6B2C] dark:text-[#D6FB61]">.ai</span>
          </span>
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle />

          <div className="hidden sm:flex items-center gap-3 border-l-2 border-gray-100 dark:border-zinc-800 pl-4 transition-colors duration-300">
            {user?.photoURL && (
              <img src={user.photoURL} alt="avatar" className="w-8 h-8 rounded-full border-2 border-[#D6FB61] object-cover" />
            )}
            <span className="text-sm font-bold text-gray-600 dark:text-zinc-300">
              {user?.displayName}
            </span>
          </div>

          <button onClick={handleLogout} className="text-xs font-bold text-gray-500 dark:text-zinc-400 hover:text-[#0F1A0A] dark:hover:text-white bg-gray-50 dark:bg-zinc-800/50 hover:bg-gray-100 dark:hover:bg-zinc-800 border-2 border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2 transition-all">
            Logout
          </button>
        </div>
      </nav>

      <div className="px-4 sm:px-10 pt-8 sm:pt-10">

        <div className={`grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 mb-4 ${mounted ? "fade-up" : ""}`} style={{ animationDelay: "0.05s" }}>
          <div className="bg-[#0F1A0A] dark:bg-zinc-900 rounded-[2rem] p-8 sm:p-10 flex flex-col justify-between min-h-[240px] relative overflow-hidden border-2 border-transparent dark:border-zinc-800 transition-colors duration-300">
            <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-[#D6FB61]/10 dark:bg-[#D6FB61]/5 pointer-events-none" />

            <div>
              <div className="inline-flex items-center gap-2 bg-[#D6FB61]/10 border border-[#D6FB61]/20 rounded-full px-3.5 py-1.5 mb-6">
                <span className="w-2 h-2 rounded-full bg-[#D6FB61] animate-pulse" />
                <span className="text-xs font-bold text-[#D6FB61] tracking-wider uppercase">
                  AI Interview Simulator
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight tracking-tight mb-2">
                Halo,{" "}
                <span className="bg-[#D6FB61] text-[#0F1A0A] rounded-xl px-3 py-0.5 inline-block mt-2">
                  {user?.displayName ?? "Kamu"}!
                </span>
              </h1>
            </div>

            <p className="text-lg text-white/50 font-medium mt-6">
              Siap hajar interview hari ini? 🎯
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-4">
            {[
              { label: "Total Sesi", value: sessions.length || "—", suffix: sessions.length ? "x" : "" },
              { label: "Rata-rata Skor", value: avgScore ?? "—", suffix: avgScore ? "/100" : "" },
              { label: "Skor Terbaik", value: bestScore ?? "—", suffix: bestScore ? "/100" : "" },
            ].map((s) => (
              <div key={s.label} className="flex-1 bg-white dark:bg-zinc-900 rounded-[1.5rem] border-2 border-gray-100 dark:border-zinc-800 p-5 flex items-center justify-between transition-colors duration-300">
                <span className="text-sm font-bold text-gray-500 dark:text-zinc-400">{s.label}</span>
                <span className="text-3xl font-black text-[#0F1A0A] dark:text-zinc-100 tracking-tight">
                  {s.value}
                  <span className="text-sm font-bold text-gray-400 dark:text-zinc-500 ml-1">{s.suffix}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
          <div className="flex flex-col gap-3">
            <button
              onClick={() => router.push("/setup")}
              className="w-full inline-flex items-center justify-center gap-2 font-black text-base px-6 py-4 rounded-[1.5rem] bg-[#0F1A0A] dark:bg-zinc-100 text-[#D6FB61] dark:text-zinc-900 transition-all hover:-translate-y-1 hover:shadow-lg active:scale-95"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Mulai Simulasi Interview
            </button>

            <button
              onClick={() => router.push("/cv-roasting")}
              className="w-full inline-flex items-center justify-center gap-2 font-black text-base px-6 py-4 rounded-[1.5rem] bg-white dark:bg-zinc-900 text-[#0F1A0A] dark:text-zinc-100 border-2 border-gray-200 dark:border-zinc-800 transition-all hover:-translate-y-1 hover:shadow-lg hover:border-gray-300 dark:hover:border-zinc-700 active:scale-95"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Roasting CV
            </button>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-[2rem] border-2 border-gray-100 dark:border-zinc-800 p-6 sm:p-8 transition-colors duration-300">
            <div className="flex items-center justify-between mb-6">
              <span className="text-xs font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">
                Riwayat Sesi
              </span>
              {sessions.length > 0 && (
                <span className="text-xs font-bold text-gray-400 dark:text-zinc-500">{sessions.length} sesi</span>
              )}
            </div>

            {loadingHistory ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-gray-100 dark:border-zinc-800 border-t-[#0F1A0A] dark:border-t-[#D6FB61] rounded-full animate-spin" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12 px-6 border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-3xl">
                <div className="text-5xl mb-4 bg-gray-50 dark:bg-zinc-800 inline-block p-4 rounded-3xl">🎤</div>
                <p className="text-base font-black text-[#0F1A0A] dark:text-zinc-100 mb-1">Belum ada sesi interview</p>
                <p className="text-sm font-medium text-gray-500 dark:text-zinc-400">Mulai simulasi pertamamu lewat tombol di samping!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => router.push(`/result/${s.id}`)}
                    className="flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-zinc-800/50 hover:translate-x-1 border-2 border-transparent hover:border-gray-100 dark:hover:border-zinc-800"
                  >                    <ScoreRing score={s.score} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                        <p className="font-black text-[#0F1A0A] dark:text-zinc-100 text-base m-0 truncate">
                          {s.company}
                        </p>
                        <VerdictBadge verdict={s.verdict} score={s.score} />
                      </div>
                      <p className="text-sm font-bold text-gray-500 dark:text-zinc-400 m-0 truncate">
                        {s.field} · {s.level}
                      </p>
                      <p className="text-xs font-semibold text-gray-400 dark:text-zinc-600 mt-1">
                        {s.createdAt?.toDate?.()?.toLocaleDateString("id-ID", {
                          day: "numeric", month: "short", year: "numeric"
                        }) ?? "—"}
                      </p>
                    </div>
                    <svg className="text-gray-300 dark:text-zinc-600 shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}