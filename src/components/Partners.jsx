import { motion } from "framer-motion";
import { SectionHead, stagger } from "./ui.jsx";

const PARTNERS = [
  "ANNA DATA LTD",
  "Salmon Tech",
  "WTL Technologies",
  "Live Tickets",
  "Refno Capital",
  "2Lead",
  "Your company next ↗",
];

const flipVariant = {
  hidden: { opacity: 0, rotateY: 80, y: 28 },
  show: {
    opacity: 1, rotateY: 0, y: 0,
    transition: { type: "spring", damping: 18, stiffness: 90 },
  },
};

export default function Partners() {
  return (
    <section className="section partners" id="partners">
      <SectionHead tag="04 / Clients">
        In good <span className="gradient-text">company</span>
      </SectionHead>

      <motion.div
        className="partners-row"
        variants={stagger(0.1)}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
      >
        {PARTNERS.map((p) => (
          <motion.div
            className="partner-card"
            key={p}
            variants={flipVariant}
            style={{ transformPerspective: 800 }}
            whileHover={{ y: -6 }}
          >
            <span>{p}</span>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
