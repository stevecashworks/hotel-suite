import styles from "./about.module.css";

const highlights = [
  "Private concierge and 24/7 service",
  "Curated suites with ocean and skyline views",
  "Wellness, dining, and bespoke experiences",
];

const stats = [
  { value: "120", label: "Signature suites" },
  { value: "4.9", label: "Guest rating" },
  { value: "24/7", label: "Concierge care" },
];

export default function About() {
  return (
    <section className={styles.aboutSection} id="about">
      <div className={styles.contentWrap}>
        <div className={styles.textBlock}>
          <p className={styles.eyebrow}>About Hotelier</p>
          <h2>
            Luxury is more than what we offer. It is how we make you feel.
          </h2>

          <p className={styles.description}>
            From the moment you arrive, every detail is shaped around comfort,
            ease, and memorable hospitality. Our refined spaces, thoughtful
            service, and elevated experiences are designed to turn each stay into
            something beautifully personal.
          </p>

          <ul className={styles.highlights}>
            {highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <div className={styles.actions}>
            <button type="button" className={styles.primaryButton}>
              Discover more
            </button>
            <button type="button" className={styles.secondaryButton}>
              Plan your stay
            </button>
          </div>
        </div>

        <div className={styles.imagePanel}>
          <div className={styles.imageStack}>
            <img
              src="/room%203.jpg"
              alt="Luxury suite interior"
              className={styles.mainImage}
            />
            <img
              src="/room%205.jpg"
              alt="Luxury bedroom detail"
              className={styles.secondaryImage}
            />
          </div>

          <div className={styles.overlayCard}>
            <span className={styles.cardLabel}>Since 1997</span>
            <strong>Crafting unforgettable escapes.</strong>
          </div>

          <div className={styles.statsGrid}>
            {stats.map((stat) => (
              <div key={stat.label} className={styles.statBox}>
                <span>{stat.value}</span>
                <small>{stat.label}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}