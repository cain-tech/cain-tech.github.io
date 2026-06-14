export default function Footer() {
  return (
    <footer className="footer">
      <span>© {new Date().getFullYear()} Cain Tech. All rights reserved.</span>
      <span className="footer-tag">
        Engineered with precision · cain.tech ·{" "}
        <a className="footer-credit" href="https://sketchfab.com/onirix" target="_blank" rel="noopener noreferrer">
          Snowboarder © Onirix
        </a>{" "}
        ·{" "}
        <a className="footer-credit" href="https://sketchfab.com/3d-models/macbook-ultra-concept-5e69cb60df5943cb9f45b7285faa179d" target="_blank" rel="noopener noreferrer">
          MacBook © Ranguel
        </a>{" "}
        (CC BY 4.0)
      </span>
    </footer>
  );
}
