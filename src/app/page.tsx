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
      <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="5" />
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
    score >= 80 ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
      score >= 60 ? "bg-blue-100 text-blue-700 border-blue-200" :
        score >= 40 ? "bg-amber-100 text-amber-700 border-amber-200" :
          "bg-red-100 text-red-700 border-red-200";
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
    <div
      className="min-h-screen overflow-x-hidden"
      style={{
        background: "#F4F0E8",
        fontFamily: "'Nunito', sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');

        * { font-family: 'Nunito', sans-serif; }

        .bento-card {
          background: #fff;
          border-radius: 20px;
          border: 1.5px solid rgba(0,0,0,0.06);
          transition: box-shadow 0.2s, transform 0.2s;
        }
        .bento-card:hover {
          box-shadow: 0 8px 32px rgba(0,0,0,0.07);
        }
        .session-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 14px;
          border-radius: 14px;
          cursor: pointer;
          transition: background 0.15s, transform 0.15s;
        }
        .session-row:hover {
          background: #F4F0E8;
          transform: translateX(3px);
        }
        .btn-main {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
          font-size: 14px;
          padding: 13px 22px;
          border-radius: 14px;
          border: none;
          cursor: pointer;
          transition: all 0.18s;
          font-family: 'Nunito', sans-serif;
        }
        .btn-main:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.12);
        }
        .btn-main:active {
          transform: scale(0.97);
        }
        .pulse-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: #D6FB61;
          animation: blink 2s infinite;
          display: inline-block;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .fade-up {
          opacity: 0;
          transform: translateY(16px);
          animation: fadeUp 0.5s ease forwards;
        }
        @keyframes fadeUp {
          to { opacity: 1; transform: translateY(0); }
        }

        .nav-wrap {
          padding: 0 40px;
        }
        .main-wrap {
          padding: 32px 40px 60px;
        }
        .grid-top {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 16px;
          margin-bottom: 16px;
        }
        .grid-bottom {
          display: grid;
          grid-template-columns: 340px 1fr;
          gap: 16px;
        }
        .hero-title {
          font-size: 42px;
        }
        .stats-wrap {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        @media (max-width: 900px) {
          .nav-wrap {
            padding: 0 20px;
          }
          .main-wrap {
            padding: 20px 20px 60px;
          }
          .grid-top {
            grid-template-columns: 1fr;
          }
          .grid-bottom {
            display: flex;
            flex-direction: column;
          }
          .hero-title {
            font-size: 32px;
          }
          .stats-wrap {
            flex-direction: row;
            flex-wrap: wrap;
          }
          .stats-wrap > div {
            flex: 1 1 40%;
          }
        }

        @media (max-width: 480px) {
          .stats-wrap {
            flex-direction: column;
          }
          .nav-wrap {
            padding: 0 16px;
          }
          .main-wrap {
            padding: 16px 16px 40px;
          }
        }
      `}</style>

      <Toaster position="top-right" toastOptions={{
        style: { background: "#1a1a1a", color: "#fff", borderRadius: "12px", fontSize: "14px" }
      }} />

      <nav className="nav-wrap" style={{
        background: "#fff",
        borderBottom: "1.5px solid rgba(0,0,0,0.06)",
        height: "60px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34,
            background: "#0F1A0A",
            borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D6FB61" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <span style={{ fontWeight: 800, fontSize: 17, color: "#0F1A0A", letterSpacing: "-0.3px" }}>
            HRD<span style={{ color: "#3D6B2C" }}>.ai</span>
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {user?.photoURL && (
            <img src={user.photoURL} alt="avatar"
              style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #D6FB61", objectFit: "cover" }} />
          )}
          <span style={{ fontSize: 13, color: "#6B7F60", fontWeight: 500 }} className="hidden sm:inline">
            {user?.displayName}
          </span>
          <button onClick={handleLogout} style={{
            fontSize: 12, fontWeight: 600, color: "#6B7F60",
            background: "transparent",
            border: "1.5px solid rgba(0,0,0,0.1)",
            borderRadius: 20, padding: "6px 14px",
            cursor: "pointer", fontFamily: "Nunito, sans-serif",
            transition: "all .15s",
          }}>
            Logout
          </button>
        </div>
      </nav>

      <div className="main-wrap">

        <div className={`grid-top ${mounted ? "fade-up" : ""}`} style={{ animationDelay: "0.05s" }}>
          <div className="bento-card" style={{
            padding: "36px 40px",
            background: "#0F1A0A",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: 220,
            position: "relative",
            overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", top: -60, right: -60,
              width: 220, height: 220,
              borderRadius: "50%",
              background: "rgba(214,251,97,0.08)",
              pointerEvents: "none",
            }} />

            <div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                background: "rgba(214,251,97,0.12)",
                border: "1px solid rgba(214,251,97,0.25)",
                borderRadius: 20, padding: "5px 12px",
                marginBottom: 20,
              }}>
                <span className="pulse-dot" />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#D6FB61", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  AI Interview Simulator
                </span>
              </div>

              <h1 className="hero-title" style={{
                fontWeight: 900,
                color: "#fff", lineHeight: 1.1,
                letterSpacing: "-1px", margin: 0,
              }}>
                Halo,{" "}
                <span style={{
                  background: "#D6FB61",
                  color: "#0F1A0A",
                  borderRadius: 8,
                  padding: "0 8px 2px",
                  display: "inline-block",
                  marginTop: 8
                }}>
                  {user?.displayName ?? "Kamu"}!
                </span>
              </h1>
            </div>

            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.45)", fontWeight: 400, margin: "16px 0 0" }}>
              Siap hajar interview hari ini? 🎯
            </p>
          </div>

          <div className="stats-wrap">
            {[
              { label: "Total Sesi", value: sessions.length || "—", suffix: sessions.length ? "x" : "" },
              { label: "Rata-rata Skor", value: avgScore ?? "—", suffix: avgScore ? "/100" : "" },
              { label: "Skor Terbaik", value: bestScore ?? "—", suffix: bestScore ? "/100" : "" },
            ].map((s) => (
              <div key={s.label} className="bento-card" style={{
                padding: "18px 22px",
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}>
                <span style={{ fontSize: 13, color: "#6B7F60", fontWeight: 600 }}>{s.label}</span>
                <span style={{ fontSize: 26, fontWeight: 900, color: "#0F1A0A", letterSpacing: "-0.5px" }}>
                  {s.value}
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#aaa" }}>{s.suffix}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid-bottom">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              className="btn-main"
              onClick={() => router.push("/setup")}
              style={{
                background: "#0F1A0A",
                color: "#D6FB61",
                width: "100%",
                justifyContent: "center",
                fontSize: 15,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Mulai Simulasi Interview
            </button>

            <button
              className="btn-main"
              onClick={() => router.push("/cv-roasting")}
              style={{
                background: "#fff",
                color: "#0F1A0A",
                border: "1.5px solid rgba(0,0,0,0.1)",
                width: "100%",
                justifyContent: "center",
                fontSize: 15,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              Roasting CV
            </button>
          </div>

          <div className="bento-card" style={{ padding: "24px 24px" }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 16,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Riwayat Sesi
              </span>
              {sessions.length > 0 && (
                <span style={{ fontSize: 12, color: "#bbb" }}>{sessions.length} sesi</span>
              )}
            </div>

            {loadingHistory ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
                <div style={{
                  width: 24, height: 24,
                  border: "2.5px solid rgba(0,0,0,0.06)",
                  borderTop: "2.5px solid #3D6B2C",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : sessions.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "48px 24px",
                border: "1.5px dashed rgba(0,0,0,0.08)",
                borderRadius: 14,
              }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🎤</div>
                <p style={{ fontSize: 14, color: "#6B7F60", marginBottom: 4, fontWeight: 600 }}>Belum ada sesi interview</p>
                <p style={{ fontSize: 12, color: "#bbb" }}>Mulai simulasi pertamamu di atas!</p>
              </div>
            ) : (
              <div>
                {sessions.map((s) => (
                  <div key={s.id} className="session-row">
                    <ScoreRing score={s.score} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                        <p style={{ fontWeight: 700, color: "#0F1A0A", fontSize: 14, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {s.company}
                        </p>
                        <VerdictBadge verdict={s.verdict} score={s.score} />
                      </div>
                      <p style={{ fontSize: 12, color: "#6B7F60", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.field} · {s.level}
                      </p>
                      <p style={{ fontSize: 11, color: "#bbb", margin: "2px 0 0" }}>
                        {s.createdAt?.toDate?.()?.toLocaleDateString("id-ID", {
                          day: "numeric", month: "short", year: "numeric"
                        }) ?? "—"}
                      </p>
                    </div>
                    <svg style={{ color: "#ccc", flexShrink: 0 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <p style={{ textAlign: "center", fontSize: 11, color: "#bbb", paddingBottom: 32 }}>
        HRD.ai · Made with 🤖🫰
      </p>
    </div>
  );
}