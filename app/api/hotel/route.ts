import { NextResponse } from "next/server";
import {
  getHotelSnapshot,
  placeRoomServiceOrder,
  registerGuestScan,
  reserveRoom,
  toggleRoomAvailability,
  updateInventoryStock,
} from "@/lib/hotel-data";

export async function GET() {
  return NextResponse.json(getHotelSnapshot());
}

export async function POST(request: Request) {
  const body = await request.json();

  if (body.action === "reserve-room") {
    return NextResponse.json(reserveRoom(body.payload));
  }

  if (body.action === "guest-scan") {
    return NextResponse.json(registerGuestScan(body.payload));
  }

  if (body.action === "inventory-update") {
    return NextResponse.json(updateInventoryStock(body.payload.itemId, body.payload.delta));
  }

  if (body.action === "room-service-order") {
    return NextResponse.json(placeRoomServiceOrder(body.payload));
  }

  if (body.action === "toggle-room-availability") {
    return NextResponse.json(toggleRoomAvailability(body.payload.roomId));
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
