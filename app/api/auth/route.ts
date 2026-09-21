import { NextRequest, NextResponse } from "next/server";
import { authenticate, createSession, createUser, deleteSession, getRequestUser, sessionMaxAge } from "@/lib/auth";

const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: sessionMaxAge };

export async function GET(request: NextRequest) {
  return NextResponse.json({ user: getRequestUser(request) });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (body.action === "logout") {
    deleteSession(request.cookies.get("hotel_session")?.value);
    const response = NextResponse.json({ status: "success" });
    response.cookies.set("hotel_session", "", { ...cookieOptions, maxAge: 0 });
    return response;
  }
  const result = body.action === "signup"
    ? createUser({ ...body.payload, role: "guest" })
    : body.action === "login"
      ? authenticate(body.payload.email, body.payload.password)
      : { error: "Unsupported action" };
  if ("error" in result) return NextResponse.json(result, { status: 400 });
  const response = NextResponse.json({ user: result.user });
  response.cookies.set("hotel_session", createSession(result.user.id), cookieOptions);
  return response;
}
