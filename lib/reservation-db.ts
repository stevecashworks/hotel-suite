import mongoose from "mongoose";
import connect_db from "@/lib/mongodb";
import { hotelData } from "@/lib/hotel-data";

const reservationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    roomId: { type: Number, required: true },
    roomNumber: { type: String, required: true },
    roomType: { type: String, required: true },
    nights: { type: Number, required: true },
    source: { type: String, default: "Reservation form" },
    status: { type: String, default: "confirmed" },
    availableUntil: { type: Date },
    checkIn: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const ReservationModel = mongoose.models.Reservation ?? mongoose.model("Reservation", reservationSchema);

export async function saveReservationToDb({
  name,
  email,
  phone,
  roomId,
  roomNumber,
  roomType,
  nights,
  source,
}: {
  name: string;
  email: string;
  phone: string;
  roomId: number;
  roomNumber: string;
  roomType: string;
  nights: number;
  source?: string;
}) {
  try {
    await connect_db();
    const created = await ReservationModel.create({
      name,
      email,
      phone,
      roomId,
      roomNumber,
      roomType,
      nights,
      source: source ?? "Reservation form",
      status: "confirmed",
      checkIn: new Date(),
      availableUntil: new Date(Date.now() + nights * 24 * 60 * 60 * 1000),
    });

    return created.toObject();
  } catch (error) {
    console.error("Reservation save failed:", error);
    return null;
  }
}

export async function getDashboardMetricsFromDb() {
  const rooms = [...hotelData.rooms];
  const inventory = [...hotelData.inventory];
  const roomRevenue = rooms.reduce((sum, room) => sum + (room.price ?? 0), 0);

  try {
    await connect_db();
    const reservations = await ReservationModel.find().sort({ createdAt: -1 }).lean();
    const totalReservations = reservations.length;
    const occupiedRooms = rooms.filter((room) => room.status === "booked").length;
    const occupancy = Math.round((occupiedRooms / rooms.length) * 100);
    const avgStay = totalReservations
      ? Math.round(reservations.reduce((sum, item) => sum + Number(item.nights || 0), 0) / totalReservations)
      : 0;
    const revenue = reservations.reduce(
      (sum, item) => sum + (Number(item.nights || 0) * (rooms.find((room) => room.number === item.roomNumber)?.price ?? 0)),
      0
    );

    const trend = Array.from({ length: 6 }, (_, index) => {
      const label = new Date();
      label.setDate(label.getDate() - (5 - index));
      const dayKey = label.toISOString().slice(0, 10);
      const count = reservations.filter(
        (reservation) => reservation.createdAt && new Date(reservation.createdAt).toISOString().slice(0, 10) === dayKey
      ).length;

      return {
        label: label.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        value: count,
      };
    });

    return {
      metrics: {
        occupancy,
        totalReservations,
        activeGuests: occupiedRooms,
        avgStay,
        revenue,
        roomRevenue,
      },
      inventory: inventory.map((item) => ({ ...item, fill: Math.max(18, (item.stock / 25) * 100) })),
      recentReservations: reservations.slice(0, 5).map((reservation) => ({
        id: String(reservation._id),
        name: reservation.name,
        room: reservation.roomNumber,
        nights: reservation.nights,
        source: reservation.source,
        createdAt: reservation.createdAt,
      })),
      trend,
    };
  } catch {
    const fallbackReservations = hotelData.customers.length;
    const occupiedRooms = rooms.filter((room) => room.status === "booked").length;
    const occupancy = Math.round((occupiedRooms / rooms.length) * 100);
    const avgStay = 2;
    const revenue = rooms.reduce((sum, room) => sum + room.price, 0);

    return {
      metrics: {
        occupancy,
        totalReservations: fallbackReservations,
        activeGuests: occupiedRooms,
        avgStay,
        revenue,
        roomRevenue,
      },
      inventory: inventory.map((item) => ({ ...item, fill: Math.max(18, (item.stock / 25) * 100) })),
      recentReservations: hotelData.customers.slice(0, 5).map((customer) => ({
        id: String(customer.id),
        name: customer.name,
        room: customer.room,
        nights: 2,
        source: customer.source,
        createdAt: new Date(),
      })),
      trend: [
        { label: "Mon", value: 2 },
        { label: "Tue", value: 5 },
        { label: "Wed", value: 4 },
        { label: "Thu", value: 8 },
        { label: "Fri", value: 7 },
        { label: "Sat", value: 9 },
      ],
    };
  }
}
