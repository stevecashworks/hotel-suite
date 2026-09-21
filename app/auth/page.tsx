"use client";

import { FormEvent, useState } from "react";
import { Hotel, LogIn, UserPlus } from "lucide-react";
import styles from "./page.module.css";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const next = typeof window === "undefined" ? "/register" : new URLSearchParams(window.location.search).get("next") || "/register";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: mode, payload: { name: form.get("name"), email: form.get("email"), password: form.get("password") } }) });
    const data = await response.json(); setBusy(false);
    if (data.error) { setMessage(data.error); return; }
    window.location.assign(data.user.role === "staff" ? "/admin" : next);
  }
  return <main className={styles.page}><section className={styles.card}><div className={styles.brand}><Hotel size={22} /> Hotelier.</div><p className={styles.eyebrow}>{mode === "login" ? "Welcome back" : "Create a guest account"}</p><h1>{mode === "login" ? "Sign in to continue." : "Make every stay simpler."}</h1><div className={styles.tabs}><button onClick={() => setMode("login")} className={mode === "login" ? styles.active : ""}>Sign in</button><button onClick={() => setMode("signup")} className={mode === "signup" ? styles.active : ""}>Guest sign up</button></div><form onSubmit={submit} className={styles.form}>{mode === "signup" && <label>Full name<input name="name" required autoComplete="name" /></label>}<label>Email address<input name="email" type="email" required autoComplete="email" /></label><label>Password<input name="password" type="password" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>{message && <p className={styles.error} role="alert">{message}</p>}<button disabled={busy}>{mode === "login" ? <><LogIn size={17} /> Sign in</> : <><UserPlus size={17} /> Create account</>}</button></form><p className={styles.note}>Hotel staff: sign in with the credentials provided by management.</p></section></main>;
}
