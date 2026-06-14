import { motion } from "framer-motion";
import { SectionHead, SpotlightCard, stagger } from "./ui.jsx";

const SERVICES = [
  { icon: "⌘", num: "01", title: "Software Development", desc: "Custom software built around your business - from greenfield products to untangling and rebuilding complex legacy systems." },
  { icon: "☁", num: "02", title: "Cloud Computing", desc: "Scalable, resilient cloud infrastructure designed for real-world cost, performance and uptime." },
  { icon: "◇", num: "03", title: "AI & Automation", desc: "Practical AI that reaches production - LLM integrations, intelligent agents and workflow automation that earn their keep." },
  { icon: "▤", num: "04", title: "Web & Mobile", desc: "Fast, accessible, beautifully built applications across every screen - on modern frameworks." },
  { icon: "⟁", num: "05", title: "Technology Consulting", desc: "Architecture reviews, audits and technical strategy from engineers who have shipped at scale." },
];

const cardVariant = {
  hidden: { opacity: 0, y: 64, rotateX: -14, scale: 0.95 },
  show: {
    opacity: 1, y: 0, rotateX: 0, scale: 1,
    transition: { type: "spring", damping: 20, stiffness: 90 },
  },
};

export default function Services() {
  return (
    <section className="section services" id="services">
      <SectionHead tag="02 / Capabilities">
        Everything you need to <span className="gradient-text">get to production</span>
      </SectionHead>

      <motion.div
        className="services-grid"
        variants={stagger(0.1)}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.15 }}
      >
        {SERVICES.map((s) => (
          <motion.div key={s.num} variants={cardVariant} style={{ transformPerspective: 900 }}>
            <SpotlightCard className="service-card">
              <div className="service-icon">{s.icon}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
              <span className="service-num">{s.num}</span>
            </SpotlightCard>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
