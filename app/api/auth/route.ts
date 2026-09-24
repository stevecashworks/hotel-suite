import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  createSession,
  createUser,
  deleteSession,
  findOrCreateSocialUser,
  getRequestUser,
  getSocialAuthConfig,
  sessionMaxAge,
} from "@/lib/auth";

export function getCookieConfig(request?: NextRequest | Request) {
  // AI Studio preview iframe requires sameSite: "none" and secure: true for cookies to persist
  const host = request?.headers.get("host") || "";
  const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1");
  const isSecure = process.env.NODE_ENV === "production" || !isLocalhost;

  return {
    httpOnly: true,
    sameSite: (isSecure ? "none" : "lax") as "none" | "lax",
    secure: Boolean(isSecure),
    path: "/",
    maxAge: sessionMaxAge,
  };
}

export async function GET(request: NextRequest) {
  const user = getRequestUser(request);
  const socialConfig = getSocialAuthConfig();
  return NextResponse.json({ user, socialConfig });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const cookieOptions = getCookieConfig(request);

    if (body.action === "logout") {
      deleteSession(request.cookies.get("hotel_session")?.value);
      const response = NextResponse.json({ status: "success" });
      response.cookies.set("hotel_session", "", { ...cookieOptions, maxAge: 0 });
      return response;
    }

    let result;

    if (body.action === "signup") {
      result = await createUser({ ...body.payload, role: "guest" });
    } else if (body.action === "login") {
      result = await authenticate(body.payload.email, body.payload.password);
    } else if (body.action === "social-login") {
      // Social login (Google)
      const { provider, email, name, avatar, providerId } = body.payload || {};
      if (!email || !provider) {
        return NextResponse.json({ error: "Missing social profile information." }, { status: 400 });
      }
      result = await findOrCreateSocialUser({
        provider,
        providerId,
        email,
        name: name || email.split("@")[0],
        avatar,
        role: "guest",
      });
    } else {
      result = { error: "Unsupported auth action" };
    }

    if ("error" in result && result.error) {
      return NextResponse.json(result, { status: 400 });
    }

    if (!result.user) {
      return NextResponse.json({ error: "Authentication failed" }, { status: 400 });
    }

    const response = NextResponse.json({ user: result.user });
    response.cookies.set("hotel_session", createSession(result.user.id), cookieOptions);
    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Authentication error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
