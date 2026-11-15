import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth-routing";
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
import { recordHotelEvent } from "@/lib/hotel-events";

export async function GET() {
  const rooms = await getRoomsFromDb();
  const snapshot = getHotelSnapshot();
  return NextResponse.json({
    ...snapshot,
    rooms,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const user = getRequestUser(request);

    if (body.action === "get-rooms") {
      const rooms = await getRoomsFromDb();
      return NextResponse.json({ status: "success", rooms });
    }

    if (body.action === "add-room") {
      if (!user || !isAdminRole(user.role)) {
        return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
      }
      if (!body.payload?.number || !body.payload?.type || !body.payload?.price) {
        return NextResponse.json(
          { error: "Room number, suite type, and price are required." },
          { status: 400 }
        );
      }
      try {
        const newRoom = await addRoomToDb(body.payload);
        await recordHotelEvent({
          type: "room.created",
          title: "Room added",
          message: `Room ${newRoom.number} (${newRoom.type}) was added to the inventory.`,
        });
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
      if (!user || !isAdminRole(user.role)) {
        return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
      }
      const roomId = Number(body.payload?.roomId);
      if (!roomId) {
        return NextResponse.json({ error: "Room ID is required" }, { status: 400 });
      }
      const updated = await toggleRoomStatusInDb(roomId, body.payload?.status);
      if (updated) {
        await recordHotelEvent({
          type: updated.status === "maintenance" ? "room.maintenance" : "room.available",
          title: "Room status changed",
          message: `Room ${updated.number} is now ${updated.status}.`,
        });
      }
      const rooms = await getRoomsFromDb();
      return NextResponse.json({ status: "success", room: updated, rooms });
    }

    if (body.action === "delete-room") {
      if (!user || !isAdminRole(user.role)) {
        return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
      }
      const roomId = Number(body.payload?.roomId);
      if (!roomId) {
        return NextResponse.json({ error: "Room ID is required" }, { status: 400 });
      }
      await deleteRoomFromDb(roomId);
      await recordHotelEvent({
        type: "room.deleted",
        title: "Room removed",
        message: `Room ${roomId} was removed from the inventory.`,
      });
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
            checkIn: body.payload.checkIn,
            source: body.payload.source ?? "Reservation form",
          });
          await recordHotelEvent({
            type: "reservation.created",
            title: "New reservation",
            message: `${body.payload.name} reserved Room ${room.number} for ${Number(body.payload.nights)} night(s).`,
          });
        }
      }
      const rooms = await getRoomsFromDb();
      return NextResponse.json({ ...result, rooms });
    }

    if (body.action === "guest-scan") {
      const result = registerGuestScan(body.payload);
      if (result.guest) {
        await recordHotelEvent({
          type: "guest.check-in",
          title: "Guest checked in",
          message: `${result.guest.name} checked in to Room ${result.guest.room}.`,
        });
      }
      return NextResponse.json(result);
    }

    if (body.action === "inventory-update") {
      const result = updateInventoryStock(body.payload.itemId, body.payload.delta);
      const item = result.inventory.find((entry) => entry.id === Number(body.payload.itemId));
      if (item) {
        await recordHotelEvent({
          type: "inventory.updated",
          title: "Inventory updated",
          message: `${item.name} stock changed to ${item.stock}.`,
        });
      }
      return NextResponse.json(result);
    }

    if (body.action === "room-service-order") {
      const result = placeRoomServiceOrder(body.payload);
      if (result.status === "ordered") {
        await recordHotelEvent({
          type: "service.order",
          title: "Room service order",
          message: `${result.itemName} was ordered for Room ${result.roomNumber}.`,
        });
      }
      return NextResponse.json(result);
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
