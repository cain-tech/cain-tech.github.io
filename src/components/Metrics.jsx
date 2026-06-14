import { motion } from "framer-motion";
import { Counter, fadeUp, stagger } from "./ui.jsx";

const METRICS = [
  { to: 15, suffix: "+", label: "Years combined experience" },
  { to: 10, suffix: "+", label: "Projects delivered" },
  { to: 2020, suffix: "", label: "Engineering since" },
  { text: "Worldwide", label: "Remote-first delivery" },
];

export default function Metrics() {
  return (
    <motion.section
      className="metrics"
      id="metrics"
      variants={stagger(0.12)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.4 }}
    >
      {METRICS.map((m) => (
        <motion.div className="metric" key={m.label} variants={fadeUp}>
          {m.text ? <strong className="metric-word">{m.text}</strong> : <Counter to={m.to} suffix={m.suffix} />}
          <span>{m.label}</span>
        </motion.div>
      ))}
    </motion.section>
  );
}
