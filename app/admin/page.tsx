"use client";

import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  BedDouble,
  CheckCircle2,
  DollarSign,
  Hotel,
  Package,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import styles from "./page.module.css";

type DashboardMetrics = {
  occupancy: number;
  totalReservations: number;
  activeGuests: number;
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
  inventory: Array<{ id: number; name: string; stock: number; price: number; fill: number; category: string }>;
  recentReservations: ReservationRow[];
  trend: DashboardItem[];
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin")
      .then((response) => response.json())
      .then((payload) => setData(payload))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <main className={styles.page}>
        <section className={styles.loadingCard}>Loading dashboard…</section>
      </main>
    );
  }

  const maxTrendValue = Math.max(...data.trend.map((item) => item.value), 1);

  return (
    <main className={styles.page}>
      <div className={styles.topBar}>
        <div>
          <p className={styles.eyebrow}>Operations</p>
          <h1>Hotel Suite Command Center</h1>
        </div>
        <button className={styles.primaryButton}>
          <Sparkles size={16} />
          Live overview
        </button>
      </div>

      <section className={styles.grid}>
        <article className={styles.cardAccent}>
          <div className={styles.cardHeader}>
            <div className={styles.iconWrap}>
              <BedDouble size={18} />
            </div>
            <span>Occupancy</span>
          </div>
          <div className={styles.metricRow}>
            <strong>{data.metrics.occupancy}%</strong>
            <span className={styles.deltaPositive}>
              <ArrowUpRight size={14} /> +12.4%
            </span>
          </div>
          <p>{data.metrics.activeGuests} rooms currently occupied</p>
        </article>

        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.iconWrap}> <Users size={18} /> </div>
            <span>Guests</span>
          </div>
          <div className={styles.metricRow}>
            <strong>{data.metrics.totalReservations}</strong>
            <span className={styles.deltaPositive}>This week</span>
          </div>
          <p>New reservations and guest check-ins</p>
        </article>

        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.iconWrap}><TrendingUp size={18} /></div>
            <span>Avg stay</span>
          </div>
          <div className={styles.metricRow}>
            <strong>{data.metrics.avgStay} nights</strong>
            <span className={styles.deltaPositive}>Balanced demand</span>
          </div>
          <p>Average guest duration across active stays</p>
        </article>

        <article className={styles.cardAccentAlt}>
          <div className={styles.cardHeader}>
            <div className={styles.iconWrap}><DollarSign size={18} /></div>
            <span>Revenue</span>
          </div>
          <div className={styles.metricRow}>
            <strong>{currency.format(data.metrics.revenue)}</strong>
            <span className={styles.deltaPositive}>+8.9%</span>
          </div>
          <p>Projected booking value for this period</p>
        </article>
      </section>

      <section className={styles.mainPanel}>
        <article className={styles.chartCard}>
          <div className={styles.sectionTitleRow}>
            <div>
              <p className={styles.eyebrow}>Performance</p>
              <h2>Bookings trend</h2>
            </div>
            <span className={styles.badge}>Live</span>
          </div>

          <div className={styles.chart}>
            {data.trend.map((point) => (
              <div key={point.label} className={styles.barGroup}>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{ height: `${(point.value / maxTrendValue) * 100}%` }}
                  />
                </div>
                <span>{point.label}</span>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.card}>
          <div className={styles.sectionTitleRow}>
            <div>
              <p className={styles.eyebrow}>Inventory</p>
              <h2>Service status</h2>
            </div>
            <span className={styles.badgeMuted}><Package size={14} /> Items</span>
          </div>

          <div className={styles.inventoryList}>
            {data.inventory.map((item) => (
              <div key={item.id} className={styles.inventoryItem}>
                <div className={styles.inventoryText}>
                  <strong>{item.name}</strong>
                  <small>{item.category}</small>
                </div>
                <div className={styles.inventoryMeta}>
                  <div className={styles.progressTrack}>
                    <span style={{ width: `${Math.min(item.fill, 100)}%` }} />
                  </div>
                  <b>{item.stock}</b>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className={styles.bottomGrid}>
        <article className={styles.cardWide}>
          <div className={styles.sectionTitleRow}>
            <div>
              <p className={styles.eyebrow}>Recent activity</p>
              <h2>Guest pipeline</h2>
            </div>
            <button className={styles.secondaryButton}>Export</button>
          </div>

          <div className={styles.tableHeader}>
            <span>Guest</span>
            <span>Room</span>
            <span>Nights</span>
            <span>Source</span>
            <span>Status</span>
          </div>

          {data.recentReservations.map((reservation) => (
            <div key={reservation.id} className={styles.tableRow}>
              <span>{reservation.name}</span>
              <span>{reservation.room}</span>
              <span>{reservation.nights}</span>
              <span>{reservation.source}</span>
              <span className={styles.statusPill}><CheckCircle2 size={12} /> Confirmed</span>
            </div>
          ))}
        </article>

        <article className={styles.cardSummary}>
          <div className={styles.sectionTitleRow}>
            <div>
              <p className={styles.eyebrow}>Overview</p>
              <h2>Property score</h2>
            </div>
            <Hotel size={18} />
          </div>

          <div className={styles.scoreRing}>
            <div className={styles.scoreInner}>
              <strong>{Math.min(99, data.metrics.occupancy + 25)}</strong>
              <span>Experience</span>
            </div>
          </div>

          <div className={styles.summaryList}>
            <div>
              <span>Forecast</span>
              <strong>{currency.format(data.metrics.roomRevenue)}</strong>
            </div>
            <div>
              <span>Conversion</span>
              <strong>78%</strong>
            </div>
            <div>
              <span>Guest rating</span>
              <strong>4.9/5</strong>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
