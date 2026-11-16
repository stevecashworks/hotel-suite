import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth-routing";
import { getDashboardMetricsFromDb } from "@/lib/reservation-db";
import { addRoomToDb, deleteRoomFromDb, toggleRoomStatusInDb } from "@/lib/room-db";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!isAdminRole(user.role)) {
    return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  }
  const data = await getDashboardMetricsFromDb();
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!isAdminRole(user.role)) {
    return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  }
  try {
    const body = await request.json();

    if (body.action === "add-room") {
      const room = await addRoomToDb(body.payload);
      const dashboard = await getDashboardMetricsFromDb();
      return NextResponse.json({
        status: "success",
        room,
        message: `Room ${room.number} successfully added to database.`,
        ...dashboard,
      });
    }

    if (body.action === "toggle-room-status") {
      const room = await toggleRoomStatusInDb(Number(body.payload.roomId), body.payload.status);
      const dashboard = await getDashboardMetricsFromDb();
      return NextResponse.json({
        status: "success",
        room,
        ...dashboard,
      });
    }

    if (body.action === "delete-room") {
      await deleteRoomFromDb(Number(body.payload.roomId));
      const dashboard = await getDashboardMetricsFromDb();
      return NextResponse.json({
        status: "success",
        message: "Room removed.",
        ...dashboard,
      });
    }

    return NextResponse.json({ error: "Unsupported admin action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Operation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
