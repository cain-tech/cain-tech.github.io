import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const LETTERS = "CAIN TECH".split("");

export default function Preloader() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), 1500);
    return () => clearTimeout(t);
  }, []);
  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          className="preloader"
          exit={{ y: "-100%", transition: { duration: 0.7, ease: [0.76, 0, 0.24, 1] } }}
          aria-hidden="true"
        >
          <div className="preloader-word">
            {LETTERS.map((ch, i) => (
              <motion.span
                key={i}
                initial={{ y: 60, opacity: 0, rotateX: -90 }}
                animate={{
                  y: 0, opacity: 1, rotateX: 0,
                  transition: { delay: 0.08 * i, duration: 0.6, ease: [0.16, 1, 0.3, 1] },
                }}
                className={i > 4 ? "grad" : ""}
              >
                {ch === " " ? " " : ch}
              </motion.span>
            ))}
          </div>
          <motion.div
            className="preloader-line"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1, transition: { delay: 0.3, duration: 1.0, ease: "easeInOut" } }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
