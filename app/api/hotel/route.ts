import { NextResponse } from "next/server";
import {
  getHotelSnapshot,
  placeRoomServiceOrder,
  registerGuestScan,
  reserveRoom,
  updateInventoryStock,
} from "@/lib/hotel-data";
import {
  getRoomsFromDb,
  addRoomToDb,
  toggleRoomStatusInDb,
  deleteRoomFromDb,
} from "@/lib/room-db";
import { saveReservationToDb } from "@/lib/reservation-db";

export async function GET() {
  const rooms = await getRoomsFromDb();
  const snapshot = getHotelSnapshot();
  return NextResponse.json({
    ...snapshot,
    rooms,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.action === "get-rooms") {
      const rooms = await getRoomsFromDb();
      return NextResponse.json({ status: "success", rooms });
    }

    if (body.action === "add-room") {
      if (!body.payload?.number || !body.payload?.type || !body.payload?.price) {
        return NextResponse.json(
          { error: "Room number, suite type, and price are required." },
          { status: 400 }
        );
      }
      try {
        const newRoom = await addRoomToDb(body.payload);
        const rooms = await getRoomsFromDb();
        return NextResponse.json({
          status: "success",
          room: newRoom,
          rooms,
          message: `Room ${newRoom.number} added successfully.`,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to create room.";
        return NextResponse.json(
          { error: message },
          { status: 400 }
        );
      }
    }

    if (body.action === "toggle-room-availability") {
      const roomId = Number(body.payload?.roomId);
      if (!roomId) {
        return NextResponse.json({ error: "Room ID is required" }, { status: 400 });
      }
      const updated = await toggleRoomStatusInDb(roomId, body.payload?.status);
      const rooms = await getRoomsFromDb();
      return NextResponse.json({ status: "success", room: updated, rooms });
    }

    if (body.action === "delete-room") {
      const roomId = Number(body.payload?.roomId);
      if (!roomId) {
        return NextResponse.json({ error: "Room ID is required" }, { status: 400 });
      }
      await deleteRoomFromDb(roomId);
      const rooms = await getRoomsFromDb();
      return NextResponse.json({ status: "success", rooms });
    }

    if (body.action === "reserve-room") {
      const result = reserveRoom(body.payload);
      if (!result.error && body.payload?.roomId) {
        const rooms = await getRoomsFromDb();
        const room = rooms.find((item) => item.id === Number(body.payload.roomId));
        if (room) {
          await toggleRoomStatusInDb(room.id, "booked");
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
      const rooms = await getRoomsFromDb();
      return NextResponse.json({ ...result, rooms });
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

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
