"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, Hotel, LoaderCircle } from "lucide-react";
import styles from "./page.module.css";

type Room = { id: number; number: string; type: string; floor: number; price: number; status: string };

export default function RegisterPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmation, setConfirmation] = useState<{ roomNumber: string; availableUntil: string } | null>(null);

  useEffect(() => {
    fetch("/api/hotel").then((response) => response.json()).then((data) => setRooms(data.rooms.filter((room: Room) => room.status === "available"))).catch(() => setMessage("We couldn't load rooms right now. Please try again.")).finally(() => setLoading(false));
  }, []);

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/hotel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reserve-room", payload: { name: form.get("name"), email: form.get("email"), phone: form.get("phone"), roomId: Number(form.get("roomId")), nights: Number(form.get("nights")), source: "QR registration" } }) });
    const data = await response.json();
    setSubmitting(false);
    if (data.error) { setMessage(data.error); return; }
    setConfirmation({ roomNumber: data.roomNumber, availableUntil: data.availableUntil });
  }

  if (confirmation) return <main className={styles.page}><section className={styles.confirmation}><CheckCircle2 size={48} /><p className={styles.eyebrow}>Registration received</p><h1>Your stay is reserved.</h1><p>Room {confirmation.roomNumber} is held for you until {new Date(confirmation.availableUntil).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}. Our team will be in touch with check-in details.</p><a href="/">Back to Hotelier</a></section></main>;

  return <main className={styles.page}><section className={styles.card}><div className={styles.brand}><Hotel size={22} /> Hotelier.</div><p className={styles.eyebrow}>Guest stay registration</p><h1>Find your perfect room.</h1><p className={styles.intro}>Select an available room and share your details. Your reservation will be confirmed immediately.</p><form onSubmit={register} className={styles.form}><label>Full name<input name="name" autoComplete="name" required /></label><label>Email address<input name="email" type="email" autoComplete="email" required /></label><label>Phone number<input name="phone" type="tel" autoComplete="tel" required /></label><label>Available room<select name="roomId" required disabled={loading || rooms.length === 0}><option value="">{loading ? "Loading rooms…" : rooms.length ? "Choose a room" : "No rooms available"}</option>{rooms.map((room) => <option key={room.id} value={room.id}>Room {room.number} · {room.type} · ${room.price}/night</option>)}</select></label><label>Length of stay<select name="nights" defaultValue="1"><option value="1">1 night</option><option value="2">2 nights</option><option value="3">3 nights</option><option value="4">4 nights</option><option value="5">5 nights</option><option value="7">7 nights</option></select></label>{message && <p className={styles.error} role="alert">{message}</p>}<button disabled={loading || !rooms.length || submitting}>{submitting ? <><LoaderCircle className={styles.spinner} size={18} /> Reserving…</> : "Reserve your stay"}</button></form><p className={styles.note}>By registering, you agree that our concierge may contact you about your stay.</p></section></main>;
}
