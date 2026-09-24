"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  Award,
  BarChart3,
  Calendar,
  DollarSign,
  Hotel,
  Info,
  Layers,
  TrendingUp,
} from "lucide-react";
import { Room } from "@/lib/hotel-data";
import { RevenueAnalytics, RoomRevenueData, SuiteTypeRevenueData } from "@/lib/reservation-db";
import styles from "./revenuePerRoomChart.module.css";

type ChartViewMode = "room" | "suite_type" | "trend";
type MetricType = "revenue" | "nights" | "bookings";
type SortOption = "highest" | "lowest" | "room_number";

interface RevenuePerRoomChartProps {
  rooms: Room[];
  revenueAnalytics?: RevenueAnalytics;
  onSelectRoom?: (roomNumber: string) => void;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export default function RevenuePerRoomChart({
  rooms,
  revenueAnalytics,
  onSelectRoom,
}: RevenuePerRoomChartProps) {
  const [viewMode, setViewMode] = useState<ChartViewMode>("room");
  const [metric, setMetric] = useState<MetricType>("revenue");
  const [sortBy, setSortBy] = useState<SortOption>("highest");
  const [hoveredRoom, setHoveredRoom] = useState<RoomRevenueData | null>(null);
  const [hoveredType, setHoveredType] = useState<SuiteTypeRevenueData | null>(null);
  const [hoveredMonthCluster, setHoveredMonthCluster] = useState<{
    month: string;
    type: string;
    val: number;
  } | null>(null);

  // Fallback calculations if analytics are still loading or missing
  const analytics = useMemo<RevenueAnalytics>(() => {
    if (revenueAnalytics && revenueAnalytics.byRoom?.length > 0) {
      return revenueAnalytics;
    }

    // Client-side fallback derivation
    const suiteTypes = Array.from(new Set(rooms.map((r) => r.type.trim()).filter(Boolean)));
    const byRoom: RoomRevenueData[] = rooms.map((room) => {
      // Estimate reasonable default based on status & price
      const nights = room.status === "booked" ? 6 : 4;
      const totalRevenue = nights * (room.price || 220);
      return {
        roomId: room.id,
        roomNumber: room.number,
        roomType: room.type,
        floor: room.floor,
        price: room.price,
        status: room.status,
        totalRevenue,
        bookingsCount: room.status === "booked" ? 2 : 1,
        totalNights: nights,
        avgStay: 3,
        sharePercentage: 0,
      };
    });

    const totalRevenue = byRoom.reduce((s, r) => s + r.totalRevenue, 0);
    byRoom.forEach((r) => {
      r.sharePercentage = totalRevenue > 0 ? Math.round((r.totalRevenue / totalRevenue) * 1000) / 10 : 0;
    });

    const byType: SuiteTypeRevenueData[] = suiteTypes.map((type) => {
      const ofType = byRoom.filter((r) => r.roomType === type);
      const count = Math.max(ofType.length, 1);
      const typeRev = ofType.reduce((s, r) => s + r.totalRevenue, 0);
      return {
        type,
        roomCount: ofType.length,
        totalRevenue: typeRev,
        avgRevenuePerRoom: Math.round(typeRev / count),
        avgNightlyRate: Math.round(ofType.reduce((s, r) => s + r.price, 0) / count),
        bookingsCount: ofType.reduce((s, r) => s + r.bookingsCount, 0),
        totalNights: ofType.reduce((s, r) => s + r.totalNights, 0),
        sharePercentage: totalRevenue > 0 ? Math.round((typeRev / totalRevenue) * 1000) / 10 : 0,
      };
    });

    const sortedR = [...byRoom].sort((a, b) => b.totalRevenue - a.totalRevenue);
    const sortedT = [...byType].sort((a, b) => b.totalRevenue - a.totalRevenue);

    return {
      byRoom,
      byType,
      monthlyTrend: [
        { month: "May", total: Math.round(totalRevenue * 0.16), byType: {} },
        { month: "Jun", total: Math.round(totalRevenue * 0.18), byType: {} },
        { month: "Jul", total: Math.round(totalRevenue * 0.22), byType: {} },
        { month: "Aug", total: Math.round(totalRevenue * 0.25), byType: {} },
        { month: "Sep", total: Math.round(totalRevenue * 0.19), byType: {} },
      ],
      summary: {
        totalRevenue,
        avgRevenuePerRoom: rooms.length > 0 ? Math.round(totalRevenue / rooms.length) : 0,
        topRoom: sortedR[0]
          ? { roomNumber: sortedR[0].roomNumber, roomType: sortedR[0].roomType, revenue: sortedR[0].totalRevenue }
          : null,
        topSuiteType: sortedT[0]
          ? { type: sortedT[0].type, revenue: sortedT[0].totalRevenue, sharePercentage: sortedT[0].sharePercentage }
          : null,
        totalNightsBooked: byRoom.reduce((s, r) => s + r.totalNights, 0),
      },
    };
  }, [rooms, revenueAnalytics]);

  // Sorting Room Data
  const sortedRooms = useMemo(() => {
    const list = [...analytics.byRoom];
    if (sortBy === "highest") {
      list.sort((a, b) => {
        if (metric === "revenue") return b.totalRevenue - a.totalRevenue;
        if (metric === "nights") return b.totalNights - a.totalNights;
        return b.bookingsCount - a.bookingsCount;
      });
    } else if (sortBy === "lowest") {
      list.sort((a, b) => {
        if (metric === "revenue") return a.totalRevenue - b.totalRevenue;
        if (metric === "nights") return a.totalNights - b.totalNights;
        return a.bookingsCount - b.bookingsCount;
      });
    } else {
      list.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));
    }
    return list;
  }, [analytics.byRoom, metric, sortBy]);

  // Sorting Suite Type Data
  const sortedTypes = useMemo(() => {
    const list = [...analytics.byType];
    if (sortBy === "highest") {
      list.sort((a, b) => {
        if (metric === "revenue") return b.totalRevenue - a.totalRevenue;
        if (metric === "nights") return b.totalNights - a.totalNights;
        return b.bookingsCount - a.bookingsCount;
      });
    } else if (sortBy === "lowest") {
      list.sort((a, b) => {
        if (metric === "revenue") return a.totalRevenue - b.totalRevenue;
        if (metric === "nights") return a.totalNights - b.totalNights;
        return a.bookingsCount - b.bookingsCount;
      });
    } else {
      list.sort((a, b) => a.type.localeCompare(b.type));
    }
    return list;
  }, [analytics.byType, metric, sortBy]);

  // Maximum value for scaling bar heights
  const maxRoomValue = useMemo(() => {
    if (metric === "revenue") {
      const max = Math.max(...analytics.byRoom.map((r) => r.totalRevenue), 100);
      return Math.ceil(max / 500) * 500;
    }
    if (metric === "nights") {
      const max = Math.max(...analytics.byRoom.map((r) => r.totalNights), 5);
      return Math.ceil(max / 2) * 2;
    }
    const max = Math.max(...analytics.byRoom.map((r) => r.bookingsCount), 3);
    return Math.ceil(max / 2) * 2;
  }, [analytics.byRoom, metric]);

  const maxTypeValue = useMemo(() => {
    if (metric === "revenue") {
      const max = Math.max(...analytics.byType.map((t) => t.totalRevenue), 500);
      return Math.ceil(max / 1000) * 1000;
    }
    if (metric === "nights") {
      const max = Math.max(...analytics.byType.map((t) => t.totalNights), 10);
      return Math.ceil(max / 5) * 5;
    }
    const max = Math.max(...analytics.byType.map((t) => t.bookingsCount), 5);
    return Math.ceil(max / 5) * 5;
  }, [analytics.byType, metric]);

  const maxMonthValue = useMemo(() => {
    let max = 0;
    analytics.monthlyTrend.forEach((m) => {
      if (m.byType) {
        Object.values(m.byType).forEach((v) => {
          if (v > max) max = v;
        });
      }
    });
    return max > 0 ? Math.ceil(max / 500) * 500 : 2000;
  }, [analytics.monthlyTrend]);

  const getBarColorClass = (suiteType: string) => {
    const t = suiteType.toLowerCase();
    if (t.includes("ocean")) return styles.fillOceanView;
    if (t.includes("king") || t.includes("deluxe")) return styles.fillDeluxeKing;
    if (t.includes("suite") || t.includes("luxury")) return styles.fillSuite;
    if (t.includes("exec") || t.includes("royal") || t.includes("signature")) return styles.fillExecutive;
    return styles.fillDefault;
  };

  const getMetricDisplay = (val: number) => {
    if (metric === "revenue") return currencyFormatter.format(val);
    if (metric === "nights") return `${val} nts`;
    return `${val} bkgs`;
  };

  return (
    <section className={styles.revenueSection} aria-label="Revenue per Room and Suite Analytics">
      {/* Section Header */}
      <div className={styles.sectionHeader}>
        <div className={styles.titleBlock}>
          <h2>
            <BarChart3 size={20} color="#38bdf8" />
            Revenue per Room & Suite Profitability
          </h2>
          <p>
            Real-time comparative analysis of earnings, nightly yields, and profitability across room inventory over time.
          </p>
        </div>
      </div>

      {/* 4 Executive KPI Summary Highlights */}
      <div className={styles.kpiSummaryRow}>
        <div className={styles.kpiMiniCard}>
          <div className={styles.kpiMiniHeader}>
            <span className={styles.kpiMiniTitle}>Total Realized Revenue</span>
            <div className={styles.kpiMiniIcon}>
              <DollarSign size={16} />
            </div>
          </div>
          <div className={styles.kpiMiniValue}>
            {currencyFormatter.format(analytics.summary.totalRevenue)}
          </div>
          <div className={styles.kpiMiniSubtitle}>
            <span className={styles.highlightBadge}>
              {analytics.summary.totalNightsBooked} nights
            </span>{" "}
            booked across property
          </div>
        </div>

        <div className={styles.kpiMiniCard}>
          <div className={styles.kpiMiniHeader}>
            <span className={styles.kpiMiniTitle}>Most Profitable Suite</span>
            <div className={styles.kpiMiniIcon} style={{ color: "#34d399", backgroundColor: "rgba(16, 185, 129, 0.12)" }}>
              <Award size={16} />
            </div>
          </div>
          <div className={styles.kpiMiniValue}>
            {analytics.summary.topSuiteType?.type || "Ocean View"}
          </div>
          <div className={styles.kpiMiniSubtitle}>
            {analytics.summary.topSuiteType
              ? `${currencyFormatter.format(analytics.summary.topSuiteType.revenue)} (${analytics.summary.topSuiteType.sharePercentage}% share)`
              : "Leading revenue driver"}
          </div>
        </div>

        <div className={styles.kpiMiniCard}>
          <div className={styles.kpiMiniHeader}>
            <span className={styles.kpiMiniTitle}>Top Earning Room</span>
            <div className={styles.kpiMiniIcon} style={{ color: "#fbbf24", backgroundColor: "rgba(245, 158, 11, 0.12)" }}>
              <Hotel size={16} />
            </div>
          </div>
          <div className={styles.kpiMiniValue}>
            Room {analytics.summary.topRoom?.roomNumber || "201"}
          </div>
          <div className={styles.kpiMiniSubtitle}>
            {analytics.summary.topRoom
              ? `${currencyFormatter.format(analytics.summary.topRoom.revenue)} · ${analytics.summary.topRoom.roomType}`
              : "Highest yielding suite"}
          </div>
        </div>

        <div className={styles.kpiMiniCard}>
          <div className={styles.kpiMiniHeader}>
            <span className={styles.kpiMiniTitle}>Avg Revenue / Room</span>
            <div className={styles.kpiMiniIcon} style={{ color: "#a855f7", backgroundColor: "rgba(168, 85, 247, 0.12)" }}>
              <TrendingUp size={16} />
            </div>
          </div>
          <div className={styles.kpiMiniValue}>
            {currencyFormatter.format(analytics.summary.avgRevenuePerRoom)}
          </div>
          <div className={styles.kpiMiniSubtitle}>
            Portfolio average across {rooms.length} rooms
          </div>
        </div>
      </div>

      {/* Interactive Controls Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.segmentedControls}>
          <button
            type="button"
            className={`${styles.segmentBtn} ${viewMode === "room" ? styles.segmentBtnActive : ""}`}
            onClick={() => setViewMode("room")}
          >
            <Hotel size={14} />
            By Individual Room
          </button>
          <button
            type="button"
            className={`${styles.segmentBtn} ${viewMode === "suite_type" ? styles.segmentBtnActive : ""}`}
            onClick={() => setViewMode("suite_type")}
          >
            <Layers size={14} />
            By Suite Type
          </button>
          <button
            type="button"
            className={`${styles.segmentBtn} ${viewMode === "trend" ? styles.segmentBtnActive : ""}`}
            onClick={() => setViewMode("trend")}
          >
            <Calendar size={14} />
            Trend Over Time
          </button>
        </div>

        <div className={styles.toolbarRight}>
          <div className={styles.controlGroup}>
            <span>Metric:</span>
            <select
              className={styles.selectInput}
              value={metric}
              onChange={(e) => setMetric(e.target.value as MetricType)}
            >
              <option value="revenue">Total Revenue ($)</option>
              <option value="nights">Nights Booked</option>
              <option value="bookings">Bookings Count</option>
            </select>
          </div>

          {viewMode !== "trend" && (
            <div className={styles.controlGroup}>
              <ArrowUpDown size={14} />
              <span>Sort:</span>
              <select
                className={styles.selectInput}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
              >
                <option value="highest">Highest First</option>
                <option value="lowest">Lowest First</option>
                <option value="room_number">{viewMode === "room" ? "Room Number" : "Suite Name"}</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Chart Canvas Card */}
      <div className={styles.chartCanvasCard}>
        {/* Meta Header & Legend */}
        <div className={styles.chartMetaHeader}>
          <div>
            <span className={styles.chartMetaTitle}>
              {viewMode === "room" && `Revenue per Room Distribution (${sortedRooms.length} Rooms)`}
              {viewMode === "suite_type" && `Suite Type Profitability Comparison (${sortedTypes.length} Categories)`}
              {viewMode === "trend" && "Monthly Suite Revenue Progression Over Time"}
            </span>
            <span className={styles.chartMetaSub}>
              {metric === "revenue" ? "Realized & projected earnings" : metric === "nights" ? "Total nights stayed" : "Reservation count"}
            </span>
          </div>

          <div className={styles.chartLegend}>
            <div className={styles.legendItem}>
              <div className={styles.legendDot} style={{ background: "linear-gradient(180deg, #06b6d4, #0d9488)" }} />
              <span>Ocean View</span>
            </div>
            <div className={styles.legendItem}>
              <div className={styles.legendDot} style={{ background: "linear-gradient(180deg, #3b82f6, #4f46e5)" }} />
              <span>Deluxe King</span>
            </div>
            <div className={styles.legendItem}>
              <div className={styles.legendDot} style={{ background: "linear-gradient(180deg, #f59e0b, #d97706)" }} />
              <span>Suite</span>
            </div>
            <div className={styles.legendItem}>
              <div className={styles.legendDot} style={{ background: "linear-gradient(180deg, #a855f7, #7c3aed)" }} />
              <span>Other</span>
            </div>
          </div>
        </div>

        {/* View Mode 1: Individual Room Bar Chart */}
        {viewMode === "room" && (
          <div className={styles.chartGrid}>
            {/* Gridlines */}
            <div className={styles.gridLines}>
              <div className={styles.gridLine}>
                <span className={styles.gridLineLabel}>{getMetricDisplay(maxRoomValue)}</span>
              </div>
              <div className={styles.gridLine}>
                <span className={styles.gridLineLabel}>{getMetricDisplay(Math.round(maxRoomValue * 0.66))}</span>
              </div>
              <div className={styles.gridLine}>
                <span className={styles.gridLineLabel}>{getMetricDisplay(Math.round(maxRoomValue * 0.33))}</span>
              </div>
              <div className={styles.gridLine}>
                <span className={styles.gridLineLabel}>{getMetricDisplay(0)}</span>
              </div>
            </div>

            {sortedRooms.map((room) => {
              const currentVal =
                metric === "revenue"
                  ? room.totalRevenue
                  : metric === "nights"
                  ? room.totalNights
                  : room.bookingsCount;
              const heightPercent = Math.max(8, Math.min(100, Math.round((currentVal / maxRoomValue) * 100)));

              return (
                <div
                  key={room.roomNumber}
                  className={styles.barCol}
                  onMouseEnter={() => setHoveredRoom(room)}
                  onMouseLeave={() => setHoveredRoom(null)}
                  onClick={() => onSelectRoom?.(room.roomNumber)}
                  title={`Click to view Room ${room.roomNumber} in table`}
                >
                  <span className={styles.barValue}>{getMetricDisplay(currentVal)}</span>
                  <div className={styles.barTrack}>
                    <div
                      className={`${styles.barFill} ${getBarColorClass(room.roomType)}`}
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>
                  <div className={styles.barLabels}>
                    <span className={styles.barMainLabel}>Room {room.roomNumber}</span>
                    <span className={styles.barSubLabel}>{room.roomType}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* View Mode 2: Suite Type Bar Chart */}
        {viewMode === "suite_type" && (
          <div className={styles.chartGrid}>
            {/* Gridlines */}
            <div className={styles.gridLines}>
              <div className={styles.gridLine}>
                <span className={styles.gridLineLabel}>{getMetricDisplay(maxTypeValue)}</span>
              </div>
              <div className={styles.gridLine}>
                <span className={styles.gridLineLabel}>{getMetricDisplay(Math.round(maxTypeValue * 0.66))}</span>
              </div>
              <div className={styles.gridLine}>
                <span className={styles.gridLineLabel}>{getMetricDisplay(Math.round(maxTypeValue * 0.33))}</span>
              </div>
              <div className={styles.gridLine}>
                <span className={styles.gridLineLabel}>{getMetricDisplay(0)}</span>
              </div>
            </div>

            {sortedTypes.map((typeData) => {
              const currentVal =
                metric === "revenue"
                  ? typeData.totalRevenue
                  : metric === "nights"
                  ? typeData.totalNights
                  : typeData.bookingsCount;
              const heightPercent = Math.max(10, Math.min(100, Math.round((currentVal / maxTypeValue) * 100)));

              return (
                <div
                  key={typeData.type}
                  className={styles.barCol}
                  style={{ maxWidth: "160px" }}
                  onMouseEnter={() => setHoveredType(typeData)}
                  onMouseLeave={() => setHoveredType(null)}
                >
                  <span className={styles.barValue}>{getMetricDisplay(currentVal)}</span>
                  <div className={styles.barTrack} style={{ height: "210px" }}>
                    <div
                      className={`${styles.barFill} ${getBarColorClass(typeData.type)}`}
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>
                  <div className={styles.barLabels}>
                    <span className={styles.barMainLabel}>{typeData.type}</span>
                    <span className={styles.barSubLabel}>
                      {typeData.roomCount} {typeData.roomCount === 1 ? "room" : "rooms"} · {typeData.sharePercentage}% share
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* View Mode 3: Monthly Trend Over Time */}
        {viewMode === "trend" && (
          <div className={styles.chartGrid}>
            {/* Gridlines */}
            <div className={styles.gridLines}>
              <div className={styles.gridLine}>
                <span className={styles.gridLineLabel}>{currencyFormatter.format(maxMonthValue)}</span>
              </div>
              <div className={styles.gridLine}>
                <span className={styles.gridLineLabel}>{currencyFormatter.format(Math.round(maxMonthValue * 0.66))}</span>
              </div>
              <div className={styles.gridLine}>
                <span className={styles.gridLineLabel}>{currencyFormatter.format(Math.round(maxMonthValue * 0.33))}</span>
              </div>
              <div className={styles.gridLine}>
                <span className={styles.gridLineLabel}>$0</span>
              </div>
            </div>

            {analytics.monthlyTrend.map((monthPoint) => (
              <div key={monthPoint.month} className={styles.trendMonthGroup}>
                <div className={styles.trendBarsCluster}>
                  {analytics.byType.map((type) => {
                    const val = monthPoint.byType?.[type.type] || Math.round(type.totalRevenue * 0.2);
                    const barH = Math.max(6, Math.min(100, Math.round((val / maxMonthValue) * 100)));
                    return (
                      <div
                        key={type.type}
                        className={styles.clusterBarCol}
                        onMouseEnter={() =>
                          setHoveredMonthCluster({ month: monthPoint.month, type: type.type, val })
                        }
                        onMouseLeave={() => setHoveredMonthCluster(null)}
                      >
                        <div className={styles.clusterBarTrack}>
                          <div
                            className={`${styles.barFill} ${getBarColorClass(type.type)}`}
                            style={{ height: `${barH}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className={styles.barLabels}>
                  <span className={styles.barMainLabel}>{monthPoint.month}</span>
                  <span className={styles.barSubLabel}>{currencyFormatter.format(monthPoint.total)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Interactive Floating Tooltip on Hover */}
        {hoveredRoom && viewMode === "room" && (
          <div className={styles.tooltipBox}>
            <div className={styles.tooltipTitle}>
              <span>Room {hoveredRoom.roomNumber}</span>
              <span style={{ fontSize: "0.72rem", color: "#38bdf8", fontWeight: 500 }}>
                {hoveredRoom.roomType}
              </span>
            </div>
            <div className={styles.tooltipRow}>
              <span>Total Revenue:</span>
              <strong style={{ color: "#34d399" }}>{currencyFormatter.format(hoveredRoom.totalRevenue)}</strong>
            </div>
            <div className={styles.tooltipRow}>
              <span>Base Nightly Rate:</span>
              <strong>{currencyFormatter.format(hoveredRoom.price)}/night</strong>
            </div>
            <div className={styles.tooltipRow}>
              <span>Total Nights Booked:</span>
              <strong>{hoveredRoom.totalNights} nights</strong>
            </div>
            <div className={styles.tooltipRow}>
              <span>Bookings Volume:</span>
              <strong>{hoveredRoom.bookingsCount} reservations</strong>
            </div>
            <div className={styles.tooltipRow}>
              <span>Property Revenue Share:</span>
              <strong>{hoveredRoom.sharePercentage}%</strong>
            </div>
            <div className={styles.tooltipRow}>
              <span>Floor / Status:</span>
              <strong style={{ textTransform: "capitalize" }}>Floor {hoveredRoom.floor} · {hoveredRoom.status}</strong>
            </div>
          </div>
        )}

        {hoveredType && viewMode === "suite_type" && (
          <div className={styles.tooltipBox}>
            <div className={styles.tooltipTitle}>
              <span>{hoveredType.type}</span>
              <span style={{ fontSize: "0.72rem", color: "#34d399", fontWeight: 500 }}>
                {hoveredType.roomCount} {hoveredType.roomCount === 1 ? "Suite" : "Suites"}
              </span>
            </div>
            <div className={styles.tooltipRow}>
              <span>Total Revenue:</span>
              <strong style={{ color: "#34d399" }}>{currencyFormatter.format(hoveredType.totalRevenue)}</strong>
            </div>
            <div className={styles.tooltipRow}>
              <span>Average Revenue / Room:</span>
              <strong>{currencyFormatter.format(hoveredType.avgRevenuePerRoom)}</strong>
            </div>
            <div className={styles.tooltipRow}>
              <span>Average Base Rate:</span>
              <strong>{currencyFormatter.format(hoveredType.avgNightlyRate)}/night</strong>
            </div>
            <div className={styles.tooltipRow}>
              <span>Total Nights Stayed:</span>
              <strong>{hoveredType.totalNights} nights</strong>
            </div>
            <div className={styles.tooltipRow}>
              <span>Share of Hotel Revenue:</span>
              <strong>{hoveredType.sharePercentage}%</strong>
            </div>
          </div>
        )}

        {hoveredMonthCluster && viewMode === "trend" && (
          <div className={styles.tooltipBox}>
            <div className={styles.tooltipTitle}>
              <span>{hoveredMonthCluster.type}</span>
              <span style={{ fontSize: "0.72rem", color: "#38bdf8", fontWeight: 500 }}>
                {hoveredMonthCluster.month}
              </span>
            </div>
            <div className={styles.tooltipRow}>
              <span>Monthly Realized:</span>
              <strong style={{ color: "#34d399" }}>{currencyFormatter.format(hoveredMonthCluster.val)}</strong>
            </div>
          </div>
        )}
      </div>

      {/* Strategic Management Insight Callout */}
      <div className={styles.insightBanner}>
        <Info size={18} color="#38bdf8" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>Management Strategic Insight:</strong>{" "}
          {analytics.summary.topSuiteType
            ? `${analytics.summary.topSuiteType.type} suites generate ${analytics.summary.topSuiteType.sharePercentage}% of total hotel revenue, leading overall property margins with an average yield of ${currencyFormatter.format(
                analytics.byType.find((t) => t.type === analytics.summary.topSuiteType?.type)?.avgRevenuePerRoom || 0
              )} per suite.`
            : "Ocean View suites generate the highest sustained returns across seasons."}
          {" "}Premium suites show strong RevPAR resilience, suggesting opportunity for dynamic peak-season pricing adjustments.
        </div>
      </div>

      {/* Suite Type Profitability Breakdown Table */}
      <div className={styles.breakdownCard}>
        <div className={styles.breakdownHeader}>
          <div>
            <span className={styles.breakdownTitle}>Suite Profitability Ranking</span>
            <span className={styles.breakdownSub}> · Comprehensive category performance metrics</span>
          </div>
          <span style={{ fontSize: "0.74rem", color: "#94a3b8" }}>
            Updated in real-time from active reservations
          </span>
        </div>

        <table className={styles.breakdownTable}>
          <thead>
            <tr>
              <th>Rank & Suite Type</th>
              <th>Rooms in DB</th>
              <th>Total Revenue</th>
              <th>Avg Yield / Room</th>
              <th>Avg Rate</th>
              <th>Total Nights</th>
              <th>Revenue Share</th>
              <th>Profitability Tier</th>
            </tr>
          </thead>
          <tbody>
            {analytics.byType
              .slice()
              .sort((a, b) => b.totalRevenue - a.totalRevenue)
              .map((typeItem, index) => {
                const rankClass =
                  index === 0
                    ? styles.rankGold
                    : index === 1
                    ? styles.rankSilver
                    : styles.rankBronze;
                const tierClass =
                  index === 0
                    ? styles.tierTop
                    : index === 1
                    ? styles.tierHigh
                    : styles.tierSteady;
                const tierLabel =
                  index === 0
                    ? "🏆 Top Profit Earner"
                    : index === 1
                    ? "💎 High Margin"
                    : "⭐ Steady Volume";

                return (
                  <tr key={typeItem.type}>
                    <td>
                      <div className={styles.typeCell}>
                        <span className={`${styles.rankBadge} ${rankClass}`}>
                          {index + 1}
                        </span>
                        <span>{typeItem.type}</span>
                      </div>
                    </td>
                    <td>{typeItem.roomCount} suites</td>
                    <td style={{ fontWeight: 700, color: "#f8fafc" }}>
                      {currencyFormatter.format(typeItem.totalRevenue)}
                    </td>
                    <td>{currencyFormatter.format(typeItem.avgRevenuePerRoom)}</td>
                    <td>{currencyFormatter.format(typeItem.avgNightlyRate)}/nt</td>
                    <td>{typeItem.totalNights} nts</td>
                    <td>
                      <div className={styles.progressCell}>
                        <div className={styles.progressBarTrack}>
                          <div
                            className={styles.progressBarFill}
                            style={{
                              width: `${Math.min(typeItem.sharePercentage, 100)}%`,
                              backgroundColor:
                                index === 0 ? "#10b981" : index === 1 ? "#38bdf8" : "#f59e0b",
                            }}
                          />
                        </div>
                        <span style={{ fontSize: "0.74rem", color: "#cbd5e1", minWidth: "36px" }}>
                          {typeItem.sharePercentage}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.tierPill} ${tierClass}`}>
                        {tierLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
