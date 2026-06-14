import { useEffect, useRef, useState } from "react";
import { motion, useInView, useMotionValue, useSpring } from "framer-motion";

/* ---------- shared variants ---------- */
export const EASE = [0.16, 1, 0.3, 1];

export const fadeUp = {
  hidden: { opacity: 0, y: 56 },
  show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE } },
};

export const fadeLeft = {
  hidden: { opacity: 0, x: -64 },
  show: { opacity: 1, x: 0, transition: { duration: 0.9, ease: EASE } },
};

export const fadeRight = {
  hidden: { opacity: 0, x: 64 },
  show: { opacity: 1, x: 0, transition: { duration: 0.9, ease: EASE } },
};

export const zoomIn = {
  hidden: { opacity: 0, scale: 0.86 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.9, ease: EASE } },
};

export const stagger = (delay = 0.12) => ({
  hidden: {},
  show: { transition: { staggerChildren: delay } },
});

/* ---------- magnetic hover ---------- */
export function Magnetic({ children, strength = 0.22 }) {
  const ref = useRef(null);
  const x = useSpring(useMotionValue(0), { stiffness: 220, damping: 16 });
  const y = useSpring(useMotionValue(0), { stiffness: 220, damping: 16 });
  return (
    <motion.div
      ref={ref}
      className="magnetic-wrap"
      style={{ x, y }}
      onMouseMove={(e) => {
        const r = ref.current.getBoundingClientRect();
        x.set((e.clientX - r.left - r.width / 2) * strength);
        y.set((e.clientY - r.top - r.height / 2) * strength);
      }}
      onMouseLeave={() => { x.set(0); y.set(0); }}
    >
      {children}
    </motion.div>
  );
}

/* ---------- spotlight card: glow follows the cursor (no tilt) ---------- */
export function SpotlightCard({ children, className = "" }) {
  const ref = useRef(null);
  return (
    <div
      ref={ref}
      className={className}
      onMouseMove={(e) => {
        const r = ref.current.getBoundingClientRect();
        ref.current.style.setProperty("--mx", ((e.clientX - r.left) / r.width) * 100 + "%");
        ref.current.style.setProperty("--my", ((e.clientY - r.top) / r.height) * 100 + "%");
      }}
    >
      {children}
    </div>
  );
}

/* ---------- count-up number ---------- */
export function Counter({ to, suffix = "" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const t0 = performance.now();
    const dur = 1600;
    let raf;
    const tick = (now) => {
      const p = Math.min((now - t0) / dur, 1);
      setVal(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to]);
  return (
    <strong ref={ref}>
      {val}
      {suffix}
    </strong>
  );
}

/* ---------- decode / scramble text ---------- */
const SCRAMBLE_CHARS = "!<>-_\\/[]{}=+*^?#";

export function ScrambleText({ text, className = "" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.8 });
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (!inView) return;
    let frame = 0;
    const total = Math.max(24, text.length * 2);
    let raf;
    const tick = () => {
      frame++;
      const reveal = Math.floor((frame / total) * text.length);
      if (reveal >= text.length) { setOut(text); return; }
      let s = text.slice(0, reveal);
      for (let i = reveal; i < text.length; i++) {
        s += text[i] === " " ? " " : SCRAMBLE_CHARS[(Math.random() * SCRAMBLE_CHARS.length) | 0];
      }
      setOut(s);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, text]);
  return (
    <span ref={ref} className={className} aria-label={text}>
      {out}
    </span>
  );
}

/* ---------- section header ---------- */
export function SectionHead({ tag, children }) {
  return (
    <motion.div
      className="section-head"
      variants={stagger(0.12)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.5 }}
    >
      <motion.span className="section-tag" variants={fadeUp}>
        <ScrambleText text={tag} />
      </motion.span>
      <motion.h2 className="section-title" variants={fadeUp}>
        {children}
      </motion.h2>
    </motion.div>
  );
}
