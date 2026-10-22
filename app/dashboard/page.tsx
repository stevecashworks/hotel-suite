"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Bell, BedDouble, CalendarDays, CheckCircle2, ClipboardList, Headphones, Hotel, LogOut, Mic, Phone, UtensilsCrossed, UserRound, Wine, X } from "lucide-react";
import { PublicUser } from "@/lib/auth";
import type { RoomServiceCall, ServiceDepartment, ServiceMenuItem, ServiceOrder } from "@/lib/service-db";
import styles from "./page.module.css";

type Room = {
  id: number;
  number: string;
  type: string;
  floor: number;
  price: number;
  status: string;
  imageUrl?: string;
  detail?: string;
};

type Confirmation = {
  roomNumber: string;
  checkIn: string;
  availableUntil: string;
};

type GuestReservation = {
  id: string;
  roomId: number;
  roomNumber: string;
  roomType: string;
  nights: number;
  checkIn: string;
  checkOut: string;
  status: string;
};

type DashboardSection = "stay" | "dining" | "orders" | "room-service";

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDate(date: string, days: number) {
  const shifted = new Date(`${date}T12:00:00`);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
}

function formatStayDate(date: Date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function GuestDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [nights, setNights] = useState("1");
  const [checkIn, setCheckIn] = useState(() => dateInputValue(new Date()));
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [section, setSection] = useState<DashboardSection>("stay");
  const [menu, setMenu] = useState<ServiceMenuItem[]>([]);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [reservations, setReservations] = useState<GuestReservation[]>([]);
  const [serviceRoom, setServiceRoom] = useState("");
  const [orderQuantity, setOrderQuantity] = useState("1");
  const [serviceMessage, setServiceMessage] = useState("");
  const [serviceNotice, setServiceNotice] = useState("");
  const [activeCall, setActiveCall] = useState<RoomServiceCall | null>(null);
  const [startingCall, setStartingCall] = useState(false);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeCallIdRef = useRef("");
  const orderStatusRef = useRef(new Map<string, string>());
  const selectedRoom = rooms.find((room) => String(room.id) === selectedRoomId);
  const checkOut = shiftDate(checkIn, Number(nights));

  function stopGuestCall() {
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    activeCallIdRef.current = "";
    setActiveCall(null);
    setStartingCall(false);
  }

  useEffect(() => {
    let cancelled = false;
    let polling: number | undefined;

    async function loadDashboard() {
      try {
        const authResponse = await fetch("/api/auth");
        const authData = await authResponse.json();
        if (!authData.user) {
          router.replace("/auth?next=%2Fdashboard");
          return;
        }
        if (authData.user.role !== "guest") {
          router.replace(authData.user.role === "staff" ? "/admin" : "/staff");
          return;
        }

        if (!cancelled) setUser(authData.user);

        const [roomResponse, serviceResponse] = await Promise.all([
          fetch("/api/hotel"),
          fetch("/api/service", { cache: "no-store" }),
        ]);
        const roomData = await roomResponse.json();
        const serviceData = serviceResponse.ok ? await serviceResponse.json() : null;
        if (cancelled) return;

        const availableRooms: Room[] = Array.isArray(roomData?.rooms)
          ? roomData.rooms.filter((room: Room) => room.status === "available")
          : [];
        setRooms(availableRooms);
        if (serviceData) {
          setMenu(serviceData.menu || []);
          setOrders(serviceData.orders || []);
          setReservations(serviceData.reservations || []);
          const firstReservation = serviceData.reservations?.[0];
          if (firstReservation) setServiceRoom(firstReservation.roomNumber);
          for (const order of serviceData.orders || []) orderStatusRef.current.set(order.id, order.status);

          polling = window.setInterval(async () => {
            try {
              const response = await fetch("/api/service", { cache: "no-store" });
              if (!response.ok) return;
              const latest = await response.json();
              if (cancelled) return;
              setMenu(latest.menu || []);
              setOrders(latest.orders || []);
              setReservations(latest.reservations || []);
              for (const order of latest.orders || []) {
                const previousStatus = orderStatusRef.current.get(order.id);
                if (previousStatus && previousStatus !== order.status) {
                  setServiceNotice(`${order.itemName} is now ${order.status}.`);
                }
                orderStatusRef.current.set(order.id, order.status);
              }
              const call = (latest.calls || []).find((entry: RoomServiceCall) => entry.status !== "ended");
              if (call) {
                setActiveCall(call);
                if (call.answer && peerRef.current && !peerRef.current.currentRemoteDescription) {
                  await peerRef.current.setRemoteDescription(JSON.parse(call.answer));
                }
              } else if (peerRef.current && activeCallIdRef.current) {
                stopGuestCall();
              }
            } catch {
              // Keep the current page state if one poll fails.
            }
          }, 3000);
        }

        const params = new URLSearchParams(window.location.search);
        const roomId = params.get("roomId");
        const roomNumber = params.get("room") || params.get("roomNumber");
        const preselectedRoom = availableRooms.find((room) =>
          roomId ? String(room.id) === roomId : roomNumber ? room.number === roomNumber : false
        );
        if (preselectedRoom) setSelectedRoomId(String(preselectedRoom.id));
      } catch {
        if (!cancelled) setMessage("We couldn't load your dashboard. Please refresh and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDashboard();
    return () => {
      cancelled = true;
      if (polling) window.clearInterval(polling);
      peerRef.current?.close();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [router]);

  async function bookRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;

    setMessage("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/hotel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reserve-room",
          payload: {
            name: user.name,
            email: user.email,
            phone,
            roomId: Number(selectedRoomId),
            nights: Number(nights),
            checkIn,
            source: "Guest dashboard",
          },
        }),
      });
      const data = await response.json();
      if (data.error) {
        setMessage(data.error);
        return;
      }

      setConfirmation({ roomNumber: data.roomNumber, checkIn: data.checkIn, availableUntil: data.availableUntil });
      if (Array.isArray(data.rooms)) {
        setRooms(data.rooms.filter((room: Room) => room.status === "available"));
      }
    } catch {
      setMessage("Your reservation could not be submitted. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function placeServiceOrder(item: ServiceMenuItem) {
    setServiceMessage("");
    setServiceNotice("");
    try {
      const response = await fetch("/api/service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "order-item",
          payload: { itemId: item.id, room: serviceRoom, quantity: Number(orderQuantity) },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Your order could not be placed.");
      setOrders((current) => [data.order, ...current]);
      orderStatusRef.current.set(data.order.id, data.order.status);
      setServiceNotice(`${data.order.itemName} has been sent to the ${data.order.department}.`);
      setSection("orders");
    } catch (error) {
      setServiceMessage(error instanceof Error ? error.message : "Your order could not be placed.");
    }
  }

  async function startRoomServiceCall() {
    if (!serviceRoom) {
      setServiceMessage("Select a booked room before calling room service.");
      return;
    }

    setStartingCall(true);
    setServiceMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      localStreamRef.current = stream;
      peerRef.current = peer;
      peer.ontrack = (event) => {
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = event.streams[0];
      };
      stream.getAudioTracks().forEach((track) => peer.addTrack(track, stream));
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await new Promise<void>((resolve) => {
        if (peer.iceGatheringState === "complete") return resolve();
        const timeout = window.setTimeout(resolve, 8000);
        peer.addEventListener("icegatheringstatechange", () => {
          if (peer.iceGatheringState === "complete") {
            window.clearTimeout(timeout);
            resolve();
          }
        });
      });
      const response = await fetch("/api/service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start-audio-call",
          payload: { room: serviceRoom, offer: JSON.stringify(peer.localDescription) },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Room service could not be reached.");
      setActiveCall(data.call);
      activeCallIdRef.current = data.call.id;
      setSection("room-service");
    } catch (error) {
      stopGuestCall();
      setServiceMessage(error instanceof Error ? error.message : "Microphone access is needed to call room service.");
    }
  }

  async function endRoomServiceCall() {
    const callId = activeCall?.id;
    stopGuestCall();
    if (callId) {
      await fetch("/api/service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end-audio-call", payload: { callId } }),
      });
    }
  }

  async function signOut() {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    router.replace("/auth");
  }

  if (loading || !user) {
    return (
      <main className={styles.page}>
        <p className={styles.loading}>Preparing your guest dashboard...</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          <Hotel size={21} /> Hotelier.
        </Link>
        <nav className={styles.nav} aria-label="Guest navigation">
          <Link href="/">Hotel home</Link>
          <button type="button" onClick={signOut} aria-label="Sign out">
            <LogOut size={16} /> <span>Sign out</span>
          </button>
        </nav>
      </header>

      <div className={styles.content}>
        <section className={styles.welcome}>
          <div>
            <p className={styles.eyebrow}>Guest dashboard</p>
            <h1>Welcome back, {user.name.split(" ")[0]}.</h1>
            <p>Find a room for your next stay at Hotel Suite Marina.</p>
          </div>
          <div className={styles.account}>
            {user.avatar ? <img src={user.avatar} alt="" /> : <UserRound size={22} />}
            <div>
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
          </div>
        </section>

        <nav className={styles.sectionNav} aria-label="Guest dashboard pages">
          <button type="button" className={section === "stay" ? styles.sectionActive : ""} onClick={() => setSection("stay")}><BedDouble size={16} /> Stay</button>
          <button type="button" className={section === "dining" ? styles.sectionActive : ""} onClick={() => setSection("dining")}><UtensilsCrossed size={16} /> Food & drink</button>
          <button type="button" className={section === "orders" ? styles.sectionActive : ""} onClick={() => setSection("orders")}><ClipboardList size={16} /> My orders{orders.some((order) => order.status === "ready") && <span className={styles.navNotice} />}</button>
          <button type="button" className={section === "room-service" ? styles.sectionActive : ""} onClick={() => setSection("room-service")}><Headphones size={16} /> Room service</button>
        </nav>

        {serviceNotice && (
          <div className={styles.serviceNotice} role="status" aria-live="polite">
            <Bell size={17} /> <span>{serviceNotice}</span>
            <button type="button" aria-label="Dismiss notification" onClick={() => setServiceNotice("")}><X size={16} /></button>
          </div>
        )}
        {serviceMessage && <p className={styles.error} role="alert">{serviceMessage}</p>}

        {section === "stay" && <div className={styles.dashboardGrid}>
          <section className={styles.bookingSection}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>Make it yours</p>
                <h2>Book a stay</h2>
              </div>
              <span className={styles.availability}><span /> {rooms.length} rooms available</span>
            </div>

            {confirmation ? (
              <div className={styles.confirmation} role="status">
                <CheckCircle2 size={28} />
                <div>
                  <h3>Your stay is reserved.</h3>
                  <p>
                    Room {confirmation.roomNumber} is booked from {formatStayDate(new Date(confirmation.checkIn))}
                    {" through "}{formatStayDate(new Date(confirmation.availableUntil))}.
                  </p>
                  <button type="button" onClick={() => setConfirmation(null)}>Book another stay</button>
                </div>
              </div>
            ) : (
              <form onSubmit={bookRoom} className={styles.form}>
                <label>
                  Available room
                  <select
                    required
                    disabled={!rooms.length}
                    value={selectedRoomId}
                    onChange={(event) => setSelectedRoomId(event.target.value)}
                  >
                    <option value="">{rooms.length ? "Choose a room" : "No rooms available"}</option>
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        Room {room.number} · {room.type} · ${room.price}/night
                      </option>
                    ))}
                  </select>
                </label>
                {selectedRoom && (
                  <article className={styles.roomPreview}>
                    <img
                      src={selectedRoom.imageUrl || "/05_deluxe_room.jpg"}
                      alt={`${selectedRoom.type}, room ${selectedRoom.number}`}
                    />
                    <div className={styles.roomPreviewBody}>
                      <div className={styles.roomPreviewTitle}>
                        <div>
                          <span className={styles.roomLabel}>Selected room · Floor {selectedRoom.floor}</span>
                          <h3>Room {selectedRoom.number} · {selectedRoom.type}</h3>
                        </div>
                        <strong>${selectedRoom.price}<small> / night</small></strong>
                      </div>
                      <p>{selectedRoom.detail || "A considered retreat with refined comforts."}</p>
                    </div>
                  </article>
                )}
                <div className={styles.formRow}>
                  <label>
                    Check-in date
                    <span className={styles.dateField}>
                      <CalendarDays size={16} />
                      <input
                        required
                        type="date"
                        min={dateInputValue(new Date())}
                        value={checkIn}
                        onChange={(event) => setCheckIn(event.target.value)}
                      />
                    </span>
                  </label>
                  <label>
                    Length of stay
                    <select value={nights} onChange={(event) => setNights(event.target.value)}>
                      {[1, 2, 3, 4, 5, 7].map((nightCount) => (
                        <option key={nightCount} value={nightCount}>{nightCount} {nightCount === 1 ? "night" : "nights"}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className={styles.stayRange} aria-live="polite">
                  <span>Arrival <strong>{formatStayDate(shiftDate(checkIn, 0))}</strong></span>
                  <span className={styles.stayLine} />
                  <span>Departure <strong>{formatStayDate(checkOut)}</strong></span>
                  <span className={styles.stayNights}>{nights} {Number(nights) === 1 ? "night" : "nights"}</span>
                </div>
                <label>
                  Phone number
                    <input
                      required
                      type="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="+1 (555) 019-2834"
                    />
                  </label>
                {message && <p className={styles.error} role="alert">{message}</p>}
                <button className={styles.submit} disabled={submitting || !rooms.length}>
                  {submitting ? "Reserving..." : "Reserve your stay"}
                  {!submitting && <ArrowUpRight size={17} />}
                </button>
                <p className={styles.note}>Our concierge will contact you with check-in details.</p>
              </form>
            )}
          </section>

          <aside className={styles.sidePanel}>
            <p className={styles.eyebrow}>Your account</p>
            <h2>Everything starts here.</h2>
            <p>Use this space to book your next stay. Your account details are ready whenever you are.</p>
            <div className={styles.accountDetail}>
              <UserRound size={17} />
              <span>{user.name}</span>
            </div>
            <div className={styles.accountDetail}>
              <Hotel size={17} />
              <span>{user.email}</span>
            </div>
            <Link href="/" className={styles.homeLink}>Explore Hotelier <ArrowUpRight size={15} /></Link>
          </aside>
        </div>}

        {section === "dining" && (
          <section className={styles.servicePage}>
            <header className={styles.servicePageHeader}>
              <div><p className={styles.eyebrow}>Delivered to your room</p><h2>Food & drink</h2></div>
              {reservations.length > 0 ? (
                <label className={styles.roomPicker}>Deliver to
                  <select value={serviceRoom} onChange={(event) => setServiceRoom(event.target.value)}>
                    {reservations.map((reservation) => <option key={reservation.id} value={reservation.roomNumber}>Room {reservation.roomNumber}</option>)}
                  </select>
                </label>
              ) : <Link href="#" onClick={() => setSection("stay")} className={styles.noStayLink}>Book a stay to order</Link>}
            </header>
            {reservations.length > 0 && <label className={styles.quantityPicker}>Quantity
              <select value={orderQuantity} onChange={(event) => setOrderQuantity(event.target.value)}>
                {[1, 2, 3, 4, 5].map((quantity) => <option key={quantity} value={quantity}>{quantity}</option>)}
              </select>
            </label>}
            {(["kitchen", "bar"] as ServiceDepartment[]).map((department) => {
              const items = menu.filter((item) => item.department === department && item.available);
              return (
                <section key={department} className={styles.menuSection}>
                  <div className={styles.menuHeading}>
                    {department === "kitchen" ? <UtensilsCrossed size={18} /> : <Wine size={18} />}
                    <h3>{department === "kitchen" ? "From the kitchen" : "From the bar"}</h3>
                    <span>{items.length} available</span>
                  </div>
                  <div className={styles.guestMenuGrid}>
                    {items.map((item) => (
                      <article className={styles.guestMenuItem} key={item.id}>
                        <img src={item.imageUrl} alt="" />
                        <div className={styles.guestMenuText}>
                          <h4>{item.name}</h4>
                          <p>{item.description}</p>
                          <div><strong>${item.price.toFixed(2)}</strong><button type="button" disabled={!reservations.length} onClick={() => placeServiceOrder(item)}>Order <ArrowUpRight size={15} /></button></div>
                        </div>
                      </article>
                    ))}
                    {items.length === 0 && <p className={styles.emptyMenu}>Nothing available right now.</p>}
                  </div>
                </section>
              );
            })}
          </section>
        )}

        {section === "orders" && (
          <section className={styles.servicePage}>
            <header className={styles.servicePageHeader}><div><p className={styles.eyebrow}>Kitchen & bar updates</p><h2>My orders</h2></div><span className={styles.pollingLabel}><span /> Refreshes automatically</span></header>
            {orders.length === 0 ? <p className={styles.emptyOrders}>You haven&apos;t placed a food or drink order yet.</p> : (
              <div className={styles.guestOrders}>
                {orders.map((order) => (
                  <article key={order.id} className={styles.guestOrder}>
                    <div className={styles.orderGlyph}>{order.department === "kitchen" ? <UtensilsCrossed size={18} /> : <Wine size={18} />}</div>
                    <div className={styles.guestOrderBody}><h3>{order.quantity} × {order.itemName}</h3><p>Room {order.room} · {new Date(order.createdAt).toLocaleString()}</p></div>
                    <span className={`${styles.orderStatus} ${styles[`order_${order.status}`]}`}>{order.status === "ready" ? "Ready" : order.status === "preparing" ? "Preparing" : order.status === "delivered" ? "Delivered" : order.status === "cancelled" ? "Cancelled" : "Received"}</span>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {section === "room-service" && (
          <section className={styles.callPage}>
            <div className={styles.callIntro}>
              <p className={styles.eyebrow}>Speak with the team</p>
              <h2>Room service, by voice.</h2>
              <p>Start an audio-only call with the room-service desk. Your microphone is used only while the call is open.</p>
              <label className={styles.roomPicker}>Your room
                <select value={serviceRoom} onChange={(event) => setServiceRoom(event.target.value)} disabled={!reservations.length}>
                  {reservations.length ? reservations.map((reservation) => <option key={reservation.id} value={reservation.roomNumber}>Room {reservation.roomNumber}</option>) : <option value="">No booked room</option>}
                </select>
              </label>
              {activeCall ? (
                <div className={styles.callActive}>
                  <span className={styles.callPulse}><Phone size={20} /></span>
                  <div><strong>{activeCall.status === "ringing" ? "Calling room service..." : "Call connected"}</strong><span>Room {activeCall.room}</span></div>
                  <button type="button" onClick={endRoomServiceCall} aria-label="End audio call"><Phone size={16} /></button>
                </div>
              ) : (
                <button type="button" className={styles.callButton} onClick={startRoomServiceCall} disabled={startingCall || !reservations.length}>
                  {startingCall ? <span className={styles.spinner} /> : <Mic size={17} />}
                  {startingCall ? "Connecting..." : "Call room service"}
                </button>
              )}
              <audio ref={remoteAudioRef} autoPlay className={styles.remoteAudio} />
            </div>
            <div className={styles.callVisual} aria-hidden="true"><div className={styles.soundRing}><Phone size={30} /></div><span>Audio only · No camera</span></div>
          </section>
        )}
      </div>
    </main>
  );
}