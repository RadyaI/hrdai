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

function getVerdictColor(score: number) {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-blue-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

export default function DashboardPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const user = auth.currentUser;

  useEffect(() => {
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
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Session));
      setSessions(data);
    } catch (e) {
      console.warn("Gagal load history:", e);
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

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-10">
      <Toaster position="top-center" />
      <div className="max-w-xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-white">
              Halo, {user?.displayName?.split(" ")[0]} 👋
            </h1>
            <p className="text-zinc-500 text-sm mt-1">Siap latihan interview hari ini?</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-zinc-500 hover:text-white text-sm transition-colors"
          >
            Logout
          </button>
        </div>

        {/* Stats */}
        {sessions.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-8">
            <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-zinc-500 mb-1">Total Sesi</p>
              <p className="text-2xl font-semibold text-white">{sessions.length}</p>
            </div>
            <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-zinc-500 mb-1">Rata-rata Skor</p>
              <p className={`text-2xl font-semibold ${getVerdictColor(avgScore ?? 0)}`}>
                {avgScore ?? "—"}
              </p>
            </div>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={() => router.push("/setup")}
          className="w-full bg-white text-zinc-900 font-semibold text-sm rounded-2xl py-4 hover:bg-zinc-100 active:scale-[0.98] transition-all mb-8"
        >
          + Mulai Simulasi Interview Baru
        </button>

        {/* History */}
        <div>
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Riwayat Sesi</h2>

          {loadingHistory ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-10 text-zinc-600 text-sm">
              Belum ada sesi. Mulai interview pertamamu!
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3.5 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{s.company}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {s.field} · {s.level}
                    </p>
                    <p className="text-xs text-zinc-600 mt-0.5">
                      {s.createdAt?.toDate?.()?.toLocaleDateString("id-ID", {
                        day: "numeric", month: "short", year: "numeric"
                      }) ?? "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xl font-bold ${getVerdictColor(s.score)}`}>
                      {s.score}
                    </p>
                    <p className="text-xs text-zinc-500">{s.verdict}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}