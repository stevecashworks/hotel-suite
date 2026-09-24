"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Hotel, LogIn, UserCheck, UserPlus } from "lucide-react";
import styles from "./page.module.css";
import SocialAuthButtons from "@/components/socialAuthButtons";
import { PublicUser } from "@/lib/auth";

function AuthContent() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/register";

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [currentUser, setCurrentUser] = useState<PublicUser | null>(null);

  // Check if user is already authenticated
  useEffect(() => {
    fetch("/api/auth")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: mode,
        payload: {
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
        },
      }),
    });

    const data = await response.json();
    setBusy(false);

    if (data.error) {
      setMessage(data.error);
      return;
    }

    window.location.assign(data.user.role === "staff" ? "/admin" : next);
  }

  const handleSocialSuccess = (user: PublicUser) => {
    setCurrentUser(user);
    setTimeout(() => {
      window.location.assign(user.role === "staff" ? "/admin" : next);
    }, 600);
  };

  const handleSignOut = async () => {
    setBusy(true);
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    setCurrentUser(null);
    setBusy(false);
  };

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.brand}>
          <Hotel size={22} /> Hotelier.
        </div>

        {currentUser ? (
          <div className="mt-6 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[#ead8bf]/40 border border-[#99724e]/30 flex items-center justify-center text-[#65452e]">
              {currentUser.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <UserCheck size={28} />
              )}
            </div>
            <p className={styles.eyebrow}>Active Session</p>
            <h1 className="text-2xl font-serif text-[#211914] mt-1">Welcome back, {currentUser.name}</h1>
            <p className="text-xs text-[#7c5c43] mt-1">
              Signed in as {currentUser.email} {currentUser.provider ? `(${currentUser.provider})` : ""}
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
              <a
                href={currentUser.role === "staff" ? "/admin" : next}
                className="w-full py-3 px-4 rounded-full bg-[#65452e] text-[#fffaf4] font-semibold text-xs tracking-wider uppercase inline-flex items-center justify-center gap-2 hover:bg-[#523724] transition-colors"
              >
                <CheckCircle2 size={16} /> Continue to {currentUser.role === "staff" ? "Admin Command Center" : "Guest Portal"}
              </a>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={busy}
                className="w-full py-2.5 px-4 rounded-full border border-[#ead8bf] text-[#65452e] font-semibold text-xs hover:bg-[#ead8bf]/20 transition-colors"
              >
                Sign out of account
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className={styles.eyebrow}>{mode === "login" ? "Welcome back" : "Create a guest account"}</p>
            <h1>{mode === "login" ? "Sign in to continue." : "Make every stay simpler."}</h1>

            <div className={styles.tabs}>
              <button
                type="button"
                onClick={() => setMode("login")}
                className={mode === "login" ? styles.active : ""}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={mode === "signup" ? styles.active : ""}
              >
                Guest sign up
              </button>
            </div>

            {/* Social Authentication Options (Google) */}
            <SocialAuthButtons nextUrl={next} onSuccess={handleSocialSuccess} showDivider={true} />

            <form onSubmit={submit} className={styles.form}>
              {mode === "signup" && (
                <label>
                  Full name
                  <input name="name" required autoComplete="name" placeholder="e.g. Eleanor Vance" />
                </label>
              )}
              <label>
                Email address
                <input name="email" type="email" required autoComplete="email" placeholder="name@example.com" />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder="At least 8 characters"
                />
              </label>
              {message && (
                <p className={styles.error} role="alert">
                  {message}
                </p>
              )}
              <button disabled={busy}>
                {mode === "login" ? (
                  <>
                    <LogIn size={17} /> Sign in
                  </>
                ) : (
                  <>
                    <UserPlus size={17} /> Create account
                  </>
                )}
              </button>
            </form>

            <p className={styles.note}>
              Hotel staff: sign in with credentials provided by management, or connect using an authorized account.
            </p>
          </>
        )}
      </section>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <main className={styles.page}>
          <section className={styles.card}>
            <div className={styles.brand}>
              <Hotel size={22} /> Hotelier.
            </div>
            <p className="text-sm text-[#7c5c43] mt-4">Loading authentication…</p>
          </section>
        </main>
      }
    >
      <AuthContent />
    </Suspense>
  );
}
