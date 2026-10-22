"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { FcGoogle } from "react-icons/fc";

interface SocialAuthButtonsProps {
  nextUrl?: string;
  showDivider?: boolean;
}

export default function SocialAuthButtons({
  nextUrl = "/dashboard",
  showDivider = true,
}: SocialAuthButtonsProps) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function startGoogleSignIn() {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/auth/url?next=${encodeURIComponent(nextUrl)}`);
      const data = await response.json();
      if (!response.ok || !data.url) {
        setErrorMessage(data.error || "Google sign-in is unavailable right now.");
        setLoading(false);
        return;
      }

      window.location.assign(data.url);
    } catch {
      setErrorMessage("Could not start Google sign-in. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="mt-5 grid gap-2.5">
      {errorMessage && <p className="border-l-[3px] border-[#b34f40] bg-[#f8eae6] px-3 py-2 text-xs leading-relaxed text-[#8d3e34]" role="alert">{errorMessage}</p>}
      <button
        type="button"
        onClick={startGoogleSignIn}
        disabled={loading}
        className="flex min-h-12 w-full items-center justify-center gap-3 border border-[#d8ded6] bg-[#fbfcf8] text-sm font-semibold text-[#32473b] transition-colors hover:bg-[#eef2ec] disabled:cursor-wait disabled:opacity-65"
      >
        {loading ? <LoaderCircle size={19} className="animate-spin" /> : <FcGoogle size={20} />}
        <span>{loading ? "Connecting to Google..." : "Continue with Google"}</span>
      </button>
      {showDivider && (
        <div className="my-1 flex items-center gap-3 text-[.68rem] font-semibold uppercase tracking-[.12em] text-[#939c93]">
          <span className="h-px flex-1 bg-[#dce2d9]" />
          <span>or use your email</span>
          <span className="h-px flex-1 bg-[#dce2d9]" />
        </div>
      )}
    </div>
  );
}