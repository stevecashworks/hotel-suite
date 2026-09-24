"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BedDouble, CheckCircle2, Hotel, LoaderCircle } from "lucide-react";
import styles from "./page.module.css";

type Room = {
  id: number;
  number: string;
  type: string;
  floor: number;
  price: number;
  status: string;
  detail?: string;
};

function RegisterContent() {
  const searchParams = useSearchParams();
  const urlRoomId = searchParams.get("roomId");
  const urlRoomNumber = searchParams.get("room") || searchParams.get("roomNumber");

  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>(urlRoomId || "");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmation, setConfirmation] = useState<{ roomNumber: string; availableUntil: string } | null>(null);

  useEffect(() => {
    fetch("/api/hotel")
      .then((response) => response.json())
      .then((data) => {
        const availableRooms: Room[] = Array.isArray(data?.rooms)
          ? data.rooms.filter((room: Room) => room.status === "available")
          : [];
        setRooms(availableRooms);

        if (urlRoomId) {
          const matchById = availableRooms.find((r) => String(r.id) === String(urlRoomId));
          if (matchById) {
            setSelectedRoomId(String(matchById.id));
          }
        } else if (urlRoomNumber) {
          const matchByNum = availableRooms.find(
            (r) => r.number.toLowerCase() === urlRoomNumber.toLowerCase()
          );
          if (matchByNum) {
            setSelectedRoomId(String(matchByNum.id));
          }
        }
      })
      .catch(() => setMessage("We couldn't load rooms right now. Please try again."))
      .finally(() => setLoading(false));
  }, [urlRoomId, urlRoomNumber]);

  const targetRoom = rooms.find((r) => String(r.id) === String(selectedRoomId));

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const chosenRoomId = Number(form.get("roomId") || selectedRoomId);
    const roomItem = rooms.find((r) => r.id === chosenRoomId);

    const response = await fetch("/api/hotel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reserve-room",
        payload: {
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone"),
          roomId: chosenRoomId,
          nights: Number(form.get("nights")),
          source: urlRoomNumber
            ? `QR Scan (Room ${urlRoomNumber})`
            : roomItem
            ? `Direct Booking (Room ${roomItem.number})`
            : "Guest registration",
        },
      }),
    });
    const data = await response.json();
    setSubmitting(false);
    if (data.error) {
      setMessage(data.error);
      return;
    }
    setConfirmation({ roomNumber: data.roomNumber, availableUntil: data.availableUntil });
  }

  if (confirmation) {
    return (
      <main className={styles.page}>
        <section className={styles.confirmation}>
          <CheckCircle2 size={48} />
          <p className={styles.eyebrow}>Registration received</p>
          <h1>Your stay is reserved.</h1>
          <p>
            Room {confirmation.roomNumber} is held for you until{" "}
            {new Date(confirmation.availableUntil).toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
            . Our team will be in touch with check-in details.
          </p>
          <Link href="/">Back to Hotelier</Link>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.brand}>
          <Hotel size={22} /> Hotelier.
        </div>
        <p className={styles.eyebrow}>Guest stay registration</p>
        <h1>Find your perfect room.</h1>
        <p className={styles.intro}>
          {targetRoom
            ? `Suite ${targetRoom.number} is pre-filled from your room QR code. Please complete your registration details below.`
            : "Select an available room and share your details. Your reservation will be confirmed immediately."}
        </p>

        {targetRoom && (
          <div className={styles.prefilledBanner}>
            <BedDouble size={20} style={{ color: "#65452e", flexShrink: 0 }} />
            <div>
              <strong>Pre-selected Suite: Room {targetRoom.number} · {targetRoom.type}</strong>
              <div style={{ fontSize: "0.8rem", color: "rgba(42, 29, 20, 0.75)", marginTop: 2 }}>
                Floor {targetRoom.floor} · ${targetRoom.price}/night {targetRoom.detail ? `· ${targetRoom.detail}` : ""}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={register} className={styles.form}>
          <label>
            Full name
            <input name="name" autoComplete="name" required placeholder="e.g. Eleanor Vance" />
          </label>
          <label>
            Email address
            <input name="email" type="email" autoComplete="email" required placeholder="eleanor@example.com" />
          </label>
          <label>
            Phone number
            <input name="phone" type="tel" autoComplete="tel" required placeholder="+1 (555) 019-2834" />
          </label>
          <label>
            Available room
            <select
              name="roomId"
              required
              disabled={loading || rooms.length === 0}
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
            >
              <option value="">
                {loading
                  ? "Loading rooms…"
                  : rooms.length
                  ? "Choose a room"
                  : "No rooms available"}
              </option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  Room {room.number} · {room.type} · ${room.price}/night (Floor {room.floor})
                </option>
              ))}
            </select>
          </label>
          <label>
            Length of stay
            <select name="nights" defaultValue="1">
              <option value="1">1 night</option>
              <option value="2">2 nights</option>
              <option value="3">3 nights</option>
              <option value="4">4 nights</option>
              <option value="5">5 nights</option>
              <option value="7">7 nights</option>
            </select>
          </label>
          {message && <p className={styles.error} role="alert">{message}</p>}
          <button disabled={loading || !rooms.length || submitting}>
            {submitting ? (
              <>
                <LoaderCircle className={styles.spinner} size={18} /> Reserving…
              </>
            ) : targetRoom ? (
              `Confirm Room ${targetRoom.number} Reservation`
            ) : (
              "Reserve your stay"
            )}
          </button>
        </form>
        <p className={styles.note}>
          By registering, you agree that our concierge may contact you about your stay.
        </p>
      </section>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <main className={styles.page}>
          <section className={styles.card}>
            <div className={styles.brand}>
              <Hotel size={22} /> Hotelier.
            </div>
            <p className={styles.intro}>Loading registration portal…</p>
          </section>
        </main>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}
