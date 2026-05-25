"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  collection, query, orderBy, limit, getDocs, Timestamp
} from "firebase/firestore";
import toast, { Toaster } from "react-hot-toast";

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
      <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
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
    score >= 80 ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" :
    score >= 60 ? "bg-blue-500/20 text-blue-300 border-blue-500/30" :
    score >= 40 ? "bg-amber-500/20 text-amber-300 border-amber-500/30" :
    "bg-red-500/20 text-red-300 border-red-500/30";
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg}`}>
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
  }, []);

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
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
      <Toaster position="top-right" toastOptions={{
        style: { background: "#1a1a2e", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" }
      }} />

      {/* Aurora background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #7c3aed, transparent 70%)" }} />
        <div className="absolute top-20 right-0 w-[500px] h-[500px] rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #2563eb, transparent 70%)" }} />
        <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #059669, transparent 70%)" }} />
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "60px 60px"
          }} />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-10">

        {/* Navbar */}
        <nav className="flex items-center justify-between mb-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <span className="font-bold text-lg tracking-tight">HRD<span className="text-purple-400">.ai</span></span>
          </div>

          <div className="flex items-center gap-4">
            {user?.photoURL && (
              <img src={user.photoURL} alt="avatar" className="w-8 h-8 rounded-full ring-2 ring-white/20" />
            )}
            <span className="text-sm text-white/50 hidden sm:block">{user?.displayName}</span>
            <button onClick={handleLogout}
              className="text-xs text-white/40 hover:text-white/80 transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20">
              Logout
            </button>
          </div>
        </nav>

        {/* Hero section */}
        <div className={`mb-12 transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs font-medium mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            AI-Powered Interview Simulator
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-3 leading-tight">
            Halo,{" "}
            <span style={{ background: "linear-gradient(90deg, #a78bfa, #60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              {user?.displayName}!
            </span>
          </h1>
          <p className="text-white/50 text-lg">Siap hajar interview hari ini? 🎯</p>
        </div>

        {/* Stats row */}
        {sessions.length > 0 && (
          <div className={`grid grid-cols-3 gap-4 mb-8 transition-all duration-700 delay-100 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            {[
              { label: "Total Sesi", value: sessions.length, suffix: "x" },
              { label: "Rata-rata Skor", value: avgScore, suffix: "/100" },
              { label: "Skor Terbaik", value: bestScore, suffix: "/100" },
            ].map((s) => (
              <div key={s.label}
                className="rounded-2xl border border-white/[0.07] p-4 sm:p-5"
                style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(12px)" }}>
                <p className="text-white/40 text-xs mb-1">{s.label}</p>
                <p className="text-2xl sm:text-3xl font-black text-white">
                  {s.value}<span className="text-sm font-normal text-white/30">{s.suffix}</span>
                </p>
              </div>
            ))}
          </div>
        )}

        {/* CTA Button */}
        <div className={`mb-10 transition-all duration-700 delay-150 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <button
            onClick={() => router.push("/setup")}
            className="group relative w-full sm:w-auto px-8 py-4 rounded-2xl font-bold text-sm overflow-hidden transition-all active:scale-[0.98] hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Mulai Simulasi Interview Baru
            </span>
          </button>
        </div>

        {/* History */}
        <div className={`transition-all duration-700 delay-200 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest">Riwayat Sesi</h2>
            {sessions.length > 0 && (
              <span className="text-xs text-white/20">{sessions.length} sesi</span>
            )}
          </div>

          {loadingHistory ? (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 border-2 border-white/10 border-t-purple-400 rounded-full animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-16 rounded-3xl border border-white/[0.06]"
              style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="text-4xl mb-3">🎤</div>
              <p className="text-white/40 text-sm mb-1">Belum ada sesi interview</p>
              <p className="text-white/20 text-xs">Mulai simulasi pertamamu di atas!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((s) => (
                <div key={s.id}
                  className="group rounded-2xl border border-white/[0.07] p-4 sm:p-5 flex items-center gap-4 transition-all hover:border-white/15 cursor-pointer"
                  style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(12px)" }}>
                  <ScoreRing score={s.score} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-bold text-white text-sm truncate">{s.company}</p>
                      <VerdictBadge verdict={s.verdict} score={s.score} />
                    </div>
                    <p className="text-white/40 text-xs truncate">{s.field} · {s.level}</p>
                    <p className="text-white/20 text-xs mt-0.5">
                      {s.createdAt?.toDate?.()?.toLocaleDateString("id-ID", {
                        day: "numeric", month: "short", year: "numeric"
                      }) ?? "—"}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-white/10 text-xs mt-16">
          HRD.ai · Made with 🤖🫰
        </p>
      </div>
    </div>
  );
}