import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { safeReturnPath } from "@/lib/auth-routing";
import { getAuthAppOrigin } from "@/lib/auth-origin";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Google sign-in is not configured. Use email and password or contact the hotel team." },
      { status: 503 }
    );
  }

  const appOrigin = getAuthAppOrigin(request);
  if (!appOrigin) {
    return NextResponse.json(
      { error: "Set APP_URL to this site's public origin before enabling Google sign-in." },
      { status: 500 }
    );
  }

  const redirectUri = new URL("/auth/callback", appOrigin).toString();
  const state = randomBytes(32).toString("hex");
  const next = safeReturnPath(searchParams.get("next"));
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    prompt: "select_account",
    state,
  });

  const secure = appOrigin.startsWith("https://");
  const cookieOptions = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/auth/callback",
    maxAge: 600,
  };
  const response = NextResponse.json({
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  });
  response.cookies.set("hotel_oauth_state", state, cookieOptions);
  response.cookies.set("hotel_oauth_next", next, cookieOptions);
  return response;
}
