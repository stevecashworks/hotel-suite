import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getAuthAppOrigin } from "@/lib/auth-origin";

function isMobileRedirectUri(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol === "hotelapp:" && url.hostname === "auth" && url.pathname === "/callback") {
      return true;
    }
    return url.protocol === "exp:" && url.pathname.endsWith("/--/auth/callback");
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Google sign-in is not configured." }, { status: 503 });
  }

  const appOrigin = getAuthAppOrigin(request);
  if (!appOrigin) {
    return NextResponse.json({ error: "Google sign-in is not configured for this host." }, { status: 500 });
  }

  const redirectUri = request.nextUrl.searchParams.get("redirect_uri") || "";
  if (!isMobileRedirectUri(redirectUri)) {
    return NextResponse.json({ error: "Invalid mobile sign-in redirect." }, { status: 400 });
  }

  const state = randomBytes(32).toString("hex");
  const callbackUri = new URL("/api/mobile/google/callback", appOrigin).toString();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUri,
    response_type: "code",
    scope: "openid email profile",
    prompt: "select_account",
    state,
  });
  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
  response.cookies.set("hotel_mobile_oauth_state", state, {
    httpOnly: true,
    secure: appOrigin.startsWith("https://"),
    sameSite: "lax",
    path: "/api/mobile/google/callback",
    maxAge: 600,
  });
  response.cookies.set("hotel_mobile_oauth_redirect", redirectUri, {
    httpOnly: true,
    secure: appOrigin.startsWith("https://"),
    sameSite: "lax",
    path: "/api/mobile/google/callback",
    maxAge: 600,
  });
  return response;
}
