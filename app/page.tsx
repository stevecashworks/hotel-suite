"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  Camera,
  Globe,
  MapPin,
  PhoneCall,
  Play,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
  Waves,
} from "lucide-react";
import { IoIosSearch } from "react-icons/io";
import { BsCalendar2Date } from "react-icons/bs";
import About from "../components/about";
import EventShowcase from "../components/eventShowcase";
import SlideShow from "../components/slideShow";
import { hotelLocation } from "../lib/hotel-data";
import styles from "./page.module.css";

const linksData = [
  { path: "#home", text: "Home" },
  { path: "#about", text: "About" },
  { path: "#services", text: "Services" },
  { path: "#rooms", text: "Rooms" },
];

const servicesData = [
  {
    icon: Sparkles,
    title: "Signature Suites",
    description:
      "Thoughtfully designed rooms blending comfort, privacy, and tailored details for memorable stays.",
  },
  {
    icon: Waves,
    title: "Spa & Wellness",
    description:
      "Immersive rituals and restorative experiences to recharge body, mind, and spirit.",
  },
  {
    icon: UtensilsCrossed,
    title: "Chef-Led Dining",
    description:
      "Seasonal menus and curated tastings crafted by celebrated culinary talent.",
  },
  {
    icon: ShieldCheck,
    title: "Private Concierge",
    description:
      "Discreet, attentive support for airport transfers, excursions, and bespoke requests.",
  },
];

const socialLinks = [
  { label: "Instagram", href: "#", icon: Camera },
  { label: "Facebook", href: "#", icon: Globe },
  { label: "YouTube", href: "#", icon: Play },
];

const testimonials = [
  {
    quote:
      "Every detail felt considered. The service was warm, the suite was breathtaking, and the entire stay felt effortlessly luxurious.",
    name: "Ariana W.",
    role: "Wellness Retreat Guest",
    image:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80",
  },
  {
    quote:
      "From the welcome drink to the private dining experience, Hotelier delivered an unforgettable escape that exceeded every expectation.",
    name: "Marcus L.",
    role: "Weekend Traveller",
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80",
  },
  {
    quote:
      "This was the kind of place where you can truly unwind. The staff anticipated everything, and the design was stunning from every angle.",
    name: "Sophia R.",
    role: "Anniversary Stay",
    image:
      "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80",
  },
  {
    quote:
      "The suite felt private and elevated, and every recommendation from the concierge made our trip feel bespoke from beginning to end.",
    name: "Daniel K.",
    role: "Business Guest",
    image:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=900&q=80",
  },
  {
    quote:
      "We booked a long weekend and left feeling completely restored. The spa, rooms, and fine dining were all exceptional.",
    name: "Olivia T.",
    role: "Spa Weekend Guest",
    image:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80",
  },
  {
    quote:
      "A true five-star experience with a warm, personal touch. It was the perfect blend of ceremony, comfort, and quiet luxury.",
    name: "James C.",
    role: "Luxury Escape Guest",
    image:
      "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=900&q=80",
  },
];

export default function Homepage() {
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTestimonial((current) => (current + 1) % testimonials.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const visibleTestimonials = Array.from({ length: 2 }, (_, index) => {
    return testimonials[(activeTestimonial + index) % testimonials.length];
  });

  const moveTestimonial = (direction: number) => {
    setActiveTestimonial((current) => {
      return (current + direction + testimonials.length) % testimonials.length;
    });
  };

  const handleVisitClick = () => {
    const destination = encodeURIComponent(hotelLocation.mapsQuery);
    const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
    window.open(directionsUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className={styles.container}>
      <div className={styles.heroAndHeader}>
        <div className={styles.shade}></div>
        <div className={styles.content}>
          <div className={styles.header}>
            <p className={styles.logo}>Hotelier.</p>
            <div className={styles.links}>
              {linksData.map((link) => {
                return (
                  <a key={link.text} href={link.path} className={styles.link}>
                    {link.text}
                  </a>
                );
              })}
            </div>
            <button type="button" className={styles.button} onClick={handleVisitClick}>
              Visit
              <BedDouble size={18} style={{ marginLeft: "10px" }} />
            </button>
          </div>
          <div className={styles.heroText}>Enjoy the best experience of your life.</div>
          <div className={styles.heroUtility}>
            <div className={styles.utilitySubCon}>
              <label htmlFor="searchInput">
                <IoIosSearch style={{ color: "var(--bg-gray)" }} />
              </label>
              <input
                id="searchInput"
                className={styles.searchInput}
                placeholder="Search..."
              />
            </div>
            <div className={styles.utilitySubCon}>
              <label htmlFor="dateInput">
                <BsCalendar2Date style={{ color: "var(--bg-gray)" }} />
              </label>
              <input
                className={styles.dateInput}
                placeholder="Select Date..."
                type="date"
              />
            </div>
            <div className={styles.utilitySubCon}>
              <label htmlFor="dateInputTwo">
                <BsCalendar2Date style={{ color: "var(--bg-gray)" }} />
              </label>
              <input
                id="dateInputTwo"
                className={styles.dateInput}
                placeholder="Select Date..."
                type="date"
              />
            </div>
            <button className={styles.heroButton}>Search</button>
          </div>
          <div className={styles.heroBottom}>
            <div className={styles.quote}>
              <div className={styles.line}></div>
              <p className={styles.quoteText}>
                We provide the best luxury accommodation, tailored specifically
                for your needs.
              </p>
            </div>
          </div>
        </div>

        <video className={styles.heroVideo} autoPlay muted loop>
          <source src="/hero.mp4" type="video/mp4" />
        </video>
      </div>

      <About />
      <EventShowcase />
      <SlideShow />

      <section className={styles.servicesSection} id="services">
        <div className={styles.servicesHeader}>
          <p className={styles.sectionEyebrow}>Our Signature Experiences</p>
          <h2>Luxury designed around the way you want to feel.</h2>
        </div>

        <div className={styles.servicesGrid}>
          {servicesData.map(({ icon: Icon, title, description }) => (
            <article key={title} className={styles.serviceCard}>
              <div className={styles.serviceIcon}>
                <Icon size={24} />
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.testimonialsSection}>
        <div className={styles.testimonialsHeader}>
          <p className={styles.sectionEyebrow}>Guest Reviews</p>
          <h2>What our guests remember most.</h2>
        </div>

        <div className={styles.testimonialsCarousel}>
          <button
            type="button"
            className={styles.carouselButton}
            onClick={() => moveTestimonial(-1)}
            aria-label="Previous testimonial"
          >
            <ArrowLeft size={18} />
          </button>

          <div className={styles.testimonialGrid}>
            {visibleTestimonials.map((testimonial) => (
              <article key={`${testimonial.name}-${testimonial.role}`} className={styles.testimonialCard}>
                <img
                  src={testimonial.image}
                  alt={testimonial.name}
                  className={styles.testimonialImage}
                />

                <div className={styles.testimonialContent}>
                  <div className={styles.rating}>★★★★★</div>
                  <p className={styles.testimonialQuote}>“{testimonial.quote}”</p>

                  <div className={styles.authorRow}>
                    <div className={styles.authorInfo}>
                      <strong>{testimonial.name}</strong>
                      <span>{testimonial.role}</span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <button
            type="button"
            className={styles.carouselButton}
            onClick={() => moveTestimonial(1)}
            aria-label="Next testimonial"
          >
            <ArrowRight size={18} />
          </button>
        </div>

        <div className={styles.carouselDots}>
          {testimonials.map((testimonial, index) => (
            <button
              key={testimonial.name}
              type="button"
              className={`${styles.dot} ${
                index === activeTestimonial ? styles.dotActive : ""
              }`}
              onClick={() => setActiveTestimonial(index)}
              aria-label={`Go to testimonial ${index + 1}`}
            />
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <div className={styles.footerColumn}>
            <p className={styles.footerBrand}>Hotelier.</p>
            <p className={styles.footerText}>
              Contemporary luxury for unforgettable escapes, intimate moments,
              and effortless indulgence.
            </p>
          </div>

          <div className={styles.footerColumn}>
            <h4>Explore</h4>
            <ul>
              <li>
                <a href="#about">About</a>
              </li>
              <li>
                <a href="#rooms">Rooms</a>
              </li>
              <li>
                <a href="#services">Services</a>
              </li>
              <li>
                <a href="#booking">Booking</a>
              </li>
            </ul>
          </div>

          <div className={styles.footerColumn}>
            <h4>Contact</h4>
            <ul>
              <li>
                <MapPin size={14} />
                <span>27 Ocean Crest, Maldives</span>
              </li>
              <li>
                <PhoneCall size={14} />
                <span>+1 (800) 555-0148</span>
              </li>
            </ul>
          </div>

          <div className={styles.footerColumn}>
            <h4>Follow</h4>
            <div className={styles.socialList}>
              {socialLinks.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className={styles.socialLink}
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.footerBottom}>
          <span>© 2026 Hotelier</span>
          <span>Private luxury experiences</span>
        </div>
      </footer>
    </div>
  );
}
