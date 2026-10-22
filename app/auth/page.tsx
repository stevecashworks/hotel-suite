"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Hotel, LoaderCircle, LockKeyhole } from "lucide-react";
import SocialAuthButtons from "@/components/socialAuthButtons";
import { dashboardPathForRole, safeReturnPath } from "@/lib/auth-routing";
import type { PublicUser } from "@/lib/auth";
import styles from "./page.module.css";

function AuthContent() {
  const searchParams = useSearchParams();
  const next = safeReturnPath(searchParams.get("next"));
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const error = searchParams.get("error");
    if (error === "state") {
      setMessage("That sign-in attempt expired or could not be verified. Please try again.");
    } else if (error) {
      setMessage("Google sign-in could not be completed. Please try again or use your email.");
    }

    fetch("/api/auth")
      .then((response) => response.json())
      .then((data: { user?: PublicUser | null }) => {
        if (data.user) {
          window.location.replace(data.user.role === "guest" ? next : dashboardPathForRole(data.user.role));
          return;
        }
        setCheckingSession(false);
      })
      .catch(() => setCheckingSession(false));
  }, [next, searchParams]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode,
          next,
          payload: {
            name: form.get("name"),
            email: form.get("email"),
            password: form.get("password"),
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "We couldn't sign you in. Check your details and try again.");
        return;
      }

      window.location.assign(data.redirectTo || (data.user?.role === "staff" ? "/admin" : "/dashboard"));
    } catch {
      setMessage("A connection issue interrupted sign-in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (checkingSession) {
    return (
      <main className={styles.loadingPage}>
        <LoaderCircle className={styles.spinner} size={24} />
        <span>Checking your session...</span>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <aside className={styles.visualPanel}>
        <img src="/02_hotel_lobby.jpg" alt="Sunlit hotel lounge overlooking the water" />
        <div className={styles.visualShade} />
        <Link href="/" className={styles.brand}><Hotel size={21} /> Hotelier.</Link>
        <div className={styles.visualCopy}>
          <p>Hotel Suite Marina · Miami Beach</p>
          <h1>A stay that feels like yours.</h1>
          <span>Thoughtful rooms, warm service, and the coast just beyond the glass.</span>
        </div>
        <span className={styles.imageCredit}>A slower pace, by the water</span>
      </aside>

      <section className={styles.formPanel}>
        <Link href="/" className={styles.backLink}><ArrowLeft size={15} /> Back to hotel</Link>
        <div className={styles.formContent}>
          <p className={styles.eyebrow}>Your Hotelier account</p>
          <h2>{mode === "login" ? "Welcome back." : "Make room for a getaway."}</h2>
          <p className={styles.subtitle}>
            {mode === "login"
              ? "Sign in to manage your details and book your next stay."
              : "Create a guest account to make your next booking simpler."}
          </p>

          <div className={styles.modeSwitch} role="group" aria-label="Account access mode">
            <button
              type="button"
              aria-pressed={mode === "login"}
              className={mode === "login" ? styles.modeActive : ""}
              onClick={() => { setMode("login"); setMessage(""); }}
            >Sign in</button>
            <button
              type="button"
              aria-pressed={mode === "signup"}
              className={mode === "signup" ? styles.modeActive : ""}
              onClick={() => { setMode("signup"); setMessage(""); }}
            >Create account</button>
          </div>

          <SocialAuthButtons nextUrl={next} />

          <form onSubmit={submit} className={styles.form}>
            {mode === "signup" && (
              <label>
                Full name
                <input name="name" required autoComplete="name" placeholder="Your name" />
              </label>
            )}
            <label>
              Email address
              <input name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
            </label>
            <label>
              Password
              <span className={styles.passwordField}>
                <LockKeyhole size={16} aria-hidden="true" />
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>
            {message && <p className={styles.error} role="alert">{message}</p>}
            <button className={styles.submit} disabled={busy}>
              {busy ? <LoaderCircle size={17} className={styles.spinner} /> : <ArrowRight size={17} />}
              {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create guest account"}
            </button>
          </form>

          <p className={styles.staffNote}>Hotel staff? Sign in with the credentials provided by management.</p>
        </div>
        <footer className={styles.footer}>A considered welcome, from the moment you arrive.</footer>
      </section>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <main className={styles.loadingPage}>
          <LoaderCircle className={styles.spinner} size={24} />
          <span>Loading sign in...</span>
        </main>
      }
    >
      <AuthContent />
    </Suspense>
  );
}