import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ThemeToggle from "./ThemeToggle.jsx";

const LINKS = [
  { href: "#about", label: "About" },
  { href: "#services", label: "Services" },
  { href: "#stack", label: "Stack" },
  { href: "#partners", label: "Partners" },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      className={`nav ${scrolled ? "scrolled" : ""}`}
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay: 1.4, duration: 0.7, ease: [0.16, 1, 0.3, 1] } }}
    >
      <a className="nav-logo" href="#top" aria-label="Cain Tech home">
        <svg viewBox="0 0 64 64" className="logo-mark" aria-hidden="true">
          <defs>
            <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#00e5ff" />
              <stop offset="1" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
          <path d="M44 20a16 16 0 1 0 0 24" fill="none" stroke="url(#lg)" strokeWidth="7" strokeLinecap="round" />
        </svg>
        <span>CAIN<em>TECH</em></span>
      </a>

      <div className="nav-right">
        <nav className="nav-links">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="nav-link">{l.label}</a>
          ))}
          <a href="#contact" className="nav-link nav-cta">Start a Project</a>
        </nav>

        <ThemeToggle />

        <button
          className={`nav-burger ${open ? "open" : ""}`}
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <span /><span /><span />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            className="nav-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            {[...LINKS, { href: "#contact", label: "Start a Project" }].map((l, i) => (
              <motion.a
                key={l.href}
                href={l.href}
                className="nav-link"
                onClick={() => setOpen(false)}
                initial={{ x: 60, opacity: 0 }}
                animate={{ x: 0, opacity: 1, transition: { delay: 0.1 + i * 0.07 } }}
              >
                {l.label}
              </motion.a>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
