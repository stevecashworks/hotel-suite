"use client";

import { useEffect, useState } from "react";
import { Compass, MapPinned, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { hotelLocation } from "../lib/hotel-data";
import styles from "./guestRegistrationQr.module.css";

const defaultPosition = { x: 52, y: 48 };

export default function GuestRegistrationQr() {
  const [visitorPosition, setVisitorPosition] = useState(defaultPosition);
  const [isTracking, setIsTracking] = useState(false);
  const [status, setStatus] = useState(() =>
    typeof navigator !== "undefined" && !navigator.geolocation
      ? "Location unavailable"
      : "Waiting for signal"
  );
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    if (!navigator.geolocation) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const x = 22 + ((coords.longitude + 80.3) / 0.25) * 100;
        const y = 18 + ((coords.latitude - 25.7) / 0.18) * 100;

        const clampedX = Math.min(78, Math.max(22, x));
        const clampedY = Math.min(78, Math.max(22, y));

        setVisitorPosition({ x: clampedX, y: clampedY });
        setIsTracking(true);
        setStatus("Live visitor position");
      },
      () => {
        setStatus("Using fallback mode");
        setIsTracking(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (isTracking) return;

    const drift = setInterval(() => {
      setVisitorPosition((current) => ({
        x: Math.min(78, Math.max(22, current.x + (Math.random() - 0.5) * 12)),
        y: Math.min(78, Math.max(22, current.y + (Math.random() - 0.5) * 12)),
      }));
    }, 1800);

    return () => clearInterval(drift);
  }, [isTracking]);

  useEffect(() => {
    const registrationUrl = `${window.location.origin}/register`;
    QRCode.toDataURL(registrationUrl, {
      width: 160,
      margin: 1,
      errorCorrectionLevel: "M",
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(""));
  }, []);

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(hotelLocation.mapsQuery)}`;

  return (
    <aside className={styles.card} aria-label="Visitor location radar and guest registration">
      <div className={styles.contents}>
        <div className={styles.radarPanel}>
          <div className={styles.icon}><Compass size={20} /></div>
          <p className={styles.eyebrow}>Visitor radar</p>
          <h3>Tracking your route to the property.</h3>
          <p className={styles.copy}>Real-time position and direction assistance for guests arriving on site.</p>

          <div className={styles.radarFrame} aria-live="polite">
            <div className={styles.radar}>
              <div className={styles.radarSweep} />
              <div className={styles.ring} />
              <div className={styles.ringLarge} />
              <div className={styles.ringSmall} />
              <div className={styles.hotelMarker} />
              <div
                className={styles.visitorMarker}
                style={{ left: `${visitorPosition.x}%`, top: `${visitorPosition.y}%` }}
              />
            </div>
          </div>

          <div className={styles.statusRow}>
            <span className={`${styles.statusDot} ${isTracking ? styles.live : ""}`} />
            <span>{status}</span>
          </div>

          <a href={directionsUrl} target="_blank" rel="noreferrer" className={styles.link}>
            <MapPinned size={14} />
            Open directions
          </a>
        </div>

        <div className={styles.registerPanel}>
          <div className={styles.icon}><QrCode size={20} /></div>
          <p className={styles.eyebrow}>Scan to register</p>
          <h3>Check in faster.</h3>
          <p className={styles.copy}>Use the QR code to open the guest registration form and reserve your room immediately.</p>

          <div className={styles.qrWrap}>
            {qrDataUrl ? <img src={qrDataUrl} alt="Guest registration QR code" className={styles.qrCode} /> : <div className={styles.qrPlaceholder}>QR</div>}
          </div>

          <a href="/register" className={styles.linkSecondary}>
            Open registration
          </a>
        </div>
      </div>
    </aside>
  );
}
