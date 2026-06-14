# Cain Tech — Company Website

Futuristic single-page site for Cain Tech, built with React + Vite + Framer Motion.

## Stack

- **React 19** + **Vite** — fast dev server, optimized static build
- **Framer Motion** — preloader, 3D word-flip hero, scramble text, scroll-linked parallax, spring tilt cards, flip-in reveals, magnetic buttons
- Canvas particle network, custom cursor glow, animated aurora border

## Develop

```sh
npm install
npm run dev      # http://localhost:5173
```

## Build

```sh
npm run build    # outputs static site to dist/
npm run preview  # serve the production build locally
```

## Deploy to GitHub Pages

Push to `main` in the `cain-tech.github.io` repository. The included GitHub Actions
workflow (`.github/workflows/deploy.yml`) builds the site and deploys `dist/` to Pages.

One-time setup: in the repo settings, set **Pages → Source** to **GitHub Actions**.
