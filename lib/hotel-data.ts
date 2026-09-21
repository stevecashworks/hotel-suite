export type RoomStatus = "available" | "booked" | "maintenance";

export type Room = {
  id: number;
  number: string;
  type: string;
  floor: number;
  price: number;
  status: RoomStatus;
  guest?: string;
  availableUntil?: string;
};

export type InventoryItem = {
  id: number;
  name: string;
  category: "food" | "bar" | "amenity";
  stock: number;
  price: number;
};

export type Customer = {
  id: number;
  name: string;
  email: string;
  phone: string;
  room: string;
  checkIn: string;
  source: string;
};

export const hotelLocation = {
  name: "Hotel Suite Marina",
  address: "123 Harbor Blvd, Miami Beach, FL",
  mapsQuery: "123 Harbor Blvd Miami Beach FL",
};

export const hotelData = {
  rooms: [
    { id: 1, number: "101", type: "Deluxe King", floor: 1, price: 220, status: "available" },
    { id: 2, number: "102", type: "Deluxe King", floor: 1, price: 220, status: "available" },
    { id: 3, number: "201", type: "Ocean View", floor: 2, price: 310, status: "booked", guest: "Amelia M.", availableUntil: "2026-09-15T18:00:00" },
    { id: 4, number: "202", type: "Ocean View", floor: 2, price: 310, status: "available" },
    { id: 5, number: "301", type: "Suite", floor: 3, price: 480, status: "maintenance" },
    { id: 6, number: "302", type: "Suite", floor: 3, price: 480, status: "available" },
  ] as Room[],
  inventory: [
    { id: 1, name: "Breakfast Bundle", category: "food", stock: 20, price: 18 },
    { id: 2, name: "Signature Coffee", category: "food", stock: 12, price: 6 },
    { id: 3, name: "Sparkling Water", category: "bar", stock: 25, price: 5 },
    { id: 4, name: "Mini Bar Pack", category: "bar", stock: 8, price: 22 },
    { id: 5, name: "Laundry Kit", category: "amenity", stock: 6, price: 14 },
  ] as InventoryItem[],
  customers: [
    { id: 1, name: "Amelia Morgan", email: "amelia@example.com", phone: "+1 305 555 0140", room: "201", checkIn: "2026-09-14", source: "QR check-in" },
    { id: 2, name: "Daniel Ross", email: "daniel@example.com", phone: "+1 305 555 1017", room: "401", checkIn: "2026-09-13", source: "Guest portal" },
  ] as Customer[],
};

export const makeReservationDate = (offsetDays: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
};

export const getHotelSnapshot = () => ({
  rooms: [...hotelData.rooms],
  inventory: [...hotelData.inventory],
  customers: [...hotelData.customers],
});

export const reserveRoom = ({
  name,
  email,
  phone,
  roomId,
  nights,
  source = "Reservation form",
}: {
  name: string;
  email: string;
  phone: string;
  roomId: number;
  nights: number;
  source?: string;
}) => {
  if (!name?.trim() || !email?.trim() || !phone?.trim() || !Number.isInteger(nights) || nights < 1) {
    return { error: "Please provide your contact details and a valid stay length" };
  }

  const room = hotelData.rooms.find((item) => item.id === roomId);
  if (!room || room.status !== "available") {
    return { error: "Selected room is not available" };
  }

  const availableUntil = new Date();
  availableUntil.setDate(availableUntil.getDate() + nights);

  hotelData.rooms = hotelData.rooms.map((item) =>
    item.id === roomId
      ? { ...item, status: "booked", guest: name || "Guest", availableUntil: availableUntil.toISOString() }
      : item
  );

  const alreadyExists = hotelData.customers.some(
    (customer) => customer.email.toLowerCase() === email.toLowerCase() || customer.phone === phone
  );

  if (!alreadyExists && name && email) {
    hotelData.customers = [
      {
        id: Date.now(),
        name,
        email,
        phone,
        room: room.number,
        checkIn: makeReservationDate(0),
        source,
      },
      ...hotelData.customers,
    ];
  }

  return {
    status: "success",
    roomNumber: room.number,
    availableUntil: availableUntil.toISOString(),
    ...getHotelSnapshot(),
  };
};

export const registerGuestScan = ({
  name,
  email,
  phone,
  roomId,
}: {
  name: string;
  email: string;
  phone: string;
  roomId: number;
}) => {
  const room = hotelData.rooms.find((item) => item.id === roomId);
  const guest = {
    id: Date.now(),
    name: name || "New Guest",
    email: email || `guest${Date.now()}@hotel-suite.com`,
    phone: phone || "+1 305 555 0000",
    room: room?.number || "TBD",
    checkIn: makeReservationDate(0),
    source: "QR check-in",
  };

  const exists = hotelData.customers.some(
    (customer) => customer.email.toLowerCase() === guest.email.toLowerCase() || customer.phone === guest.phone
  );

  if (!exists) {
    hotelData.customers = [guest, ...hotelData.customers];
    return { status: "new-customer", guest, ...getHotelSnapshot() };
  }

  return { status: "existing-customer", guest, ...getHotelSnapshot() };
};

export const updateInventoryStock = (itemId: number, delta: number) => {
  hotelData.inventory = hotelData.inventory.map((item) =>
    item.id === itemId ? { ...item, stock: Math.max(0, item.stock + delta) } : item
  );

  return { status: "updated", ...getHotelSnapshot() };
};

export const placeRoomServiceOrder = ({ itemId, roomId }: { itemId: number; roomId: number }) => {
  const item = hotelData.inventory.find((entry) => entry.id === itemId);
  if (!item || item.stock <= 0) {
    return { error: "Item unavailable" };
  }

  hotelData.inventory = hotelData.inventory.map((entry) =>
    entry.id === itemId ? { ...entry, stock: Math.max(0, entry.stock - 1) } : entry
  );

  const room = hotelData.rooms.find((entry) => entry.id === roomId);
  return {
    status: "ordered",
    roomNumber: room?.number ?? "guest",
    itemName: item.name,
    ...getHotelSnapshot(),
  };
};

export const toggleRoomAvailability = (roomId: number) => {
  hotelData.rooms = hotelData.rooms.map((room) => {
    if (room.id !== roomId) {
      return room;
    }

    const nextStatus: RoomStatus = room.status === "maintenance" ? "available" : "maintenance";
    return { ...room, status: nextStatus, guest: nextStatus === "maintenance" ? room.guest : undefined };
  });

  return { status: "updated", ...getHotelSnapshot() };
};
