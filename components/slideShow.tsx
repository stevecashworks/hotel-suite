
"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import styles from "./slideshow.module.css";

const rooms = [
  {
    image: "/room%201.jpg",
    name: "The Royal Suite",
    detail: "Panoramic views · King bed",
  },
  {
    image: "/room%202.jpg",
    name: "The Grand Room",
    detail: "Timeless comfort · City views",
  },
  {
    image: "/room%203.jpg",
    name: "The Skyline Suite",
    detail: "Private lounge · King bed",
  },
  {
    image: "/room%204.jpg",
    name: "The Signature Room",
    detail: "Refined details · Garden views",
  },
  {
    image: "/room%205.jpg",
    name: "The Terrace Suite",
    detail: "Open-air terrace · King bed",
  },
  {
    image: "/room%206.jpg",
    name: "The Executive Room",
    detail: "Quiet luxury · Workspace",
  },
  {
    image: "/room%207.jpg",
    name: "The Penthouse",
    detail: "An unforgettable stay · Top floor",
  },
];

export default function SlideShow() {
  const [activeRoom, setActiveRoom] = useState<number>(0);
  const copyRef = useRef<HTMLDivElement | null>(null);

  function moveSlide(direction: number) {
    setActiveRoom((currentRoom) => {
      return (currentRoom + direction + rooms.length) % rooms.length;
    });
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveRoom((currentRoom) => (currentRoom + 1) % rooms.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

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

        <a className={styles.exploreLink} href="#booking">
          Explore our rooms <span>↗</span>
        </a>
      </div>

      <div className={styles.carousel}>
        <div className={styles.imageFrame}>
          {rooms.map((room, index) => (
            <img
              key={room.image}
              className={`${styles.roomImage} ${
                index === activeRoom ? styles.active : ""
              }`}
              src={room.image}
              alt={room.name}
            />
          ))}

          <div className={styles.roomInfo}>
            <p>{rooms[activeRoom].detail}</p>
            <h3>{rooms[activeRoom].name}</h3>
          </div>
        </div>

        <div className={styles.controls}>
          <div className={styles.counter}>
            <strong>{String(activeRoom + 1).padStart(2, "0")}</strong>
            <span> / {String(rooms.length).padStart(2, "0")}</span>
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


