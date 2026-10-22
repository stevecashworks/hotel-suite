import { NextRequest, NextResponse } from "next/server";
import {
  createMobileAuthCode,
  findExistingUserByEmail,
  type UserRole,
} from "@/lib/auth";
import { getAuthAppOrigin } from "@/lib/auth-origin";

const mobileStaffRoles: UserRole[] = ["staff", "kitchen", "bar", "room-service"];

export async function GET(request: NextRequest) {
  const appOrigin = getAuthAppOrigin(request);
  const redirectUri = request.cookies.get("hotel_mobile_oauth_redirect")?.value || "";
  const expectedState = request.cookies.get("hotel_mobile_oauth_state")?.value;
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const oauthError = request.nextUrl.searchParams.get("error");
  const clearCookie = {
    httpOnly: true,
    secure: Boolean(appOrigin?.startsWith("https://")),
    sameSite: "lax" as const,
    path: "/api/mobile/google/callback",
    maxAge: 0,
  };

  const redirectToApp = (params: Record<string, string>) => {
    const target = new URL(redirectUri);
    Object.entries(params).forEach(([key, value]) => target.searchParams.set(key, value));
    const response = NextResponse.redirect(target.toString());
    response.cookies.set("hotel_mobile_oauth_state", "", clearCookie);
    response.cookies.set("hotel_mobile_oauth_redirect", "", clearCookie);
    return response;
  };

  if (!redirectUri || !expectedState || state !== expectedState) {
    return NextResponse.json({ error: "Google sign-in state is invalid. Please try again." }, { status: 400 });
  }
  if (oauthError || !code) return redirectToApp({ error: "google" });

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    if (!clientId || !clientSecret || !appOrigin) {
      return redirectToApp({ error: "configuration" });
    }

    const callbackUri = new URL("/api/mobile/google/callback", appOrigin).toString();
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || tokenData.error || !tokenData.access_token) {
      return redirectToApp({ error: "google" });
    }

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileResponse.json();
    if (!profileResponse.ok || !profile.email || profile.email_verified !== true) {
      return redirectToApp({ error: "google" });
    }

    const user = await findExistingUserByEmail(profile.email);
    if (!user || !mobileStaffRoles.includes(user.role)) {
      return redirectToApp({ error: "staff_account_required" });
    }

    return redirectToApp({ code: createMobileAuthCode(user.id) });
  } catch (error) {
    console.error("Mobile Google sign-in failed:", error);
    return redirectToApp({ error: "google" });
  }
}
