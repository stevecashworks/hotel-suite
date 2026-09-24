import { NextResponse } from "next/server";
import {
  getHotelSnapshot,
  placeRoomServiceOrder,
  registerGuestScan,
  reserveRoom,
  toggleRoomAvailability,
  updateInventoryStock,
} from "@/lib/hotel-data";
import { saveReservationToDb } from "@/lib/reservation-db";

export async function GET() {
  return NextResponse.json(getHotelSnapshot());
}

export async function POST(request: Request) {
  const body = await request.json();

  if (body.action === "reserve-room") {
    const result = reserveRoom(body.payload);
    if (!result.error && body.payload?.roomId) {
      const room = getHotelSnapshot().rooms.find((item) => item.id === Number(body.payload.roomId));
      if (room) {
        await saveReservationToDb({
          name: body.payload.name,
          email: body.payload.email,
          phone: body.payload.phone,
          roomId: Number(body.payload.roomId),
          roomNumber: room.number,
          roomType: room.type,
          nights: Number(body.payload.nights),
          source: body.payload.source ?? "Reservation form",
        });
      }
    }
    return NextResponse.json(result);
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
