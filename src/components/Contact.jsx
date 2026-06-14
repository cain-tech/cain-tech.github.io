import { motion } from "framer-motion";
import { Magnetic, ScrambleText, zoomIn } from "./ui.jsx";

export default function Contact() {
  return (
    <section className="section contact" id="contact">
      <motion.div
        className="aurora"
        variants={zoomIn}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
      >
        <div className="contact-card">
          <span className="section-tag"><ScrambleText text="05 / Say hello" /></span>
          <h2 className="section-title">
            Have an idea?<br />
            <span className="gradient-text">Let's engineer it.</span>
          </h2>
          <p className="contact-sub">Tell us about your project. Wherever we happen to be in the world, we usually reply within one business day.</p>
          <div className="contact-actions">
            <Magnetic>
              <a className="btn btn-primary" href="mailto:daniel@cain-technologies.com">
                <span>daniel@cain-technologies.com</span>
              </a>
            </Magnetic>
            <Magnetic>
              <a className="btn btn-ghost" href="https://www.linkedin.com/in/cain-tech/" target="_blank" rel="noopener noreferrer">
                <span>Connect on LinkedIn</span>
              </a>
            </Magnetic>
          </div>
          <div className="contact-meta">
            <span><i className="pulse-dot" /> Available for new projects</span>
            <span>🌍 Working worldwide · Remote-first</span>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
