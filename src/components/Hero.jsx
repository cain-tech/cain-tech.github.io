import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";
import { Magnetic, EASE } from "./ui.jsx";

const TERMINAL_LINES = [
  "$ cain-tech init --remote",
  "✓ founders ........ 2 brothers, senior engineers",
  "✓ office ......... wherever the wifi reaches",
  "✓ stack .......... software · cloud · ai · web",
  "✓ tests .......... passing",
  "$ deploy --to production",
  "🚀 shipped from somewhere. your move.",
];

const wordsVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 1.55 } },
};

const wordVariant = {
  hidden: { opacity: 0, y: 70, rotateX: -90, filter: "blur(10px)" },
  show: {
    opacity: 1, y: 0, rotateX: 0, filter: "blur(0px)",
    transition: { type: "spring", damping: 16, stiffness: 110 },
  },
};

function Line({ text, gradient = false, caret = false }) {
  return (
    <span className="hero-line">
      {text.split(" ").map((w, i) => (
        <motion.span
          key={i}
          className={`hero-word ${gradient ? "gradient-text" : ""}`}
          variants={wordVariant}
        >
          {w}
        </motion.span>
      ))}
      {caret && <motion.span className="caret" variants={wordVariant}>_</motion.span>}
    </span>
  );
}

function Terminal() {
  const [typed, setTyped] = useState("");
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setTyped(TERMINAL_LINES.join("\n")); return; }
    let li = 0, ci = 0, out = "", timer;
    const type = () => {
      if (li >= TERMINAL_LINES.length) return;
      const line = TERMINAL_LINES[li];
      if (ci < line.length) {
        out += line[ci++];
        setTyped(out);
        timer = setTimeout(type, line.startsWith("$") ? 38 : 14);
      } else {
        out += "\n";
        li++; ci = 0;
        timer = setTimeout(type, li === 4 ? 600 : 260);
      }
    };
    timer = setTimeout(type, 2600);
    return () => clearTimeout(timer);
  }, []);
  return (
    <pre className="terminal-body">
      <code>{typed}</code>
      <span className="terminal-cursor">▋</span>
    </pre>
  );
}

export default function Hero() {
  const ref = useRef(null);

  // mouse parallax
  const mx = useSpring(useMotionValue(0), { stiffness: 50, damping: 20 });
  const my = useSpring(useMotionValue(0), { stiffness: 50, damping: 20 });
  const titleX = useTransform(mx, (v) => v * 26);
  const titleY = useTransform(my, (v) => v * 16);
  const termX = useTransform(mx, (v) => v * -18);
  const termRotY = useTransform(mx, (v) => v * 6);

  // scroll-out parallax
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const drift = useTransform(scrollYProgress, [0, 1], [0, -180]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.92]);

  return (
    <section
      className="hero"
      ref={ref}
      onMouseMove={(e) => {
        mx.set(e.clientX / innerWidth - 0.5);
        my.set(e.clientY / innerHeight - 0.5);
      }}
    >
      <motion.div className="hero-inner pt-12" style={{ opacity: fade, y: drift, scale }}>
        <motion.h1
          className="hero-title"
          variants={wordsVariants}
          initial="hidden"
          animate="show"
          style={{ x: titleX, y: titleY }}
        >
          <Line text="Software that ships" />
          <Line text="from anywhere," gradient />
          <Line text="to everyone" caret />
        </motion.h1>

        <motion.p
          className="hero-sub"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 2.15, duration: 0.8, ease: EASE } }}
        >
          Cain Tech is a founder-led software studio run by two brothers -
          both senior engineers. Remote-first by nature, we design, build and
          ship reliable software, cloud and AI solutions for clients around
          the world.
        </motion.p>

        <motion.div
          className="hero-actions"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 2.3, duration: 0.8, ease: EASE } }}
        >
          <Magnetic><a href="#contact" className="btn btn-primary"><span>Start a Project</span></a></Magnetic>
          <Magnetic><a href="#services" className="btn btn-ghost"><span>Explore Services</span></a></Magnetic>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 60, rotateX: 18 }}
          animate={{ opacity: 1, y: 0, rotateX: 0, transition: { delay: 2.45, duration: 0.9, ease: EASE } }}
          style={{ x: termX, rotateY: termRotY, transformPerspective: 1100 }}
        >
          <motion.div
            className="hero-terminal"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 3.4 }}
            aria-hidden="true"
          >
            <div className="terminal-head">
              <i /><i /><i /><b>cain-tech ~ deploy</b>
            </div>
            <Terminal />
          </motion.div>
        </motion.div>
      </motion.div>

      <motion.a
        className="scroll-hint"
        href="#metrics"
        aria-label="Scroll down"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: 3 } }}
      >
        <span className="mouse"><span className="wheel" /></span>
      </motion.a>
    </section>
  );
}
