"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, MapPin } from "lucide-react";
import GuestRegistrationQr from "./guestRegistrationQr";
import styles from "./eventShowcase.module.css";

const eventFiles = [
  "baddies_night_18_plus.png",
  "ladies_night_design_1.png",
  "ladies_night_design_2.png",
  "ladies_night_design_3.png",
  "ladies_night_design_4.png",
  "ladies_night_design_5.png",
];

const events = eventFiles.map((fileName, index) => {
  const baseDetails = {
    image: `/ladies_night_designs/${fileName}`,
    badge: "Signature soirée",
    title: `Event ${index + 1}`,
    date: "Friday · 8:30 PM",
    location: "The Grand Courtyard",
    description:
      "An elevated evening of music, cocktails, and luxe hospitality designed for guests who want unforgettable nights.",
  };

  const overrides: Record<string, Partial<typeof baseDetails>> = {
    "01_hero_pool_resort.jpg": {
      badge: "Signature soirée",
      title: "Moonlit Pool Escape",
      date: "Friday · 8:30 PM",
      location: "Sky Pool Deck",
      description:
        "An elevated evening of golden cocktails, curated music, and candlelit lounging beneath a warm, glowing skyline.",
    },
    "02_hotel_lobby.jpg": {
      badge: "Private launch",
      title: "Velvet Lobby Gala",
      date: "Saturday · 7:00 PM",
      location: "Grand Lobby",
      description:
        "Step into a softly lit lobby transformed with live jazz, signature pours, and a glamorous welcome experience.",
    },
    "03_ocean_suite.jpg": {
      badge: "Coastal night",
      title: "Crescent Bay Champagne",
      date: "Saturday · 9:00 PM",
      location: "Ocean Terrace",
      description:
        "Enjoy sea breezes, sparkling pours, and an intimate setting made for slow evenings and stylish conversation.",
    },
    "04_signature_room.jpg": {
      badge: "Luxury lounge",
      title: "The Signature Rooftop",
      date: "Thursday · 8:00 PM",
      location: "Rooftop Lounge",
      description:
        "A refined rooftop gathering with panoramic city light views, lounge seating, and a premium DJ set.",
    },
    "05_deluxe_room.jpg": {
      badge: "Members only",
      title: "Velvet Suite Social",
      date: "Friday · 10:00 PM",
      location: "The Lounge Room",
      description:
        "An intimate after-hours social for our most cherished guests with bespoke cocktails and warm conversation.",
    },
    "06_spa.jpg": {
      badge: "Wellness ritual",
      title: "Rose Ritual Night",
      date: "Sunday · 6:30 PM",
      location: "The Spa Courtyard",
      description:
        "A restorative evening of mineral rituals, floral scents, and quiet luxury designed to slow the senses.",
    },
    "07_dining.jpg": {
      badge: "Chef’s table",
      title: "Chef’s Supper Club",
      date: "Wednesday · 7:30 PM",
      location: "The Dining Room",
      description:
        "A tasting menu experience shaped by seasonal ingredients, candlelight, and beautifully plated conversation.",
    },
    "08_beach.jpg": {
      badge: "Sunset affair",
      title: "Golden Shore Session",
      date: "Friday · 6:45 PM",
      location: "Private Beach",
      description:
        "A serene sunset setting with cocktails, live acoustic sound, and ocean views made for unforgettable arrivals.",
    },
    "09_culture.jpg": {
      badge: "Art & music",
      title: "Culture After Hours",
      date: "Saturday · 8:15 PM",
      location: "Art Courtyard",
      description:
        "A polished evening blending contemporary art, ambient music, and elevated tastings in a cultural setting.",
    },
    "10_sunset_pool.jpg": {
      badge: "Sunset cocktail",
      title: "Golden Hour Glow",
      date: "Thursday · 7:45 PM",
      location: "Infinity Pool",
      description:
        "Sip with the sunset, settle into plush seating, and enjoy a relaxed atmosphere with resort-level glamour.",
    },
    "11_terrace.jpg": {
      badge: "Open-air scene",
      title: "Skyline Terrace Sessions",
      date: "Friday · 9:30 PM",
      location: "Terrace Level",
      description:
        "A breezy open-air evening of mood lighting, conversation, and a soundtrack curated for lingering nights.",
    },
    "12_ember.jpg": {
      badge: "Evening mood",
      title: "Ember & Silk",
      date: "Saturday · 10:30 PM",
      location: "The Ember Room",
      description:
        "Low light, velvet textures, and handcrafted cocktails come together in a dramatic lounge atmosphere.",
    },
    "13_sky_bar.jpg": {
      badge: "Skyline view",
      title: "Sky Bar After Dark",
      date: "Friday · 8:45 PM",
      location: "Sky Bar",
      description:
        "A modern celebration above the city, designed with music, sparkle, and panoramic views at every angle.",
    },
    "14_coastal_location.jpg": {
      badge: "Coastal escape",
      title: "Coastal Romance",
      date: "Sunday · 7:15 PM",
      location: "Harbor Deck",
      description:
        "A dreamy coastal gathering inspired by soft ocean light, luxe details, and slow, indulgent evenings.",
    },
    "15_night_resort.jpg": {
      badge: "Closing night",
      title: "Midnight Resort Finale",
      date: "Saturday · 11:00 PM",
      location: "Resort Courtyard",
      description:
        "Finish the weekend with a final flourish of candlelight, music, and one last unforgettable night under the stars.",
    },
  };

  return {
    ...baseDetails,
    ...overrides[fileName],
  };
});

export default function EventShowcase() {
  const [activeEvent, setActiveEvent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveEvent((current) => (current + 1) % events.length);
    }, 5200);

    return () => clearInterval(interval);
  }, []);

  const showPrevious = () => {
    setActiveEvent((current) => (current - 1 + events.length) % events.length);
  };

  const showNext = () => {
    setActiveEvent((current) => (current + 1) % events.length);
  };

  return (
    <section className={styles.eventsSection} id="events">
      <div className={styles.heading}>
        <p className={styles.eyebrow}>Upcoming events</p>
        <h2>Evenings designed to feel extraordinary.</h2>
      </div>

      <div className={styles.showcaseLayout}>
        <div className={styles.imagePanel}>
          {events.map((event, index) => (
            <img
              key={event.title}
              src={event.image}
              alt={event.title}
              className={`${styles.slideImage} ${
                index === activeEvent ? styles.active : ""
              }`}
            />
          ))}

          <div className={styles.imageOverlay} />

          <div className={styles.contentCard}>
            <span className={styles.badge}>{events[activeEvent].badge}</span>
            <h3>{events[activeEvent].title}</h3>

            <div className={styles.metaRow}>
              <CalendarDays size={16} />
              <span>{events[activeEvent].date}</span>
            </div>

            <div className={styles.metaRow}>
              <MapPin size={16} />
              <span>{events[activeEvent].location}</span>
            </div>

            <p>{events[activeEvent].description}</p>

            <button type="button" className={styles.reserveButton}>
              Reserve your table
            </button>
          </div>
        </div>

        <GuestRegistrationQr />
      </div>

      <div className={styles.controls}>
        <button type="button" className={styles.navButton} onClick={showPrevious} aria-label="Previous event">
          <ArrowLeft size={18} />
        </button>

        <div className={styles.progressTrack} aria-label="Event progress">
          <span
            className={styles.progressFill}
            style={{ width: `${((activeEvent + 1) / events.length) * 100}%` }}
          />
        </div>

        <button type="button" className={styles.navButton} onClick={showNext} aria-label="Next event">
          <ArrowRight size={18} />
        </button>
      </div>
    </section>
  );
}
