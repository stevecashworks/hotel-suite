import { randomUUID } from "crypto";
import mongoose from "mongoose";
import connect_db from "@/lib/mongodb";
import type { PublicUser, UserRole } from "@/lib/auth";

export type ServiceDepartment = "kitchen" | "bar";
export type ServiceOrderStatus = "new" | "preparing" | "ready" | "delivered" | "cancelled";

export type ServiceMenuItem = {
  id: string;
  department: ServiceDepartment;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  available: boolean;
};

export type ServiceOrder = {
  id: string;
  guestName: string;
  guestEmail: string;
  room: string;
  itemName: string;
  department: ServiceDepartment;
  quantity: number;
  price: number;
  status: ServiceOrderStatus;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type RoomServiceCall = {
  id: string;
  guestName: string;
  guestEmail: string;
  room: string;
  status: "ringing" | "active" | "ended";
  offer?: string;
  answer?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

const menuSchema = new mongoose.Schema(
  {
    itemId: { type: String, required: true, unique: true, index: true },
    department: { type: String, enum: ["kitchen", "bar"], required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true },
    imageUrl: { type: String, default: "/07_dining.jpg" },
    available: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true, index: true },
    guestName: { type: String, required: true },
    guestEmail: { type: String, required: true, index: true },
    room: { type: String, required: true },
    itemName: { type: String, required: true },
    department: { type: String, enum: ["kitchen", "bar"], required: true, index: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    status: { type: String, enum: ["new", "preparing", "ready", "delivered", "cancelled"], default: "new" },
  },
  { timestamps: true }
);

const callSchema = new mongoose.Schema(
  {
    callId: { type: String, required: true, unique: true, index: true },
    guestName: { type: String, required: true },
    guestEmail: { type: String, required: true, index: true },
    room: { type: String, required: true },
    status: { type: String, enum: ["ringing", "active", "ended"], default: "ringing", index: true },
    offer: { type: String },
    answer: { type: String },
  },
  { timestamps: true }
);

const MenuModel = mongoose.models.ServiceMenuItem ?? mongoose.model("ServiceMenuItem", menuSchema);
const OrderModel = mongoose.models.ServiceOrder ?? mongoose.model("ServiceOrder", orderSchema);
const CallModel = mongoose.models.RoomServiceCall ?? mongoose.model("RoomServiceCall", callSchema);

const seedMenu: ServiceMenuItem[] = [
  { id: "seed-coastal-breakfast", department: "kitchen", name: "Coastal breakfast", description: "Seasonal fruit, warm pastries, and fresh juice", price: 24, imageUrl: "/07_dining.jpg", available: true },
  { id: "seed-lobster-roll", department: "kitchen", name: "Butter-poached lobster roll", description: "Herb butter, crisp greens, toasted brioche", price: 38, imageUrl: "/12_ember.jpg", available: true },
  { id: "seed-garden-salad", department: "kitchen", name: "Marina garden salad", description: "Local greens, citrus, toasted seeds", price: 19, imageUrl: "/07_dining.jpg", available: true },
  { id: "seed-citrus-spritz", department: "bar", name: "Citrus garden spritz", description: "Orange, rosemary, sparkling water", price: 16, imageUrl: "/13_sky_bar.jpg", available: true },
  { id: "seed-passion-martini", department: "bar", name: "Passionfruit martini", description: "Passionfruit, lime, vanilla", price: 21, imageUrl: "/13_sky_bar.jpg", available: true },
  { id: "seed-still-water", department: "bar", name: "Still mineral water", description: "Chilled, 750 ml", price: 8, imageUrl: "/13_sky_bar.jpg", available: true },
];

let menuCache = [...seedMenu];
let orderCache: ServiceOrder[] = [];
let callCache: RoomServiceCall[] = [];

function formatMenu(doc: Record<string, unknown>): ServiceMenuItem {
  return {
    id: String(doc.itemId),
    department: doc.department as ServiceDepartment,
    name: String(doc.name),
    description: String(doc.description || ""),
    price: Number(doc.price),
    imageUrl: String(doc.imageUrl || "/07_dining.jpg"),
    available: Boolean(doc.available),
  };
}

function formatOrder(doc: Record<string, unknown>): ServiceOrder {
  return {
    id: String(doc.orderId),
    guestName: String(doc.guestName),
    guestEmail: String(doc.guestEmail),
    room: String(doc.room),
    itemName: String(doc.itemName),
    department: doc.department as ServiceDepartment,
    quantity: Number(doc.quantity),
    price: Number(doc.price),
    status: doc.status as ServiceOrderStatus,
    createdAt: doc.createdAt as Date | string,
    updatedAt: doc.updatedAt as Date | string,
  };
}

function formatCall(doc: Record<string, unknown>): RoomServiceCall {
  return {
    id: String(doc.callId),
    guestName: String(doc.guestName),
    guestEmail: String(doc.guestEmail),
    room: String(doc.room),
    status: doc.status as RoomServiceCall["status"],
    offer: doc.offer ? String(doc.offer) : undefined,
    answer: doc.answer ? String(doc.answer) : undefined,
    createdAt: doc.createdAt as Date | string,
    updatedAt: doc.updatedAt as Date | string,
  };
}

function visibleTo(user: PublicUser, department: ServiceDepartment) {
  return user.role === "staff" || user.role === department;
}

export async function getServiceSnapshot(user: PublicUser) {
  try {
    const conn = await connect_db();
    if (!conn) throw new Error("MongoDB not connected");

    if (await MenuModel.countDocuments() === 0) {
      await MenuModel.insertMany(seedMenu.map((item) => ({
        itemId: item.id,
        department: item.department,
        name: item.name,
        description: item.description,
        price: item.price,
        imageUrl: item.imageUrl,
        available: item.available,
      })));
    }

    const menuDocs = await MenuModel.find().sort({ department: 1, name: 1 }).lean();
    menuCache = menuDocs.map((doc) => formatMenu(doc as unknown as Record<string, unknown>));
    const orderQuery = user.role === "guest"
      ? { guestEmail: user.email }
      : user.role === "staff"
      ? {}
      : { department: user.role };
    const callQuery = user.role === "guest"
      ? { guestEmail: user.email }
      : { status: { $ne: "ended" } };
    const [orderDocs, callDocs] = await Promise.all([
      OrderModel.find(orderQuery).sort({ createdAt: -1 }).limit(60).lean(),
      CallModel.find(callQuery).sort({ createdAt: -1 }).limit(20).lean(),
    ]);
    orderCache = orderDocs.map((doc) => formatOrder(doc as unknown as Record<string, unknown>));
    callCache = callDocs.map((doc) => formatCall(doc as unknown as Record<string, unknown>));

    return {
      menu: menuCache.filter((item) => user.role !== "guest" || item.available),
      orders: orderCache,
      calls: callCache,
    };
  } catch {
    return {
      menu: menuCache.filter((item) => user.role !== "guest" || item.available),
      orders: orderCache.filter((order) =>
        user.role === "guest" ? order.guestEmail === user.email : visibleTo(user, order.department)
      ),
      calls: callCache.filter((call) => user.role === "guest" ? call.guestEmail === user.email : call.status !== "ended"),
    };
  }
}

export async function addMenuItem(input: Omit<ServiceMenuItem, "id" | "available">) {
  const item: ServiceMenuItem = { ...input, id: randomUUID(), available: true };
  menuCache = [item, ...menuCache];
  try {
    const conn = await connect_db();
    if (conn) await MenuModel.create({
      itemId: item.id,
      department: item.department,
      name: item.name,
      description: item.description,
      price: item.price,
      imageUrl: item.imageUrl,
      available: true,
    });
  } catch (error) {
    console.warn("Menu item persistence failed; stored in memory:", error);
  }
  return item;
}

export async function setMenuAvailability(id: string, available: boolean, department: ServiceDepartment) {
  const item = menuCache.find((entry) => entry.id === id && entry.department === department);
  if (item) item.available = available;
  try {
    const conn = await connect_db();
    if (conn) await MenuModel.updateOne({ itemId: id, department }, { $set: { available } });
  } catch (error) {
    console.warn("Menu availability update failed:", error);
  }
  return item || null;
}

export async function createServiceOrder({
  user,
  itemId,
  room,
  quantity,
}: {
  user: PublicUser;
  itemId: string;
  room: string;
  quantity: number;
}) {
  let item = menuCache.find((entry) => entry.id === itemId && entry.available);
  try {
    const conn = await connect_db();
    if (conn) {
      const doc = await MenuModel.findOne({ itemId, available: true }).lean();
      item = doc ? formatMenu(doc as unknown as Record<string, unknown>) : undefined;
    }
  } catch {
    // Keep the in-memory catalog available when MongoDB is offline.
  }
  if (!item) return { error: "That menu item is no longer available." };
  if (!room.trim() || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    return { error: "Choose a room and a quantity from 1 to 10." };
  }

  const now = new Date();
  const order: ServiceOrder = {
    id: randomUUID(),
    guestName: user.name,
    guestEmail: user.email,
    room: room.trim(),
    itemName: item.name,
    department: item.department,
    quantity,
    price: item.price,
    status: "new",
    createdAt: now,
    updatedAt: now,
  };
  orderCache.unshift(order);
  try {
    const conn = await connect_db();
    if (conn) await OrderModel.create({
      orderId: order.id,
      guestName: order.guestName,
      guestEmail: order.guestEmail,
      room: order.room,
      itemName: order.itemName,
      department: order.department,
      quantity: order.quantity,
      price: order.price,
      status: order.status,
    });
  } catch (error) {
    console.warn("Service order persistence failed; stored in memory:", error);
  }
  return { order };
}

export async function updateServiceOrder(id: string, status: ServiceOrderStatus, role: UserRole) {
  const order = orderCache.find((entry) => entry.id === id);
  try {
    const conn = await connect_db();
    if (conn) {
      const doc = await OrderModel.findOne({ orderId: id }).lean();
      if (!doc || (role !== "staff" && doc.department !== role)) return { error: "Order not found for this department." };
      await OrderModel.updateOne({ orderId: id }, { $set: { status } });
      const updated = await OrderModel.findOne({ orderId: id }).lean();
      const formatted = formatOrder(updated as unknown as Record<string, unknown>);
      orderCache = [formatted, ...orderCache.filter((entry) => entry.id !== id)];
      return { order: formatted };
    }
  } catch (error) {
    console.warn("Service order update persistence failed:", error);
  }
  if (!order || (role !== "staff" && order.department !== role)) return { error: "Order not found for this department." };
  order.status = status;
  order.updatedAt = new Date();
  return { order };
}

export async function createRoomServiceCall({ user, room, offer }: { user: PublicUser; room: string; offer: string }) {
  if (!room.trim() || !offer) return { error: "Room and audio-call setup are required." };
  const now = new Date();
  const call: RoomServiceCall = {
    id: randomUUID(),
    guestName: user.name,
    guestEmail: user.email,
    room: room.trim(),
    status: "ringing",
    offer,
    createdAt: now,
    updatedAt: now,
  };
  callCache.unshift(call);
  try {
    const conn = await connect_db();
    if (conn) await CallModel.create({
      callId: call.id,
      guestName: call.guestName,
      guestEmail: call.guestEmail,
      room: call.room,
      status: call.status,
      offer,
    });
  } catch (error) {
    console.warn("Room-service call persistence failed; stored in memory:", error);
  }
  return { call };
}

export async function answerRoomServiceCall({ id, answer, role }: { id: string; answer: string; role: UserRole }) {
  if (role !== "room-service" && role !== "staff") return { error: "Room-service access is required." };
  try {
    const conn = await connect_db();
    if (conn) {
      const updated = await CallModel.findOneAndUpdate(
        { callId: id, status: "ringing" },
        { $set: { answer, status: "active" } },
        { new: true }
      ).lean();
      return updated ? { call: formatCall(updated as unknown as Record<string, unknown>) } : { error: "This call is no longer ringing." };
    }
  } catch (error) {
    console.warn("Call answer persistence failed:", error);
  }
  const call = callCache.find((entry) => entry.id === id && entry.status === "ringing");
  if (!call) return { error: "This call is no longer ringing." };
  call.answer = answer;
  call.status = "active";
  call.updatedAt = new Date();
  return { call };
}

export async function endRoomServiceCall({ id, user }: { id: string; user: PublicUser }) {
  try {
    const conn = await connect_db();
    if (conn) {
      const filter = user.role === "guest" ? { callId: id, guestEmail: user.email } : { callId: id };
      const updated = await CallModel.findOneAndUpdate(
        filter,
        { $set: { status: "ended" } },
        { new: true }
      ).lean();
      return updated ? { call: formatCall(updated as unknown as Record<string, unknown>) } : { error: "Call not found." };
    }
  } catch (error) {
    console.warn("Call end persistence failed:", error);
  }
  const call = callCache.find((entry) => entry.id === id && (user.role !== "guest" || entry.guestEmail === user.email));
  if (!call) return { error: "Call not found." };
  call.status = "ended";
  call.updatedAt = new Date();
  return { call };
}