"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

type RoomStatus = "available" | "booked" | "maintenance";

type Room = {
  id: number;
  number: string;
  type: string;
  floor: number;
  price: number;
  status: RoomStatus;
  guest?: string;
  availableUntil?: string;
};

type InventoryItem = {
  id: number;
  name: string;
  category: "food" | "bar" | "amenity";
  stock: number;
  price: number;
};

type Customer = {
  id: number;
  name: string;
  email: string;
  phone: string;
  room: string;
  checkIn: string;
  source: string;
};

const hotelLocation = {
  name: "Hotel Suite Marina",
  address: "123 Harbor Blvd, Miami Beach, FL",
  mapsQuery: "123 Harbor Blvd Miami Beach FL",
};

const initialRooms: Room[] = [
  { id: 1, number: "101", type: "Deluxe King", floor: 1, price: 220, status: "available" },
  { id: 2, number: "102", type: "Deluxe King", floor: 1, price: 220, status: "available" },
  { id: 3, number: "201", type: "Ocean View", floor: 2, price: 310, status: "booked", guest: "Amelia M.", availableUntil: "2026-09-15T18:00:00" },
  { id: 4, number: "202", type: "Ocean View", floor: 2, price: 310, status: "available" },
  { id: 5, number: "301", type: "Suite", floor: 3, price: 480, status: "maintenance" },
  { id: 6, number: "302", type: "Suite", floor: 3, price: 480, status: "available" },
];

const initialInventory: InventoryItem[] = [
  { id: 1, name: "Breakfast Bundle", category: "food", stock: 20, price: 18 },
  { id: 2, name: "Signature Coffee", category: "food", stock: 12, price: 6 },
  { id: 3, name: "Sparkling Water", category: "bar", stock: 25, price: 5 },
  { id: 4, name: "Mini Bar Pack", category: "bar", stock: 8, price: 22 },
  { id: 5, name: "Laundry Kit", category: "amenity", stock: 6, price: 14 },
];

const initialCustomers: Customer[] = [
  { id: 1, name: "Amelia Morgan", email: "amelia@example.com", phone: "+1 305 555 0140", room: "201", checkIn: "2026-09-14", source: "QR check-in" },
  { id: 2, name: "Daniel Ross", email: "daniel@example.com", phone: "+1 305 555 1017", room: "401", checkIn: "2026-09-13", source: "Guest portal" },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

const makeReservationDate = (offsetDays: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
};

const QR_SIZE = 21;
const qrCells = Array.from({ length: QR_SIZE * QR_SIZE }, (_, index) => {
  const row = Math.floor(index / QR_SIZE);
  const col = index % QR_SIZE;
  const isFinder =
    (row < 7 && col < 7) ||
    (row < 7 && col >= QR_SIZE - 7) ||
    (row >= QR_SIZE - 7 && col < 7);
  if (isFinder) {
    const finderCell = row < 7 && col < 7 ? row > 0 && row < 6 && col > 0 && col < 6 : true;
    return finderCell && row > 0 && col > 0 && row < 6 && col < 6 ? 1 : (row > 0 && col > 0 ? 1 : 0);
  }
  return (row + col + (row * 2)) % 3 === 0 ? 1 : 0;
});

export default function Home() {
  const [rooms, setRooms] = useState<Room[]>(initialRooms);
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory);
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [selectedRoomId, setSelectedRoomId] = useState<number>(2);
  const [reservation, setReservation] = useState({
    name: "",
    email: "",
    phone: "",
    roomType: "Deluxe King",
    nights: 2,
    paymentCard: "4242 4242 4242 4242",
  });
  const [serviceOrder, setServiceOrder] = useState<number>(1);
  const [lastScan, setLastScan] = useState("Guest QR ready for check-in");
  const [statusNote, setStatusNote] = useState("Room is available for reservation");
  const [paymentStatus, setPaymentStatus] = useState("Pending");

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? rooms[0];

  const occupancyRate = useMemo(
    () => Math.round(((rooms.filter((room) => room.status === "booked").length / rooms.length) * 100)),
    [rooms]
  );

  const totalInventoryUnits = useMemo(
    () => inventory.reduce((sum, item) => sum + item.stock, 0),
    [inventory]
  );

  const totalRoomRevenue = useMemo(
    () => rooms.filter((room) => room.status === "booked").reduce((sum, room) => sum + room.price, 0),
    [rooms]
  );

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setRooms((currentRooms) =>
        currentRooms.map((room) => {
          if (room.status === "booked" && room.availableUntil && new Date(room.availableUntil) <= now) {
            return { ...room, status: "available", guest: undefined, availableUntil: undefined };
          }
          return room;
        })
      );
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  const roomOptions = rooms.filter((room) => room.status === "available");

  const handleReserve = () => {
    const room = rooms.find((room) => room.id === selectedRoomId);
    if (!room || room.status !== "available") {
      setStatusNote("Selected room is not currently available. Please choose a different room.");
      return;
    }

    const availableUntil = new Date();
    availableUntil.setDate(availableUntil.getDate() + reservation.nights);

    setRooms((currentRooms) =>
      currentRooms.map((currentRoom) =>
        currentRoom.id === room.id
          ? { ...currentRoom, status: "booked", guest: reservation.name || "Guest", availableUntil: availableUntil.toISOString() }
          : currentRoom
      )
    );

    const guestAlreadyExists = customers.some(
      (customer) => customer.email.toLowerCase() === reservation.email.toLowerCase() || customer.phone === reservation.phone
    );

    if (!guestAlreadyExists && reservation.name && reservation.email) {
      setCustomers((currentCustomers) => [
        {
          id: Date.now(),
          name: reservation.name,
          email: reservation.email,
          phone: reservation.phone,
          room: room.number,
          checkIn: makeReservationDate(0),
          source: "Reservation form",
        },
        ...currentCustomers,
      ]);
    }

    setStatusNote(`${reservation.name || "Guest"} is checked in to room ${room.number} until ${availableUntil.toISOString().slice(0, 10)}.`);
    setPaymentStatus("Paid");
  };

  const handleQueueScan = () => {
    const guest = {
      id: Date.now(),
      name: reservation.name || "New Guest",
      email: reservation.email || `guest${Date.now()}@hotel-suite.com`,
      phone: reservation.phone || "+1 305 555 0000",
      room: selectedRoom?.number || "TBD",
      checkIn: makeReservationDate(0),
      source: "QR check-in",
    };

    const exists = customers.some(
      (customer) => customer.email.toLowerCase() === guest.email.toLowerCase() || customer.phone === guest.phone
    );

    if (!exists) {
      setCustomers((currentCustomers) => [guest, ...currentCustomers]);
      setLastScan(`QR scan registered ${guest.name} as a new customer.`);
    } else {
      setLastScan(`QR scan matched an existing guest profile for ${guest.name}.`);
    }
  };

  const handleInventoryChange = (itemId: number, delta: number) => {
    setInventory((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId ? { ...item, stock: Math.max(0, item.stock + delta) } : item
      )
    );
  };

  const handleServiceOrder = () => {
    const item = inventory.find((entry) => entry.id === serviceOrder);
    if (!item || item.stock <= 0) {
      setStatusNote("Selected item is currently unavailable for service delivery.");
      return;
    }

    setInventory((currentItems) =>
      currentItems.map((entry) =>
        entry.id === serviceOrder ? { ...entry, stock: Math.max(0, entry.stock - 1) } : entry
      )
    );
    setStatusNote(`${item.name} was ordered for room ${selectedRoom?.number ?? "guest"}.`);
  };

  const handleAdminRoomToggle = (roomId: number) => {
    setRooms((currentRooms) =>
      currentRooms.map((room) => {
        if (room.id !== roomId) {
          return room;
        }

        const nextStatus: RoomStatus = room.status === "maintenance" ? "available" : "maintenance";
        return { ...room, status: nextStatus, guest: nextStatus === "maintenance" ? room.guest : undefined };
      })
    );
  };

  const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hotelLocation.mapsQuery)}`;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Hospitality operations</p>
            <h1>{hotelLocation.name}</h1>
          </div>
          <div className={styles.headerActions}>
            <a href={mapLink} target="_blank" rel="noreferrer" className={styles.navButton}>
              Navigate to hotel
            </a>
            <button type="button" className={styles.primaryButton}>
              New booking
            </button>
          </div>
        </header>

        <section className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span>Occupancy</span>
            <strong>{occupancyRate}%</strong>
            <p>{rooms.filter((room) => room.status === "booked").length} booked rooms</p>
          </div>
          <div className={styles.statCard}>
            <span>Available rooms</span>
            <strong>{roomOptions.length}</strong>
            <p>{rooms.filter((room) => room.status === "maintenance").length} under maintenance</p>
          </div>
          <div className={styles.statCard}>
            <span>Inventory count</span>
            <strong>{totalInventoryUnits}</strong>
            <p>Items in stock</p>
          </div>
          <div className={styles.statCard}>
            <span>Projected revenue</span>
            <strong>{formatCurrency(totalRoomRevenue)}</strong>
            <p>Current active bookings</p>
          </div>
        </section>

        <div className={styles.contentGrid}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Reservation system</h2>
              <span className={styles.badge}>Live</span>
            </div>

            <div className={styles.formGrid}>
              <label>
                Guest name
                <input
                  value={reservation.name}
                  onChange={(event) => setReservation((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Guest full name"
                />
              </label>

              <label>
                Email
                <input
                  type="email"
                  value={reservation.email}
                  onChange={(event) => setReservation((current) => ({ ...current, email: event.target.value }))}
                  placeholder="guest@email.com"
                />
              </label>

              <label>
                Phone
                <input
                  value={reservation.phone}
                  onChange={(event) => setReservation((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="Mobile number"
                />
              </label>

              <label>
                Room type
                <select
                  value={reservation.roomType}
                  onChange={(event) => setReservation((current) => ({ ...current, roomType: event.target.value }))}
                >
                  <option>Deluxe King</option>
                  <option>Ocean View</option>
                  <option>Suite</option>
                </select>
              </label>

              <label>
                Booking nights
                <input
                  type="number"
                  min={1}
                  value={reservation.nights}
                  onChange={(event) =>
                    setReservation((current) => ({
                      ...current,
                      nights: Number(event.target.value) || 1,
                    }))
                  }
                />
              </label>

              <label>
                Card details
                <input
                  value={reservation.paymentCard}
                  onChange={(event) =>
                    setReservation((current) => ({ ...current, paymentCard: event.target.value }))
                  }
                />
              </label>
            </div>

            <div className={styles.roomList}>
              {rooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  className={`${styles.roomCard} ${selectedRoomId === room.id ? styles.roomCardSelected : ""} ${room.status === "booked" ? styles.roomCardBooked : ""}`}
                  onClick={() => setSelectedRoomId(room.id)}
                >
                  <div>
                    <strong>Room {room.number}</strong>
                    <span>{room.type}</span>
                  </div>
                  <div className={styles.roomMeta}>
                    <small>{room.status}</small>
                    <b>{formatCurrency(room.price)}/night</b>
                  </div>
                </button>
              ))}
            </div>

            <div className={styles.actionRow}>
              <button type="button" className={styles.primaryButton} onClick={handleReserve}>
                Confirm reservation
              </button>
              <button type="button" className={styles.secondaryButton} onClick={() => setPaymentStatus("Paid") }>
                Pay now
              </button>
            </div>

            <div className={styles.statusBar}>
              <span className={styles.pill}>Payment: {paymentStatus}</span>
              <span className={styles.statusText}>{statusNote}</span>
            </div>
          </section>

          <aside className={styles.sideStack}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2>Guest QR</h2>
                <span className={styles.badge}>Entrance</span>
              </div>

              <div className={styles.qrWrapper}>
                <svg viewBox="0 0 21 21" className={styles.qrCode} role="img" aria-label="Guest QR code">
                  {qrCells.map((cell, index) => {
                    const row = Math.floor(index / QR_SIZE);
                    const col = index % QR_SIZE;
                    const isDark = cell === 1;
                    return (
                      <rect
                        key={`${row}-${col}`}
                        x={col}
                        y={row}
                        width={1}
                        height={1}
                        fill={isDark ? "#111827" : "#ffffff"}
                      />
                    );
                  })}
                </svg>
              </div>

              <button type="button" className={styles.secondaryButton} onClick={handleQueueScan}>
                Simulate guest scan
              </button>

              <p className={styles.scanText}>{lastScan}</p>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2>Customers</h2>
                <span className={styles.badge}>{customers.length}</span>
              </div>

              <ul className={styles.customerList}>
                {customers.slice(0, 4).map((customer) => (
                  <li key={customer.id}>
                    <div>
                      <strong>{customer.name}</strong>
                      <small>{customer.email}</small>
                    </div>
                    <span>{customer.room}</span>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>

        <section className={styles.bottomGrid}>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Inventory management</h2>
              <span className={styles.badge}>Restock</span>
            </div>

            <div className={styles.inventoryList}>
              {inventory.map((item) => (
                <div className={styles.inventoryItem} key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <small>
                      {item.category} · {formatCurrency(item.price)}
                    </small>
                  </div>
                  <div className={styles.inventoryControls}>
                    <button type="button" onClick={() => handleInventoryChange(item.id, -1)}>
                      −
                    </button>
                    <span>{item.stock}</span>
                    <button type="button" onClick={() => handleInventoryChange(item.id, 1)}>
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Room service / bar</h2>
              <span className={styles.badge}>Availability</span>
            </div>

            <label className={styles.selectLabel}>
              Select item
              <select value={serviceOrder} onChange={(event) => setServiceOrder(Number(event.target.value))}>
                {inventory.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.stock} left)
                  </option>
                ))}
              </select>
            </label>

            <button type="button" className={styles.primaryButton} onClick={handleServiceOrder}>
              Send order by QR scan
            </button>

            <div className={styles.adminBox}>
              <h3>Admin room availability</h3>
              {rooms.map((room) => (
                <div key={room.id} className={styles.adminRow}>
                  <span>
                    {room.number} · {room.type}
                  </span>
                  <button type="button" onClick={() => handleAdminRoomToggle(room.id)}>
                    {room.status === "maintenance" ? "Set available" : "Set maintenance"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
