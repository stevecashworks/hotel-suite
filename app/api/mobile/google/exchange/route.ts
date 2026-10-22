import { NextRequest, NextResponse } from "next/server";
import { exchangeMobileAuthCode } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (typeof body?.code !== "string" || !body.code) {
      return NextResponse.json({ error: "Google sign-in code is missing." }, { status: 400 });
    }

    const session = exchangeMobileAuthCode(body.code);
    if (!session) {
      return NextResponse.json({ error: "Google sign-in code expired. Please try again." }, { status: 401 });
    }

    return NextResponse.json(session);
  } catch {
    return NextResponse.json({ error: "Google sign-in could not be completed." }, { status: 400 });
  }
}
