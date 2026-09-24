"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  AlertCircle,
  BedDouble,
  Check,
  CheckCircle2,
  Copy,
  DollarSign,
  Download,
  ExternalLink,
  Hotel,
  Loader2,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Trash2,
  TrendingUp,
  Users,
  Wrench,
  X,
} from "lucide-react";
import styles from "./page.module.css";
import RevenuePerRoomChart from "@/components/revenuePerRoomChart";
import { RevenueAnalytics } from "@/lib/reservation-db";

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
  imageUrl?: string;
  detail?: string;
};

type DashboardMetrics = {
  occupancy: number;
  totalReservations: number;
  activeGuests: number;
  totalRooms?: number;
  avgStay: number;
  revenue: number;
  roomRevenue: number;
};

type DashboardItem = {
  label: string;
  value: number;
};

type ReservationRow = {
  id: string;
  name: string;
  room: string;
  nights: number;
  source: string;
  createdAt: string | Date;
};

type DashboardResponse = {
  metrics: DashboardMetrics;
  rooms?: Room[];
  inventory: Array<{
    id: number;
    name: string;
    stock: number;
    price: number;
    fill: number;
    category: string;
  }>;
  recentReservations: ReservationRow[];
  trend: DashboardItem[];
  revenueAnalytics?: RevenueAnalytics;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const CURATED_ROOM_PHOTOS = [
  { url: "/05_deluxe_room.jpg", label: "Deluxe King" },
  { url: "/03_ocean_suite.jpg", label: "Ocean Suite" },
  { url: "/04_signature_room.jpg", label: "Signature Suite" },
  { url: "/room 1.jpg", label: "Royal Suite" },
  { url: "/room 2.jpg", label: "Grand Room" },
  { url: "/room 3.jpg", label: "Skyline Suite" },
  { url: "/room 4.jpg", label: "Garden Suite" },
  { url: "/room 5.jpg", label: "Terrace Suite" },
];

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter & Search
  const [statusFilter, setStatusFilter] = useState<"all" | RoomStatus>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Room QR Modal State
  const [selectedQrRoom, setSelectedQrRoom] = useState<Room | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [qrRegistrationUrl, setQrRegistrationUrl] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState(false);

  // Form Fields
  const [formNumber, setFormNumber] = useState("");
  const [formType, setFormType] = useState("Deluxe King");
  const [formFloor, setFormFloor] = useState("1");
  const [formPrice, setFormPrice] = useState("250");
  const [formStatus, setFormStatus] = useState<RoomStatus>("available");
  const [formImage, setFormImage] = useState("/05_deluxe_room.jpg");
  const [formDetail, setFormDetail] = useState("Plush king bed · High ceiling · Marble bath");

  // Notifications
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleOpenQrModal = async (room: Room) => {
    setSelectedQrRoom(room);
    setCopiedLink(false);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const regUrl = `${origin}/register?roomId=${room.id}&room=${encodeURIComponent(room.number)}&roomType=${encodeURIComponent(room.type)}&price=${room.price}`;
    setQrRegistrationUrl(regUrl);

    try {
      const dataUrl = await QRCode.toDataURL(regUrl, {
        width: 320,
        margin: 2,
        errorCorrectionLevel: "M",
        color: {
          dark: "#0b0f17",
          light: "#ffffff",
        },
      });
      setQrDataUrl(dataUrl);
    } catch (err) {
      console.error("Failed to generate room QR code:", err);
      setQrDataUrl("");
    }
  };

  const handleCopyQrLink = () => {
    if (qrRegistrationUrl && typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(qrRegistrationUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2200);
    }
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl || !selectedQrRoom) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `hotelier-room-${selectedQrRoom.number}-qr.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchDashboardData = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    }

    try {
      const [adminRes, hotelRes] = await Promise.all([
        fetch("/api/admin"),
        fetch("/api/hotel"),
      ]);

      const adminData = await adminRes.json();
      const hotelData = await hotelRes.json();

      setData(adminData);
      if (Array.isArray(hotelData?.rooms)) {
        setRooms(hotelData.rooms);
      } else if (Array.isArray(adminData?.rooms)) {
        setRooms(adminData.rooms);
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setNotification({
        type: "error",
        message: "Failed to sync dashboard data with server.",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initialLoad() {
      try {
        const [adminRes, hotelRes] = await Promise.all([
          fetch("/api/admin"),
          fetch("/api/hotel"),
        ]);

        const adminData = await adminRes.json();
        const hotelData = await hotelRes.json();

        if (!cancelled) {
          setData(adminData);
          if (Array.isArray(hotelData?.rooms)) {
            setRooms(hotelData.rooms);
          } else if (Array.isArray(adminData?.rooms)) {
            setRooms(adminData.rooms);
          }
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Initial dashboard fetch error:", err);
          setLoading(false);
        }
      }
    }

    initialLoad();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleAddRoom = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formNumber.trim()) {
      setFormError("Room number is required.");
      return;
    }

    if (!formPrice || Number(formPrice) <= 0) {
      setFormError("Please enter a valid nightly rate.");
      return;
    }

    setModalSaving(true);

    try {
      const response = await fetch("/api/hotel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add-room",
          payload: {
            number: formNumber.trim(),
            type: formType.trim(),
            floor: parseInt(formFloor, 10) || 1,
            price: Number(formPrice),
            status: formStatus,
            imageUrl: formImage,
            detail: formDetail.trim(),
          },
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        setFormError(result.error || "Failed to create room.");
        return;
      }

      // Success
      setIsAddModalOpen(false);
      setFormNumber("");
      setFormDetail("Plush king bed · High ceiling · Marble bath");
      setNotification({
        type: "success",
        message: `Room ${result.room?.number || formNumber} successfully added to database. It is now active across all booking and showcase channels.`,
      });

      // Refresh data
      await fetchDashboardData(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setFormError(message);
    } finally {
      setModalSaving(false);
    }
  };

  const handleToggleStatus = async (roomId: number, currentStatus: RoomStatus) => {
    const nextStatus: RoomStatus =
      currentStatus === "available"
        ? "maintenance"
        : currentStatus === "maintenance"
        ? "available"
        : "available";

    try {
      const res = await fetch("/api/hotel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle-room-availability",
          payload: { roomId, status: nextStatus },
        }),
      });

      const resData = await res.json();
      if (resData.status === "success" && resData.rooms) {
        setRooms(resData.rooms);
        setNotification({
          type: "success",
          message: `Room status updated to "${nextStatus}".`,
        });
        fetchDashboardData(true);
      }
    } catch {
      setNotification({
        type: "error",
        message: "Failed to update room status.",
      });
    }
  };

  const handleDeleteRoom = async (roomId: number, roomNumber: string) => {
    if (!window.confirm(`Are you sure you want to remove Room ${roomNumber} from the database?`)) {
      return;
    }

    try {
      const res = await fetch("/api/hotel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete-room",
          payload: { roomId },
        }),
      });

      const resData = await res.json();
      if (resData.status === "success") {
        setRooms((prev) => prev.filter((r) => r.id !== roomId));
        setNotification({
          type: "success",
          message: `Room ${roomNumber} removed from database.`,
        });
        fetchDashboardData(true);
      }
    } catch {
      setNotification({
        type: "error",
        message: "Failed to delete room.",
      });
    }
  };

  if (loading || !data) {
    return (
      <main className={styles.page}>
        <div className={styles.loadingScreen}>
          <Loader2 className={styles.spinner} size={32} />
          <p>Loading Operations Command Center…</p>
        </div>
      </main>
    );
  }

  // Unique suite types for the dropdown filter
  const uniqueSuiteTypes = Array.from(
    new Set(rooms.map((room) => room.type.trim()).filter(Boolean))
  ).sort();

  // Filtered rooms
  const filteredRooms = rooms.filter((room) => {
    const matchesStatus =
      statusFilter === "all" ? true : room.status === statusFilter;
    const matchesType =
      typeFilter === "all"
        ? true
        : room.type.trim().toLowerCase() === typeFilter.trim().toLowerCase();
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      room.number.toLowerCase().includes(query) ||
      room.type.toLowerCase().includes(query) ||
      (room.detail && room.detail.toLowerCase().includes(query));
    return matchesStatus && matchesType && matchesSearch;
  });

  const availableCount = rooms.filter((r) => r.status === "available").length;
  const bookedCount = rooms.filter((r) => r.status === "booked").length;
  const maintenanceCount = rooms.filter((r) => r.status === "maintenance").length;

  const maxTrendValue = Math.max(...(data.trend?.map((item) => item.value) || [1]), 1);

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        {/* Top Header */}
        <header className={styles.topBar}>
          <div className={styles.brandGroup}>
            <div className={styles.eyebrowRow}>
              <span className={styles.eyebrow}>Hotelier Executive Suite</span>
              <span className={styles.liveIndicator}>
                <span className={styles.liveDot} />
                Live Database
              </span>
            </div>
            <h1>Property & Room Command Center</h1>
          </div>

          <div className={styles.actionGroup}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => fetchDashboardData(true)}
              disabled={refreshing}
              title="Refresh database records"
            >
              <RefreshCw size={15} className={refreshing ? styles.spinner : ""} />
              {refreshing ? "Syncing…" : "Sync DB"}
            </button>

            <a
              href="/register"
              target="_blank"
              rel="noreferrer"
              className={styles.secondaryButton}
            >
              <ExternalLink size={15} />
              Guest Booking Form
            </a>

            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => {
                setFormError("");
                setIsAddModalOpen(true);
              }}
            >
              <Plus size={16} />
              Add New Room
            </button>
          </div>
        </header>

        {/* Notification Toast */}
        {notification && (
          <div
            className={`${styles.banner} ${
              notification.type === "success"
                ? styles.bannerSuccess
                : styles.bannerError
            }`}
            role="status"
          >
            <span>{notification.message}</span>
            <button
              type="button"
              className={styles.bannerClose}
              onClick={() => setNotification(null)}
              aria-label="Dismiss notification"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* KPI Metrics Grid */}
        <section className={styles.kpiGrid} aria-label="Key Performance Indicators">
          <article className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span className={styles.kpiTitle}>Total Rooms in DB</span>
              <div className={styles.kpiIconWrap}>
                <BedDouble size={18} />
              </div>
            </div>
            <div className={styles.kpiValue}>{rooms.length}</div>
            <div className={styles.kpiFooter}>
              <span>{availableCount} Available</span> · <span>{bookedCount} Booked</span> · <span>{maintenanceCount} Maint.</span>
            </div>
          </article>

          <article className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span className={styles.kpiTitle}>Current Occupancy</span>
              <div className={styles.kpiIconWrap}>
                <TrendingUp size={18} />
              </div>
            </div>
            <div className={styles.kpiValue}>
              {rooms.length > 0
                ? Math.round((bookedCount / rooms.length) * 100)
                : 0}
              %
            </div>
            <div className={styles.kpiFooter}>
              <span className={styles.pillPositive}>
                {bookedCount} of {rooms.length} rooms occupied
              </span>
            </div>
          </article>

          <article className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span className={styles.kpiTitle}>Active Reservations</span>
              <div className={styles.kpiIconWrap}>
                <Users size={18} />
              </div>
            </div>
            <div className={styles.kpiValue}>
              {data.metrics.totalReservations}
            </div>
            <div className={styles.kpiFooter}>
              <span>Avg stay: {data.metrics.avgStay} nights</span>
            </div>
          </article>

          <article className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span className={styles.kpiTitle}>Projected Revenue</span>
              <div className={styles.kpiIconWrap}>
                <DollarSign size={18} />
              </div>
            </div>
            <div className={styles.kpiValue}>
              {currencyFormatter.format(data.metrics.revenue || data.metrics.roomRevenue)}
            </div>
            <div className={styles.kpiFooter}>
              <span>Nightly capacity: {currencyFormatter.format(rooms.reduce((s, r) => s + (r.price || 0), 0))}</span>
            </div>
          </article>
        </section>

        {/* Main Section: Room & Suite Management (The core requirement) */}
        <section id="room-database-section" className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleBlock}>
              <h2>Room Database & Suite Inventory</h2>
              <p>
                Add, configure, and monitor rooms. All modifications synchronize across guest reservation forms and hotel showcases.
              </p>
            </div>

            <div className={styles.filterControls}>
              <div className={styles.filterTabs}>
                <button
                  type="button"
                  className={`${styles.tabBtn} ${
                    statusFilter === "all" ? styles.tabBtnActive : ""
                  }`}
                  onClick={() => setStatusFilter("all")}
                >
                  All ({rooms.length})
                </button>
                <button
                  type="button"
                  className={`${styles.tabBtn} ${
                    statusFilter === "available" ? styles.tabBtnActive : ""
                  }`}
                  onClick={() => setStatusFilter("available")}
                >
                  Available ({availableCount})
                </button>
                <button
                  type="button"
                  className={`${styles.tabBtn} ${
                    statusFilter === "booked" ? styles.tabBtnActive : ""
                  }`}
                  onClick={() => setStatusFilter("booked")}
                >
                  Booked ({bookedCount})
                </button>
                <button
                  type="button"
                  className={`${styles.tabBtn} ${
                    statusFilter === "maintenance" ? styles.tabBtnActive : ""
                  }`}
                  onClick={() => setStatusFilter("maintenance")}
                >
                  Maintenance ({maintenanceCount})
                </button>
              </div>

              {/* Suite Type Dropdown Filter */}
              <select
                id="suiteTypeFilter"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className={styles.filterSelect}
                aria-label="Filter rooms by Suite Type"
              >
                <option value="all">All Suite Types ({rooms.length})</option>
                {uniqueSuiteTypes.map((type) => {
                  const count = rooms.filter(
                    (r) => r.type.trim().toLowerCase() === type.toLowerCase()
                  ).length;
                  return (
                    <option key={type} value={type}>
                      {type} ({count})
                    </option>
                  );
                })}
              </select>

              <input
                type="text"
                placeholder="Search suite number or details…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />

              {(typeFilter !== "all" || statusFilter !== "all" || searchQuery.trim() !== "") && (
                <button
                  type="button"
                  className={styles.btnSmall}
                  onClick={() => {
                    setTypeFilter("all");
                    setStatusFilter("all");
                    setSearchQuery("");
                  }}
                  title="Clear all active filters"
                >
                  Clear filters
                </button>
              )}

              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => {
                  setFormError("");
                  setIsAddModalOpen(true);
                }}
              >
                <Plus size={15} />
                Add Room
              </button>
            </div>
          </div>

          <div className={styles.tableWrapper}>
            {filteredRooms.length === 0 ? (
              <div className={styles.emptyState}>
                <p>No rooms match the selected filter criteria.</p>
                {(typeFilter !== "all" || statusFilter !== "all" || searchQuery.trim() !== "") && (
                  <button
                    type="button"
                    className={styles.btnSmall}
                    style={{ marginTop: 10 }}
                    onClick={() => {
                      setTypeFilter("all");
                      setStatusFilter("all");
                      setSearchQuery("");
                    }}
                  >
                    Reset all filters
                  </button>
                )}
              </div>
            ) : (
              <table className={styles.roomTable}>
                <thead>
                  <tr>
                    <th>Room & Details</th>
                    <th>Suite Type</th>
                    <th>Floor</th>
                    <th>Rate / Night</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRooms.map((room) => (
                    <tr key={room.id}>
                      <td>
                        <div className={styles.roomThumbCell}>
                          <img
                            src={room.imageUrl || "/05_deluxe_room.jpg"}
                            alt={`Room ${room.number}`}
                            className={styles.roomThumb}
                          />
                          <div className={styles.roomMeta}>
                            <span className={styles.roomNumber}>
                              Room {room.number}
                            </span>
                            <span className={styles.roomDetailMuted}>
                              {room.detail || "Luxury appointments"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>{room.type}</td>
                      <td>Floor {room.floor}</td>
                      <td>
                        <span className={styles.roomPrice}>
                          ${room.price}
                        </span>
                      </td>
                      <td>
                        {room.status === "available" && (
                          <span className={styles.badgeAvailable}>
                            <CheckCircle2 size={12} /> Available
                          </span>
                        )}
                        {room.status === "booked" && (
                          <span className={styles.badgeBooked}>
                            <Users size={12} /> Booked
                            {room.guest ? ` (${room.guest})` : ""}
                          </span>
                        )}
                        {room.status === "maintenance" && (
                          <span className={styles.badgeMaintenance}>
                            <Wrench size={12} /> Maintenance
                          </span>
                        )}
                      </td>
                      <td>
                        <div className={styles.rowActions}>
                          <button
                            type="button"
                            className={styles.btnSmall}
                            onClick={() => handleOpenQrModal(room)}
                            title={`Generate unique QR registration pass for Room ${room.number}`}
                          >
                            <QrCode size={13} /> QR Pass
                          </button>
                          <button
                            type="button"
                            className={styles.btnSmall}
                            onClick={() => handleToggleStatus(room.id, room.status)}
                            title={
                              room.status === "maintenance"
                                ? "Mark Available"
                                : "Mark Maintenance"
                            }
                          >
                            {room.status === "maintenance"
                              ? "Set Available"
                              : "Set Maint."}
                          </button>
                          <button
                            type="button"
                            className={styles.btnDelete}
                            onClick={() => handleDeleteRoom(room.id, room.number)}
                            title="Delete Room from DB"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Revenue per Room & Suite Profitability Visualization Section */}
        <RevenuePerRoomChart
          rooms={rooms}
          revenueAnalytics={data.revenueAnalytics}
          onSelectRoom={(roomNumber) => {
            setSearchQuery(roomNumber);
            const el = document.getElementById("room-database-section");
            if (el) {
              el.scrollIntoView({ behavior: "smooth" });
            }
          }}
        />

        {/* Split Grid: Bookings Trend & Inventory */}
        <div className={styles.splitGrid}>
          {/* Trend Chart */}
          <article className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleBlock}>
                <h2>Bookings Trend</h2>
                <p>Guest check-in volume over the past 6 days</p>
              </div>
            </div>

            <div className={styles.chartContainer}>
              {data.trend.map((point) => {
                const barHeight = Math.max(12, Math.round((point.value / maxTrendValue) * 100));
                return (
                  <div key={point.label} className={styles.chartColumn}>
                    <div className={styles.chartTrack}>
                      <div
                        className={styles.chartBar}
                        style={{ height: `${barHeight}%` }}
                      />
                    </div>
                    <span className={styles.chartLabel}>{point.label}</span>
                  </div>
                );
              })}
            </div>
          </article>

          {/* Service Inventory */}
          <article className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleBlock}>
                <h2>Property Inventory</h2>
                <p>Amenities and concierge stock</p>
              </div>
            </div>

            <div className={styles.inventoryStack}>
              {data.inventory.map((item) => (
                <div key={item.id} className={styles.inventoryRow}>
                  <div className={styles.inventoryInfo}>
                    <div>
                      <span className={styles.inventoryName}>{item.name}</span>
                      <span className={styles.inventoryCategory}>
                        ({item.category})
                      </span>
                    </div>
                    <span className={styles.inventoryCount}>
                      {item.stock} in stock
                    </span>
                  </div>
                  <div className={styles.progressBarTrack}>
                    <div
                      className={styles.progressBarFill}
                      style={{ width: `${Math.min(item.fill, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>

        {/* Bottom Section: Recent Guest Activity Pipeline */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleBlock}>
              <h2>Guest Pipeline & Activity</h2>
              <p>Recent reservations recorded in the database</p>
            </div>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.roomTable}>
              <thead>
                <tr>
                  <th>Guest Name</th>
                  <th>Assigned Room</th>
                  <th>Stay Length</th>
                  <th>Booking Channel</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentReservations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={styles.emptyState}>
                      No recent reservations recorded.
                    </td>
                  </tr>
                ) : (
                  data.recentReservations.map((reservation) => (
                    <tr key={reservation.id}>
                      <td style={{ fontWeight: 600, color: "#f8fafc" }}>
                        {reservation.name}
                      </td>
                      <td>Room {reservation.room}</td>
                      <td>{reservation.nights} nights</td>
                      <td>{reservation.source}</td>
                      <td>
                        <span className={styles.badgeAvailable}>
                          <CheckCircle2 size={12} /> Confirmed
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Add Room Modal */}
      {isAddModalOpen && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h3>Add Room to Database</h3>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setIsAddModalOpen(false)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div
                className={`${styles.banner} ${styles.bannerError}`}
                style={{ marginBottom: 16 }}
              >
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddRoom}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Room Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 401, 502, PH-1"
                    value={formNumber}
                    onChange={(e) => setFormNumber(e.target.value)}
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Suite Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className={styles.formSelect}
                  >
                    <option value="Deluxe King">Deluxe King</option>
                    <option value="Ocean View Suite">Ocean View Suite</option>
                    <option value="Skyline Penthouse">Skyline Penthouse</option>
                    <option value="Executive Suite">Executive Suite</option>
                    <option value="Signature Terrace">Signature Terrace</option>
                    <option value="Garden Villa">Garden Villa</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Floor Level</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={formFloor}
                    onChange={(e) => setFormFloor(e.target.value)}
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Nightly Rate ($ USD)</label>
                  <input
                    type="number"
                    min="50"
                    step="10"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Initial Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as RoomStatus)}
                    className={styles.formSelect}
                  >
                    <option value="available">Available for Booking</option>
                    <option value="maintenance">Under Maintenance</option>
                    <option value="booked">Booked</option>
                  </select>
                </div>

                <div className={`${styles.formGroup} ${styles.formFull}`}>
                  <label className={styles.formLabel}>
                    Amenities & Room Details
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Panoramic ocean views · King bed · Rain shower · Balcony"
                    value={formDetail}
                    onChange={(e) => setFormDetail(e.target.value)}
                    className={styles.formInput}
                  />
                </div>

                <div className={`${styles.formGroup} ${styles.formFull}`}>
                  <label className={styles.formLabel}>
                    Select Suite Photography
                  </label>
                  <div className={styles.photoOptions}>
                    {CURATED_ROOM_PHOTOS.map((photo) => (
                      <div
                        key={photo.url}
                        className={`${styles.photoThumbOption} ${
                          formImage === photo.url ? styles.photoThumbSelected : ""
                        }`}
                        onClick={() => setFormImage(photo.url)}
                      >
                        <img src={photo.url} alt={photo.label} />
                        {formImage === photo.url && (
                          <div className={styles.photoCheckOverlay}>
                            <Check size={12} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={modalSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={modalSaving}
                >
                  {modalSaving ? (
                    <>
                      <Loader2 className={styles.spinner} size={15} />
                      Saving to Database…
                    </>
                  ) : (
                    <>
                      <Plus size={15} />
                      Save & Publish Room
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Room QR Code Pass Modal */}
      {selectedQrRoom && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
          <div className={styles.modalCard} style={{ maxWidth: 480 }}>
            <div className={styles.modalHeader}>
              <div>
                <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <QrCode size={20} style={{ color: "#3b82f6" }} />
                  Room {selectedQrRoom.number} QR Pass
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#94a3b8" }}>
                  Unique guest registration keycard and direct reservation QR
                </p>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setSelectedQrRoom(null)}
                aria-label="Close QR dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.qrModalBody}>
              {/* Printed / Keycard Style Pass */}
              <div className={styles.qrPassCard}>
                <div className={styles.qrPassBrand}>
                  <Hotel size={16} />
                  Hotelier Luxury Suites
                </div>
                <h4 className={styles.qrPassRoomTitle}>ROOM {selectedQrRoom.number}</h4>
                <div className={styles.qrPassRoomType}>
                  {selectedQrRoom.type} · Floor {selectedQrRoom.floor}
                </div>

                <div className={styles.qrCodeFrame}>
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={`QR code for Room ${selectedQrRoom.number}`}
                      className={styles.qrCodeImage}
                    />
                  ) : (
                    <div style={{ width: 200, height: 200, display: "grid", placeItems: "center" }}>
                      <Loader2 className={styles.spinner} size={28} />
                    </div>
                  )}
                </div>

                <p className={styles.qrPassScanPrompt}>Scan with phone camera to register</p>
                <p className={styles.qrPassSubPrompt}>
                  Instantly holds Room {selectedQrRoom.number} with details pre-filled
                </p>

                <div className={styles.qrPassBadges}>
                  <span className={styles.qrPassBadge}>${selectedQrRoom.price}/night</span>
                  <span className={styles.qrPassBadge}>Floor {selectedQrRoom.floor}</span>
                  <span className={styles.qrPassBadge}>Direct Booking</span>
                </div>
              </div>

              {/* Scannable Target Link info */}
              <div className={styles.qrLinkSection}>
                <span className={styles.qrLinkLabel}>Direct Pre-filled Registration Link</span>
                <div className={styles.qrLinkRow}>
                  <input
                    type="text"
                    readOnly
                    value={qrRegistrationUrl}
                    className={styles.qrLinkInput}
                  />
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={handleCopyQrLink}
                    title="Copy link to clipboard"
                    style={{ padding: "8px 14px", flexShrink: 0 }}
                  >
                    {copiedLink ? (
                      <>
                        <Check size={14} style={{ color: "#34d399" }} />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        Copy Link
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className={styles.qrButtonRow}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={handleDownloadQr}
                  disabled={!qrDataUrl}
                  title="Download high-res PNG for room placards or keycard sleeves"
                >
                  <Download size={15} />
                  Download PNG
                </button>

                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => window.print()}
                  title="Print guest pass"
                >
                  <Printer size={15} />
                  Print Pass
                </button>

                <a
                  href={qrRegistrationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.primaryButton}
                  title="Test scan in new browser tab"
                >
                  <ExternalLink size={15} />
                  Test Scan
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
