import { motion } from "framer-motion";
import { SectionHead, stagger } from "./ui.jsx";

const CHIPS = [
  "TypeScript", "React", "Next.js", "Node.js", "Python", "Go",
  ".NET", "AWS", "GCP", "Docker", "PostgreSQL", "Redis", "LLM APIs",
];

const STEPS = [
  { num: "01", title: "Discover", desc: "We map your goals, constraints and users before a single line of code." },
  { num: "02", title: "Design", desc: "Architecture and UX shaped together - systems that scale, interfaces that delight." },
  { num: "03", title: "Build", desc: "Short iterations, working software every week, total transparency." },
  { num: "04", title: "Scale", desc: "Launch, observe, harden - and keep evolving with your business." },
];

const chipVariant = {
  hidden: { opacity: 0, scale: 0.4, y: 20 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", damping: 14, stiffness: 200 } },
};

const stepVariant = {
  hidden: { opacity: 0, y: 56 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } },
};

export default function Stack() {
  return (
    <section className="section stack" id="stack">
      <SectionHead tag="03 / How we build">
        A modern, battle-tested <span className="gradient-text">stack</span>
      </SectionHead>

      <motion.div
        className="stack-cloud"
        variants={stagger(0.04)}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.4 }}
      >
        {CHIPS.map((c) => (
          <motion.span
            className="chip"
            key={c}
            variants={chipVariant}
            whileHover={{ y: -4, scale: 1.06 }}
          >
            {c}
          </motion.span>
        ))}
      </motion.div>

      <motion.div
        className="process"
        variants={stagger(0.15)}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
      >
        {STEPS.map((s, i) => (
          <motion.div className="process-wrap" key={s.num} variants={stepVariant}>
            {i > 0 && <div className="process-line" aria-hidden="true" />}
            <div className="process-step">
              <span className="process-num">{s.num}</span>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
