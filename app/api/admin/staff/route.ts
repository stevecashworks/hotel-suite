import { NextRequest, NextResponse } from "next/server";
import { getRequestUser, provisionStaffUser, type UserRole } from "@/lib/auth";

const staffRoles: UserRole[] = ["staff", "kitchen", "bar", "room-service"];

export async function POST(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user || user.role !== "staff") {
    return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const role = body.role;
    if (typeof role !== "string" || !staffRoles.includes(role as UserRole)) {
      return NextResponse.json({ error: "Choose a valid staff role." }, { status: 400 });
    }

    const result = await provisionStaffUser({ email, role: role as Exclude<UserRole, "guest"> });
    return result.error
      ? NextResponse.json(result, { status: 400 })
      : NextResponse.json({ status: "success", user: result.user });
  } catch {
    return NextResponse.json({ error: "The staff account could not be added." }, { status: 400 });
  }
}