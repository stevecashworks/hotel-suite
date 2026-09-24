"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import styles from "./slideshow.module.css";

type SlideRoom = {
  image: string;
  name: string;
  detail: string;
  price?: number;
};

const defaultRooms: SlideRoom[] = [
  {
    image: "/room 1.jpg",
    name: "The Royal Suite",
    detail: "Panoramic views · King bed",
  },
  {
    image: "/room 2.jpg",
    name: "The Grand Room",
    detail: "Timeless comfort · City views",
  },
  {
    image: "/room 3.jpg",
    name: "The Skyline Suite",
    detail: "Private lounge · King bed",
  },
  {
    image: "/room 4.jpg",
    name: "The Signature Room",
    detail: "Refined details · Garden views",
  },
  {
    image: "/room 5.jpg",
    name: "The Terrace Suite",
    detail: "Open-air terrace · King bed",
  },
  {
    image: "/room 6.jpg",
    name: "The Executive Room",
    detail: "Quiet luxury · Workspace",
  },
  {
    image: "/room 7.jpg",
    name: "The Penthouse",
    detail: "An unforgettable stay · Top floor",
  },
];

export default function SlideShow() {
  const [roomList, setRoomList] = useState<SlideRoom[]>(defaultRooms);
  const [activeRoom, setActiveRoom] = useState<number>(0);
  const copyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch("/api/hotel")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.rooms) && data.rooms.length > 0) {
          const mapped: SlideRoom[] = data.rooms.map(
            (r: {
              imageUrl?: string;
              number: string;
              type: string;
              detail?: string;
              floor: number;
              price: number;
            }) => ({
              image: r.imageUrl || "/room 1.jpg",
              name: `Suite ${r.number} · ${r.type}`,
              detail: r.detail || `Floor ${r.floor} · $${r.price}/night`,
              price: r.price,
            })
          );
          setRoomList(mapped);
        }
      })
      .catch(() => {
        // Fallback to default curated rooms
      });
  }, []);

  function moveSlide(direction: number) {
    setActiveRoom((currentRoom) => {
      const len = roomList.length || 1;
      return (currentRoom + direction + len) % len;
    });
  }

  useEffect(() => {
    if (!roomList.length) return;
    const interval = setInterval(() => {
      setActiveRoom((currentRoom) => (currentRoom + 1) % roomList.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [roomList.length]);

  useEffect(() => {
    const copyNode = copyRef.current;
    if (!copyNode) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            copyNode.classList.add(styles.visible);
            observer.unobserve(copyNode);
          }
        });
      },
      { threshold: 0.2 }
    );

    observer.observe(copyNode);

    return () => observer.disconnect();
  }, []);

  const current = roomList[activeRoom] || defaultRooms[0];

  return (
    <section className={styles.showcase} id="rooms">
      <div ref={copyRef} className={`${styles.copy} ${styles.reveal}`}>
        <p className={styles.eyebrow}>Luxury, redefined</p>

        <h2 className={styles.left}>Our customers deserve nothing less than luxury, so we deliver on that.</h2>

        <p className={styles.description}>
          Thoughtful service, elevated comfort, and beautifully designed spaces
          come together to create an unforgettable stay. Every moment is tailored
          to feel indulgent, effortless, and distinctly memorable.
        </p>

        <a className={styles.exploreLink} href="/register">
          Reserve a room <span>↗</span>
        </a>
      </div>

      <div className={styles.carousel}>
        <div className={styles.imageFrame}>
          {roomList.map((room, index) => (
            <img
              key={`${room.name}-${index}`}
              className={`${styles.roomImage} ${
                index === activeRoom ? styles.active : ""
              }`}
              src={room.image}
              alt={room.name}
            />
          ))}

          <div className={styles.roomInfo}>
            <p>{current.detail}</p>
            <h3>{current.name}</h3>
          </div>
        </div>

        <div className={styles.controls}>
          <div className={styles.counter}>
            <strong>{String(activeRoom + 1).padStart(2, "0")}</strong>
            <span> / {String(roomList.length).padStart(2, "0")}</span>
          </div>

          <div className={styles.buttons}>
            <button
              type="button"
              onClick={() => moveSlide(-1)}
              aria-label="Previous room"
            >
              <ArrowLeft size={18} />
            </button>

            <button
              type="button"
              onClick={() => moveSlide(1)}
              aria-label="Next room"
            >
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
