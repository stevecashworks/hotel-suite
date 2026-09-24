import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider") || "google";
  const clientRedirectUri = searchParams.get("redirectUri");

  // Determine base app URL from runtime context, env, or request headers
  const appUrl =
    process.env.APP_URL ||
    (request.headers.get("x-forwarded-proto") && request.headers.get("host")
      ? `${request.headers.get("x-forwarded-proto")}://${request.headers.get("host")}`
      : "http://localhost:3000");

  const defaultCallback = `${appUrl.replace(/\/$/, "")}/auth/callback`;
  const redirectUri = clientRedirectUri || defaultCallback;

  if (provider === "google") {
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json({
        configured: false,
        provider: "google",
        callbackUrl: defaultCallback,
        message: "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.",
      });
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "online",
      prompt: "select_account",
      state: `google_${Date.now()}`,
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return NextResponse.json({
      configured: true,
      provider: "google",
      url: authUrl,
      callbackUrl: redirectUri,
    });
  }

  return NextResponse.json({ error: "Unsupported OAuth provider. Only Google is supported." }, { status: 400 });
}
