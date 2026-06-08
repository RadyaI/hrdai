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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
      
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-[#D6FB61]/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-sky-200/30 rounded-full blur-[120px] pointer-events-none" />

      <Toaster position="top-center" />

      <div className="w-full max-w-md bg-white rounded-[2.5rem] p-8 md:p-10 shadow-xl shadow-slate-200/40 border border-slate-100 relative z-10">
        
        <div className="mb-10 text-center flex flex-col items-center">
          <div className="flex items-center justify-center w-20 h-20 rounded-full bg-[#D6FB61] mb-6">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#0f172a"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">HRD.ai</h1>
          <p className="text-slate-500 font-medium">Simulasi interview berbasis AI</p>
        </div>

        <div className="mb-8">
          <p className="text-slate-600 text-center text-sm md:text-base leading-relaxed px-2">
            Latih skill interview kamu bareng AI yang berperan sebagai HRD dari berbagai perusahaan.
          </p>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 text-slate-800 font-bold text-base rounded-2xl px-6 py-4 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
          )}
          {loading ? "Menghubungkan..." : "Masuk dengan Google"}
        </button>

        <div className="mt-8 pt-6 border-t border-slate-100">
          <p className="text-center text-sm text-slate-400 font-semibold tracking-wide">
            Made with 🤖🫰
          </p>
        </div>
        
      </div>
    </div>
  );
}