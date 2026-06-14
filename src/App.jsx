import { MotionConfig } from "framer-motion";
import Preloader from "./components/Preloader.jsx";
import CursorGlow from "./components/CursorGlow.jsx";
import MorphField from "./components/MorphField.jsx";
import ScrollProgress from "./components/ScrollProgress.jsx";
import Nav from "./components/Nav.jsx";
import Hero from "./components/Hero.jsx";
import Metrics from "./components/Metrics.jsx";
import About from "./components/About.jsx";
import Services from "./components/Services.jsx";
import Stack from "./components/Stack.jsx";
import Partners from "./components/Partners.jsx";
import Contact from "./components/Contact.jsx";
import Footer from "./components/Footer.jsx";

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <Preloader />
      <CursorGlow />
      <MorphField />
      <div className="grid-overlay" aria-hidden="true" />
      <div className="orb orb-a" aria-hidden="true" />
      <div className="orb orb-b" aria-hidden="true" />
      <ScrollProgress />
      <Nav />
      <main id="top">
        <Hero />
        <Metrics />
        <About />
        <Services />
        <Stack />
        <Partners />
        <Contact />
      </main>
      <Footer />
    </MotionConfig>
  );
}
