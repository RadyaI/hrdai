"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collectionGroup, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

interface SessionData {
  id: string;
  name?: string;
  email?: string;
  company: string;
  field: string;
  level: string;
  score: number;
  verdict: string;
  summary: string;
  categories: any;
  strengths: string[];
  improvements: string[];
  tips: string[];
  createdAt: any;
}

export default function AdminPage() {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/");
        return;
      }

      if (user.email !== "radyaiftikhar@gmail.com") {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      setAuthorized(true);
      await fetchAllSessions();
    });

    return () => unsubscribe();
  }, [router]);

  const fetchAllSessions = async () => {
    try {
      const querySnapshot = await getDocs(collectionGroup(db, "sessions"));
      const data: SessionData[] = [];
      
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as SessionData);
      });

      data.sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
      });

      setSessions(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "-";
    return new Date(timestamp.toMillis()).toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const filteredSessions = sessions.filter((session) => {
    const query = searchQuery.toLowerCase();
    const name = (session.name || "Anonim").toLowerCase();
    const email = (session.email || "Anonim").toLowerCase();
    const company = (session.company || "").toLowerCase();
    const field = (session.field || "").toLowerCase();

    return (
      name.includes(query) ||
      email.includes(query) ||
      company.includes(query) ||
      field.includes(query)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-300">
        <p className="animate-pulse text-lg">Memuat data...</p>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-300 px-4 text-center">
        <h1 className="text-3xl font-bold text-red-500 mb-2">Akses Ditolak</h1>
        <p>Hanya ATMINTT yang bisa mengakses halaman ini.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 p-4 md:p-8">
      <div className="max-w-7xl mx-auto flex flex-col h-[calc(100vh-4rem)]">
        <header className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-zinc-400 mt-1">Daftar semua sesi evaluasi dari pengguna.</p>
          </div>
          <div className="w-full md:w-72">
            <input
              type="text"
              placeholder="Cari nama, email, perusahaan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-zinc-500 transition-colors placeholder:text-zinc-500"
            />
          </div>
        </header>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl flex-grow overflow-hidden flex flex-col">
          <div className="custom-scrollbar overflow-x-auto flex-grow">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead className="bg-zinc-900 sticky top-0 z-10 shadow-sm shadow-zinc-950">
                <tr>
                  <th className="px-6 py-4 border-b border-zinc-800 font-medium text-zinc-400 text-sm">Pengguna</th>
                  <th className="px-6 py-4 border-b border-zinc-800 font-medium text-zinc-400 text-sm">Profil Target</th>
                  <th className="px-6 py-4 border-b border-zinc-800 font-medium text-zinc-400 text-sm">Skor</th>
                  <th className="px-6 py-4 border-b border-zinc-800 font-medium text-zinc-400 text-sm">Verdict</th>
                  <th className="px-6 py-4 border-b border-zinc-800 font-medium text-zinc-400 text-sm">Tanggal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                      Tidak ada data yang ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map((session) => (
                    <tr key={session.id} className="hover:bg-zinc-800/50 transition-colors">
                      <td className="px-6 py-4 align-top">
                        <div className="font-medium text-white">{session.name || "Anonim"}</div>
                        <div className="text-sm text-zinc-500">{session.email || "Anonim"}</div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="flex flex-wrap gap-1.5 mb-1">
                          <span className="bg-zinc-800 text-zinc-300 text-xs px-2 py-0.5 rounded">
                            {session.company}
                          </span>
                          <span className="bg-zinc-800 text-zinc-300 text-xs px-2 py-0.5 rounded">
                            {session.field}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-500">Level: {session.level}</div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <span className="inline-flex items-center justify-center bg-zinc-800 text-white font-semibold text-sm h-8 w-8 rounded-full">
                          {session.score ?? "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4 align-top max-w-[300px]">
                        <div className="font-medium text-zinc-200 text-sm mb-1">{session.verdict || "-"}</div>
                        <div className="text-xs text-zinc-500 line-clamp-2" title={session.summary}>
                          {session.summary || "-"}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top text-sm text-zinc-400 whitespace-nowrap">
                        {formatDate(session.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}