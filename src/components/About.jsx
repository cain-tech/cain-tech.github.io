import { motion } from "framer-motion";
import { SectionHead, SpotlightCard, fadeLeft, fadeRight, stagger } from "./ui.jsx";

const FOUNDERS = [
  {
    initials: "DF", alt: false, name: "Daniel Frank",
    role: "Founder & CEO",
    bio: "Started Cain Tech in 2020. Over a decade across software development, systems design and cloud architecture - and the one who still reviews the hard pull requests.",
  },
  {
    initials: "IF", alt: true, name: "Isaac Frank",
    role: "Co-Founder & Lead Engineer",
    bio: "Joined his brother to lead engineering and delivery. Full-stack to the core, focused on shipping fast without cutting corners - usually from a different time zone each season.",
  },
];

export default function About() {
  return (
    <section className="section about" id="about">
      <SectionHead tag="01 / The team">
        A small studio that <span className="gradient-text">punches well above its size.</span>
      </SectionHead>

      <div className="about-grid">
        <motion.div
          className="about-text"
          variants={fadeLeft}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
        >
          <p>
            Cain Tech is a founder-led studio built around one idea: keep the
            team small, senior and accountable. Daniel started it in 2020 and
            Isaac joined to build it up - so every project is scoped, designed
            and shipped by the same two engineers you talk to on day one.
          </p>
          <p>
            When a project needs more than two pairs of hands, we bring in a
            hand-picked bench of specialists from our worldwide network -
            experts at the top of their fields - scaled precisely to what each
            engagement needs. Boutique focus, with the depth of a much larger
            team.
          </p>
          <ul className="about-points">
            <li><span className="point-icon">⟡</span> Founder-led - you talk directly to the engineers building your product</li>
            <li><span className="point-icon">⟡</span> Remote-first by nature - we deliver from wherever in the world we are</li>
            <li><span className="point-icon">⟡</span> An elastic bench of vetted specialists, scaled to each project</li>
          </ul>
        </motion.div>

        <motion.div
          className="about-cards"
          variants={stagger(0.18)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
        >
          {FOUNDERS.map((f) => (
            <motion.div key={f.name} variants={fadeRight}>
              <SpotlightCard className="founder-card">
                <div className={`founder-avatar ${f.alt ? "alt" : ""}`} aria-hidden="true">{f.initials}</div>
                <h3>{f.name}</h3>
                <p className="founder-role">{f.role}</p>
                <p>{f.bio}</p>
              </SpotlightCard>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
