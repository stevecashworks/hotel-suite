import { NextRequest, NextResponse } from "next/server";
import { createSession, findOrCreateSocialUser, sessionMaxAge } from "@/lib/auth";
import { getAuthAppOrigin } from "@/lib/auth-origin";
import { dashboardPathForRole, safeReturnPath } from "@/lib/auth-routing";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const state = searchParams.get("state");
  const expectedState = request.cookies.get("hotel_oauth_state")?.value;
  const next = safeReturnPath(request.cookies.get("hotel_oauth_next")?.value);
  const appOrigin = getAuthAppOrigin(request);
  if (!appOrigin) {
    return new NextResponse("Google sign-in is not configured for this host. Set APP_URL and try again.", { status: 500 });
  }
  const redirectUri = new URL("/auth/callback", appOrigin).toString();
  const secure = new URL(appOrigin).protocol === "https:";
  const flowCookie = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/auth/callback",
    maxAge: 0,
  };

  const fail = (reason: string) => {
    const destination = new URL("/auth", appOrigin);
    destination.searchParams.set("error", reason);
    const response = NextResponse.redirect(destination);
    response.cookies.set("hotel_oauth_state", "", flowCookie);
    response.cookies.set("hotel_oauth_next", "", flowCookie);
    return response;
  };

  if (error) return fail("google");
  if (!code) return fail("google");
  if (!state || !expectedState || state !== expectedState) return fail("state");

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    if (!clientId || !clientSecret) return fail("configuration");

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || tokenData.error || !tokenData.access_token) return fail("google");

    const userInfoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const profile = await userInfoRes.json();
    if (!userInfoRes.ok || !profile.sub || !profile.email || profile.email_verified !== true) return fail("google");

    const { user } = await findOrCreateSocialUser({
      provider: "google",
      providerId: profile.sub,
      email: profile.email,
      name: profile.name || profile.given_name || "Google Guest",
      avatar: profile.picture,
      role: "guest",
    });

    const sessionToken = createSession(user.id);
    const destination = user.role === "guest" ? next : dashboardPathForRole(user.role);
    const response = NextResponse.redirect(new URL(destination, appOrigin));
    response.cookies.set("hotel_session", sessionToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: sessionMaxAge,
    });
    response.cookies.set("hotel_oauth_state", "", flowCookie);
    response.cookies.set("hotel_oauth_next", "", flowCookie);
    return response;
  } catch (err: unknown) {
    console.error("Google OAuth callback failed:", err);
    return fail("google");
  }
}
