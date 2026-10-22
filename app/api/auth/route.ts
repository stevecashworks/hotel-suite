import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  createSession,
  createUser,
  deleteSession,
  getRequestUser,
  getSocialAuthConfig,
  sessionMaxAge,
} from "@/lib/auth";
import { dashboardPathForRole, safeReturnPath } from "@/lib/auth-routing";

export function getCookieConfig(request?: NextRequest | Request) {
  const origin = request ? new URL(request.url).origin : "";
  const isSecure = process.env.NODE_ENV === "production" || origin.startsWith("https://");

  return {
    httpOnly: true,
    sameSite: "lax" as const,
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

    if (!body || typeof body.action !== "string") {
      return NextResponse.json({ error: "Choose a valid authentication action." }, { status: 400 });
    }

    if (body.action === "logout") {
      deleteSession(request.cookies.get("hotel_session")?.value);
      const response = NextResponse.json({ status: "success" });
      response.cookies.set("hotel_session", "", { ...cookieOptions, maxAge: 0 });
      return response;
    }

    let result;

    if (body.action === "signup") {
      const { name, email, password } = body.payload || {};
      if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string") {
        return NextResponse.json({ error: "Enter your name, email address, and password." }, { status: 400 });
      }
      result = await createUser({ name, email, password, role: "guest" });
    } else if (body.action === "login") {
      const { email, password } = body.payload || {};
      if (typeof email !== "string" || typeof password !== "string") {
        return NextResponse.json({ error: "Enter your email address and password." }, { status: 400 });
      }
      result = await authenticate(email, password);
    } else {
      result = { error: "Unsupported auth action" };
    }

    if ("error" in result && result.error) {
      return NextResponse.json(result, { status: 400 });
    }

    if (!result.user) {
      return NextResponse.json({ error: "Authentication failed" }, { status: 400 });
    }

    const redirectTo = result.user.role === "guest"
      ? safeReturnPath(body.next)
      : dashboardPathForRole(result.user.role);
    const response = NextResponse.json({ user: result.user, redirectTo });
    response.cookies.set("hotel_session", createSession(result.user.id), cookieOptions);
    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Authentication error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
