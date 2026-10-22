import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  createSession,
  deleteSession,
  getRequestUser,
} from "@/lib/auth";

const mobileStaffRoles = ["staff", "kitchen", "bar", "room-service"];

export async function GET(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!mobileStaffRoles.includes(user.role)) {
    return NextResponse.json({ error: "This app is for hotel staff only." }, { status: 403 });
  }

  return NextResponse.json({ user });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (body?.action === "logout") {
      const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
      deleteSession(token);
      return NextResponse.json({ status: "success" });
    }

    if (body?.action !== "login") {
      return NextResponse.json(
        { error: "Staff accounts are created by hotel management. Sign in with your assigned account." },
        { status: 400 }
      );
    }

    const payload = body.payload || {};
    if (typeof payload.email !== "string" || typeof payload.password !== "string") {
      return NextResponse.json({ error: "Enter your email address and password." }, { status: 400 });
    }

    const result = await authenticate(payload.email, payload.password);
    if ("error" in result && result.error) {
      return NextResponse.json(result, { status: 401 });
    }
    if (!result.user) {
      return NextResponse.json({ error: "Authentication failed." }, { status: 401 });
    }
    if (!mobileStaffRoles.includes(result.user.role)) {
      return NextResponse.json({ error: "This app is for hotel staff only." }, { status: 403 });
    }

    return NextResponse.json({ user: result.user, token: createSession(result.user.id) });
  } catch {
    return NextResponse.json(
      { error: "The mobile sign-in request could not be completed." },
      { status: 500 }
    );
  }
}
