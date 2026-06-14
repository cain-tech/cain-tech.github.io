import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

export default function CursorGlow() {
  const [enabled] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches
  );
  const mx = useMotionValue(-400);
  const my = useMotionValue(-400);
  const auraX = useSpring(mx, { stiffness: 120, damping: 22 });
  const auraY = useSpring(my, { stiffness: 120, damping: 22 });

  useEffect(() => {
    if (!enabled) return;
    const move = (e) => { mx.set(e.clientX); my.set(e.clientY); };
    window.addEventListener("mousemove", move, { passive: true });
    return () => window.removeEventListener("mousemove", move);
  }, [enabled, mx, my]);

  if (!enabled) return null;
  return <motion.div className="cursor-aura" style={{ x: auraX, y: auraY }} aria-hidden="true" />;
}
