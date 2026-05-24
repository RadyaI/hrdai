"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import toast, { Toaster } from "react-hot-toast";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) router.replace("/");
      else setChecking(false);
    });
    return () => unsub();
  }, [router]);

  async function handleGoogleLogin() {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success("Berhasil login!");
      router.replace("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login gagal";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <Toaster position="top-center" />

      <div className="w-full max-w-sm">
        {}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/5 border border-white/10 mb-5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">HRD.ai</h1>
          <p className="text-sm text-zinc-500 mt-1">Simulasi interview berbasis AI</p>
        </div>

        {}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-7">
          <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
            Latih skill interview kamu bareng AI yang berperan sebagai HRD dari berbagai perusahaan.
          </p>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white text-zinc-900 font-medium text-sm rounded-xl px-4 py-3 hover:bg-zinc-100 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-zinc-400 border-t-zinc-900 rounded-full animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            )}
            {loading ? "Menghubungkan..." : "Masuk dengan Google"}
          </button>
        </div>

        <p className="text-center text-xs text-zinc-600 mt-6">
          Made with 🤖🫰
        </p>
      </div>
    </div>
  );
}