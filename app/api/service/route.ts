import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { getReservationsForGuest } from "@/lib/reservation-db";
import {
  addMenuItem,
  answerRoomServiceCall,
  createRoomServiceCall,
  createServiceOrder,
  endRoomServiceCall,
  getServiceSnapshot,
  setMenuAvailability,
  updateServiceOrder,
  type ServiceDepartment,
  type ServiceOrderStatus,
} from "@/lib/service-db";

const orderStatuses: ServiceOrderStatus[] = ["new", "preparing", "ready", "delivered", "cancelled"];

export async function GET(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  if (user.role === "guest" || user.role === "staff" || user.role === "kitchen" || user.role === "bar" || user.role === "room-service") {
    const snapshot = await getServiceSnapshot(user);
    const reservations = user.role === "guest" ? await getReservationsForGuest(user.email) : [];
    return NextResponse.json({ ...snapshot, reservations });
  }
  return NextResponse.json({ error: "This account cannot access service operations." }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });

  try {
    const body = await request.json();
    const payload = body?.payload || {};

    if (body.action === "order-item") {
      if (user.role !== "guest") return NextResponse.json({ error: "Guest accounts place service orders." }, { status: 403 });
      const reservations = await getReservationsForGuest(user.email);
      if (!reservations.some((reservation) => reservation.roomNumber === String(payload.room))) {
        return NextResponse.json({ error: "Orders can only be sent to a room booked under your account." }, { status: 403 });
      }
      const result = await createServiceOrder({
        user,
        itemId: String(payload.itemId || ""),
        room: String(payload.room || ""),
        quantity: Number(payload.quantity),
      });
      return result.error
        ? NextResponse.json(result, { status: 400 })
        : NextResponse.json({ status: "success", ...result });
    }

    if (body.action === "add-menu-item") {
      if (user.role !== "kitchen" && user.role !== "bar") {
        return NextResponse.json({ error: "Department staff access is required." }, { status: 403 });
      }
      const name = String(payload.name || "").trim();
      const price = Number(payload.price);
      if (!name || !Number.isFinite(price) || price < 0 || price > 10000) {
        return NextResponse.json({ error: "Enter an item name and a valid price." }, { status: 400 });
      }
      const item = await addMenuItem({
        department: user.role as ServiceDepartment,
        name,
        description: String(payload.description || "").trim(),
        price,
        imageUrl: user.role === "bar" ? "/13_sky_bar.jpg" : "/07_dining.jpg",
      });
      return NextResponse.json({ status: "success", item });
    }

    if (body.action === "set-menu-availability") {
      if (user.role !== "kitchen" && user.role !== "bar") {
        return NextResponse.json({ error: "Department staff access is required." }, { status: 403 });
      }
      const item = await setMenuAvailability(String(payload.itemId || ""), Boolean(payload.available), user.role);
      return item
        ? NextResponse.json({ status: "success", item })
        : NextResponse.json({ error: "Menu item not found." }, { status: 404 });
    }

    if (body.action === "update-order") {
      if (user.role !== "staff" && user.role !== "kitchen" && user.role !== "bar") {
        return NextResponse.json({ error: "Department staff access is required." }, { status: 403 });
      }
      const status = String(payload.status) as ServiceOrderStatus;
      if (!orderStatuses.includes(status)) {
        return NextResponse.json({ error: "Choose a valid order status." }, { status: 400 });
      }
      const result = await updateServiceOrder(String(payload.orderId || ""), status, user.role);
      return result.error
        ? NextResponse.json(result, { status: 404 })
        : NextResponse.json({ status: "success", ...result });
    }

    if (body.action === "start-audio-call") {
      if (user.role !== "guest") return NextResponse.json({ error: "Guest accounts can request room service." }, { status: 403 });
      const reservations = await getReservationsForGuest(user.email);
      if (!reservations.some((reservation) => reservation.roomNumber === String(payload.room))) {
        return NextResponse.json({ error: "Room service calls are available from a room booked under your account." }, { status: 403 });
      }
      const result = await createRoomServiceCall({
        user,
        room: String(payload.room || ""),
        offer: String(payload.offer || ""),
      });
      return result.error
        ? NextResponse.json(result, { status: 400 })
        : NextResponse.json({ status: "success", ...result });
    }

    if (body.action === "answer-audio-call") {
      const result = await answerRoomServiceCall({
        id: String(payload.callId || ""),
        answer: String(payload.answer || ""),
        role: user.role,
      });
      return result.error
        ? NextResponse.json(result, { status: 403 })
        : NextResponse.json({ status: "success", ...result });
    }

    if (body.action === "end-audio-call") {
      if (user.role !== "guest" && user.role !== "room-service" && user.role !== "staff") {
        return NextResponse.json({ error: "Room-service access is required." }, { status: 403 });
      }
      const result = await endRoomServiceCall({ id: String(payload.callId || ""), user });
      return result.error
        ? NextResponse.json(result, { status: 404 })
        : NextResponse.json({ status: "success", ...result });
    }

    return NextResponse.json({ error: "Unsupported service action." }, { status: 400 });
  } catch (error) {
    console.error("Service operation failed:", error);
    return NextResponse.json({ error: "The service request could not be completed." }, { status: 500 });
  }
}