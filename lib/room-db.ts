import mongoose from "mongoose";
import connect_db from "@/lib/mongodb";
import { hotelData, Room, RoomStatus } from "@/lib/hotel-data";

const roomSchema = new mongoose.Schema(
  {
    roomId: { type: Number, required: true, unique: true, index: true },
    number: { type: String, required: true },
    type: { type: String, required: true },
    floor: { type: Number, required: true, default: 1 },
    price: { type: Number, required: true },
    status: {
      type: String,
      enum: ["available", "booked", "maintenance"],
      default: "available",
    },
    guest: { type: String },
    availableUntil: { type: String },
    imageUrl: { type: String, default: "/room 1.jpg" },
    detail: { type: String, default: "Refined comfort · Luxury amenities" },
  },
  { timestamps: true }
);

const RoomModel = mongoose.models.Room ?? mongoose.model("Room", roomSchema);

// Curated seed rooms for initial loading
export const defaultRooms: Room[] = [
  {
    id: 1,
    number: "101",
    type: "Deluxe King",
    floor: 1,
    price: 220,
    status: "available",
    imageUrl: "/05_deluxe_room.jpg",
    detail: "Plush king bed · Garden view · Rain shower",
  },
  {
    id: 2,
    number: "102",
    type: "Deluxe King",
    floor: 1,
    price: 220,
    status: "available",
    imageUrl: "/room 1.jpg",
    detail: "Plush king bed · High ceiling · Marble bathroom",
  },
  {
    id: 3,
    number: "201",
    type: "Ocean View",
    floor: 2,
    price: 310,
    status: "booked",
    guest: "Amelia M.",
    availableUntil: "2026-09-15T18:00:00",
    imageUrl: "/03_ocean_suite.jpg",
    detail: "Panoramic ocean vista · Private balcony · King bed",
  },
  {
    id: 4,
    number: "202",
    type: "Ocean View",
    floor: 2,
    price: 310,
    status: "available",
    imageUrl: "/room 2.jpg",
    detail: "Coastal morning sun · Deep soaking tub · King bed",
  },
  {
    id: 5,
    number: "301",
    type: "Suite",
    floor: 3,
    price: 480,
    status: "maintenance",
    imageUrl: "/room 3.jpg",
    detail: "Living salon · Floor-to-ceiling windows · Wet bar",
  },
  {
    id: 6,
    number: "302",
    type: "Suite",
    floor: 3,
    price: 480,
    status: "available",
    imageUrl: "/04_signature_room.jpg",
    detail: "Executive lounge access · Dual vanities · Sunset balcony",
  },
];

// Persistent in-memory cache for fast access & offline/fallback mode
let inMemoryRooms: Room[] = [...defaultRooms];

// Keep hotelData in sync
hotelData.rooms = inMemoryRooms;

function syncWithHotelData(rooms: Room[]) {
  inMemoryRooms = rooms;
  hotelData.rooms = rooms;
}

export async function getRoomsFromDb(): Promise<Room[]> {
  try {
    const conn = await connect_db();
    if (!conn) {
      return [...inMemoryRooms];
    }

    const count = await RoomModel.countDocuments();
    if (count === 0) {
      // Seed default rooms into MongoDB
      await RoomModel.insertMany(
        defaultRooms.map((r) => ({
          roomId: r.id,
          number: r.number,
          type: r.type,
          floor: r.floor,
          price: r.price,
          status: r.status,
          guest: r.guest,
          availableUntil: r.availableUntil,
          imageUrl: r.imageUrl || "/room 1.jpg",
          detail: r.detail || "Refined comfort · Luxury amenities",
        }))
      );
    }

    const docs = await RoomModel.find().sort({ floor: 1, number: 1 }).lean();
    const formatted: Room[] = docs.map((doc) => ({
      id: Number(doc.roomId),
      number: String(doc.number),
      type: String(doc.type),
      floor: Number(doc.floor || 1),
      price: Number(doc.price),
      status: (doc.status as RoomStatus) || "available",
      guest: doc.guest ? String(doc.guest) : undefined,
      availableUntil: doc.availableUntil ? String(doc.availableUntil) : undefined,
      imageUrl: doc.imageUrl ? String(doc.imageUrl) : "/room 1.jpg",
      detail: doc.detail ? String(doc.detail) : "Refined comfort · Luxury amenities",
    }));

    syncWithHotelData(formatted);
    return formatted;
  } catch (error) {
    console.warn("getRoomsFromDb fallback to memory:", error);
    return [...inMemoryRooms];
  }
}

export async function addRoomToDb(input: {
  number: string;
  type: string;
  floor?: number;
  price: number;
  status?: RoomStatus;
  imageUrl?: string;
  detail?: string;
}): Promise<Room> {
  const cleanNumber = String(input.number).trim();
  const cleanType = String(input.type).trim();
  const cleanFloor = Number(input.floor) || parseInt(cleanNumber.charAt(0), 10) || 1;
  const cleanPrice = Math.max(1, Number(input.price) || 150);
  const cleanStatus: RoomStatus = input.status || "available";
  const cleanImage = input.imageUrl?.trim() || "/04_signature_room.jpg";
  const cleanDetail = input.detail?.trim() || "Luxury appointments · City & garden views";

  // Check existing room numbers
  const existing = inMemoryRooms.find(
    (r) => r.number.toLowerCase() === cleanNumber.toLowerCase()
  );
  if (existing) {
    throw new Error(`Room ${cleanNumber} already exists in the system`);
  }

  // Generate unique numeric ID
  const maxId = inMemoryRooms.reduce((max, r) => Math.max(max, r.id), 0);
  const newId = maxId > 0 ? maxId + 1 : Date.now();

  const newRoom: Room = {
    id: newId,
    number: cleanNumber,
    type: cleanType,
    floor: cleanFloor,
    price: cleanPrice,
    status: cleanStatus,
    imageUrl: cleanImage,
    detail: cleanDetail,
  };

  try {
    const conn = await connect_db();
    if (conn) {
      await RoomModel.create({
        roomId: newId,
        number: cleanNumber,
        type: cleanType,
        floor: cleanFloor,
        price: cleanPrice,
        status: cleanStatus,
        imageUrl: cleanImage,
        detail: cleanDetail,
      });
    }
  } catch (err) {
    console.warn("MongoDB room save error, stored in-memory:", err);
  }

  const updatedRooms = [...inMemoryRooms, newRoom];
  syncWithHotelData(updatedRooms);
  return newRoom;
}

export async function toggleRoomStatusInDb(
  roomId: number,
  targetStatus?: RoomStatus
): Promise<Room | null> {
  const room = inMemoryRooms.find((r) => r.id === roomId);
  if (!room) return null;

  const nextStatus: RoomStatus =
    targetStatus ||
    (room.status === "available"
      ? "maintenance"
      : room.status === "maintenance"
      ? "available"
      : "available");

  const updatedRoom: Room = {
    ...room,
    status: nextStatus,
    guest: nextStatus === "available" ? undefined : room.guest,
    availableUntil: nextStatus === "available" ? undefined : room.availableUntil,
  };

  try {
    const conn = await connect_db();
    if (conn) {
      await RoomModel.updateOne(
        { roomId },
        {
          $set: {
            status: nextStatus,
            guest: updatedRoom.guest ?? null,
            availableUntil: updatedRoom.availableUntil ?? null,
          },
        }
      );
    }
  } catch (err) {
    console.warn("MongoDB room status toggle error:", err);
  }

  const updatedRooms = inMemoryRooms.map((r) => (r.id === roomId ? updatedRoom : r));
  syncWithHotelData(updatedRooms);
  return updatedRoom;
}

export async function deleteRoomFromDb(roomId: number): Promise<boolean> {
  try {
    const conn = await connect_db();
    if (conn) {
      await RoomModel.deleteOne({ roomId });
    }
  } catch (err) {
    console.warn("MongoDB room delete error:", err);
  }

  const updatedRooms = inMemoryRooms.filter((r) => r.id !== roomId);
  syncWithHotelData(updatedRooms);
  return true;
}
