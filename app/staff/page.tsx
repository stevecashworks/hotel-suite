"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChefHat, Clock3, GlassWater, Hotel, LoaderCircle, LogOut, Mic, Phone, Plus, RefreshCw, UserRound, X } from "lucide-react";
import type { PublicUser, UserRole } from "@/lib/auth";
import type { RoomServiceCall, ServiceDepartment, ServiceMenuItem, ServiceOrder, ServiceOrderStatus } from "@/lib/service-db";
import styles from "./page.module.css";

type ServiceSnapshot = {
  menu: ServiceMenuItem[];
  orders: ServiceOrder[];
  calls: RoomServiceCall[];
};

const orderStatusOptions: ServiceOrderStatus[] = ["new", "preparing", "ready", "delivered", "cancelled"];

async function waitForIceGathering(peer: RTCPeerConnection) {
  if (peer.iceGatheringState === "complete") return;
  await new Promise<void>((resolve) => {
    const timeout = window.setTimeout(resolve, 8000);
    peer.addEventListener("icegatheringstatechange", () => {
      if (peer.iceGatheringState === "complete") {
        window.clearTimeout(timeout);
        resolve();
      }
    }, { once: false });
  });
}

export default function DepartmentDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [snapshot, setSnapshot] = useState<ServiceSnapshot>({ menu: [], orders: [], calls: [] });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemPrice, setItemPrice] = useState("16");
  const [savingMenu, setSavingMenu] = useState(false);
  const [answeringCall, setAnsweringCall] = useState(false);
  const [activeCallId, setActiveCallId] = useState("");
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeCallIdRef = useRef("");
  const userRef = useRef<PublicUser | null>(null);

  const department = user?.role === "kitchen" || user?.role === "bar" ? user.role : null;
  const isRoomService = user?.role === "room-service";

  async function refresh(showSpinner = false) {
    if (showSpinner) setSyncing(true);
    try {
      const response = await fetch("/api/service", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to refresh service data.");
      setSnapshot(data);
      setMessage("");
      if (data.calls && peerRef.current && activeCallIdRef.current) {
        const activeCall = data.calls.find((call: RoomServiceCall) => call.id === activeCallIdRef.current);
        if (activeCall?.status === "ended") stopCall();
        if (!activeCall && !data.calls.some((call: RoomServiceCall) => call.id === activeCallIdRef.current)) stopCall();
      }
    } catch (error) {
      if (showSpinner) setMessage(error instanceof Error ? error.message : "Unable to refresh service data.");
    } finally {
      if (showSpinner) setSyncing(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    let interval: number | undefined;

    async function start() {
      try {
        const response = await fetch("/api/auth");
        const data = await response.json();
        const signedInUser = data.user as PublicUser | null;
        if (!signedInUser) {
          router.replace("/auth?next=%2Fstaff");
          return;
        }
        if (!["kitchen", "bar", "room-service", "staff"].includes(signedInUser.role)) {
          router.replace("/dashboard");
          return;
        }
        if (cancelled) return;
        setUser(signedInUser);
        userRef.current = signedInUser;
        await refresh();
        interval = window.setInterval(() => refresh(), 3000);
      } catch {
        if (!cancelled) {
          setMessage("We couldn't load the department dashboard.");
          setLoading(false);
        }
      }
    }

    start();
    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
      stopCall();
    };
  }, [router]);

  function stopCall() {
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    activeCallIdRef.current = "";
    setActiveCallId("");
    setAnsweringCall(false);
  }

  async function addMenuItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!department) return;
    setSavingMenu(true);
    setMessage("");
    try {
      const response = await fetch("/api/service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add-menu-item",
          payload: { name: itemName, description: itemDescription, price: Number(itemPrice) },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Menu item could not be added.");
      setItemName("");
      setItemDescription("");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Menu item could not be added.");
    } finally {
      setSavingMenu(false);
    }
  }

  async function toggleAvailability(item: ServiceMenuItem) {
    const response = await fetch("/api/service", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set-menu-availability", payload: { itemId: item.id, available: !item.available } }),
    });
    const data = await response.json();
    if (!response.ok) setMessage(data.error || "Availability could not be updated.");
    else await refresh();
  }

  async function updateOrder(orderId: string, status: ServiceOrderStatus) {
    const response = await fetch("/api/service", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update-order", payload: { orderId, status } }),
    });
    const data = await response.json();
    if (!response.ok) setMessage(data.error || "Order status could not be updated.");
    else await refresh();
  }

  async function answerCall(call: RoomServiceCall) {
    setAnsweringCall(true);
    setMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      localStreamRef.current = stream;
      peerRef.current = peer;
      peer.ontrack = (event) => {
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = event.streams[0];
      };
      stream.getAudioTracks().forEach((track) => peer.addTrack(track, stream));
      await peer.setRemoteDescription(JSON.parse(call.offer || "{}"));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await waitForIceGathering(peer);
      const response = await fetch("/api/service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "answer-audio-call", payload: { callId: call.id, answer: JSON.stringify(peer.localDescription) } }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not answer the call.");
      setActiveCallId(call.id);
      activeCallIdRef.current = call.id;
      setAnsweringCall(false);
      await refresh();
    } catch (error) {
      stopCall();
      setMessage(error instanceof Error ? error.message : "Microphone access is needed to answer.");
    }
  }

  async function endCall() {
    const callId = activeCallId;
    stopCall();
    if (callId) {
      await fetch("/api/service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end-audio-call", payload: { callId } }),
      });
      await refresh();
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
    return <main className={styles.page}><p className={styles.loading}><LoaderCircle className={styles.spinner} size={20} /> Opening your workspace...</p></main>;
  }

  const departmentName = department === "kitchen" ? "Kitchen" : department === "bar" ? "Bar" : "Room service";
  const departmentIcon = department === "kitchen" ? <ChefHat size={18} /> : department === "bar" ? <GlassWater size={18} /> : <Phone size={18} />;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}><Hotel size={20} /> Hotelier.</Link>
        <div className={styles.headerRight}>
          <span className={styles.roleTag}>{departmentIcon}{departmentName} workspace</span>
          <span className={styles.staffName}><UserRound size={15} /> {user.name}</span>
          <button type="button" className={styles.iconButton} onClick={() => refresh(true)} title="Refresh workspace" aria-label="Refresh workspace">
            <RefreshCw size={16} className={syncing ? styles.spinner : ""} />
          </button>
          <button type="button" className={styles.iconButton} onClick={signOut} title="Sign out" aria-label="Sign out"><LogOut size={16} /></button>
        </div>
      </header>

      <div className={styles.content}>
        <div className={styles.titleRow}>
          <div>
            <p className={styles.eyebrow}>Hotel Suite Marina · Operations</p>
            <h1>{department === "kitchen" ? "Kitchen service" : department === "bar" ? "Bar service" : "Room service desk"}</h1>
            <p>{isRoomService ? "Respond to guest audio calls and coordinate requests." : "Manage availability and keep guest orders moving."}</p>
          </div>
          <span className={styles.live}><span /> Updates every 3 seconds</span>
        </div>

        {message && <p className={styles.message} role="alert">{message}</p>}

        {department ? (
          <div className={styles.departmentGrid}>
            <section className={styles.section}>
              <header className={styles.sectionHeader}>
                <div><p className={styles.eyebrow}>Guest-facing catalog</p><h2>{department === "kitchen" ? "Food menu" : "Drinks menu"}</h2></div>
                <span className={styles.count}>{snapshot.menu.length} items</span>
              </header>
              <form className={styles.menuForm} onSubmit={addMenuItem}>
                <label>Item name<input required value={itemName} onChange={(event) => setItemName(event.target.value)} placeholder={department === "kitchen" ? "e.g. Seared snapper" : "e.g. Hibiscus cooler"} /></label>
                <label>Description<input value={itemDescription} onChange={(event) => setItemDescription(event.target.value)} placeholder="Short menu description" /></label>
                <label className={styles.priceField}>Price<input type="number" min="0" step="0.01" required value={itemPrice} onChange={(event) => setItemPrice(event.target.value)} /></label>
                <button type="submit" disabled={savingMenu}>{savingMenu ? <LoaderCircle size={16} className={styles.spinner} /> : <Plus size={16} />} Add item</button>
              </form>
              <div className={styles.menuList}>
                {snapshot.menu.filter((item) => item.department === department).map((item) => (
                  <article key={item.id} className={styles.menuRow}>
                    <img src={item.imageUrl} alt="" />
                    <div className={styles.menuInfo}><strong>{item.name}</strong><span>{item.description || "Available to guests"}</span></div>
                    <strong className={styles.price}>${item.price.toFixed(2)}</strong>
                    <button type="button" onClick={() => toggleAvailability(item)} className={item.available ? styles.availableButton : styles.unavailableButton}>
                      {item.available ? <><Check size={14} /> Available</> : <><X size={14} /> Paused</>}
                    </button>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.section}>
              <header className={styles.sectionHeader}>
                <div><p className={styles.eyebrow}>Live fulfillment</p><h2>Guest orders</h2></div>
                <span className={styles.count}>{snapshot.orders.length} orders</span>
              </header>
              <div className={styles.orderList}>
                {snapshot.orders.length === 0 ? <p className={styles.empty}>No guest orders yet.</p> : snapshot.orders.map((order) => (
                  <article key={order.id} className={styles.orderRow}>
                    <div className={styles.orderTop}>
                      <div><strong>{order.quantity} × {order.itemName}</strong><span>{order.guestName} · Room {order.room}</span></div>
                      <time><Clock3 size={13} /> {new Date(order.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>
                    </div>
                    <div className={styles.orderBottom}>
                      <span className={`${styles.status} ${styles[`status_${order.status}`]}`}>{order.status}</span>
                      <select aria-label={`Update ${order.itemName} order`} value={order.status} onChange={(event) => updateOrder(order.id, event.target.value as ServiceOrderStatus)}>
                        {orderStatusOptions.map((status) => <option key={status} value={status}>{status[0].toUpperCase()}{status.slice(1)}</option>)}
                      </select>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className={styles.callLayout}>
            <section className={styles.section}>
              <header className={styles.sectionHeader}>
                <div><p className={styles.eyebrow}>Incoming requests</p><h2>Guest audio calls</h2></div>
                <span className={styles.count}>{snapshot.calls.filter((call) => call.status === "ringing").length} waiting</span>
              </header>
              <div className={styles.orderList}>
                {snapshot.calls.filter((call) => call.status !== "ended").length === 0 ? (
                  <div className={styles.emptyCall}><Phone size={22} /><p>No active guest calls.</p><span>New room-service calls will appear here.</span></div>
                ) : snapshot.calls.filter((call) => call.status !== "ended").map((call) => (
                  <article key={call.id} className={styles.orderRow}>
                    <div className={styles.orderTop}>
                      <div><strong>{call.guestName} · Room {call.room}</strong><span>{call.status === "ringing" ? "Guest is waiting for an answer" : "Audio call in progress"}</span></div>
                      <span className={`${styles.status} ${call.status === "ringing" ? styles.status_new : styles.status_preparing}`}>{call.status}</span>
                    </div>
                    <div className={styles.callActions}>
                      {call.status === "ringing" ? (
                        <button type="button" onClick={() => answerCall(call)} disabled={answeringCall}><Mic size={15} /> {answeringCall ? "Connecting..." : "Answer audio call"}</button>
                      ) : call.id === activeCallId ? (
                        <button type="button" className={styles.endCall} onClick={endCall}><Phone size={15} /> End call</button>
                      ) : <span>Answered by another room-service device</span>}
                    </div>
                  </article>
                ))}
              </div>
            </section>
            <aside className={styles.callNote}>
              <Mic size={20} />
              <h2>Audio only</h2>
              <p>Calls use your browser microphone. Allow microphone access when answering, and keep this dashboard open while connected.</p>
              <audio ref={remoteAudioRef} autoPlay />
              {activeCallId && <p className={styles.connected}><span /> Connected to guest</p>}
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}