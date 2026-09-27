# Harish · Portfolio

A personal portfolio for Harish Thangadurai, Site Reliability Engineer at NielsenIQ. Built from scratch with Astro, TypeScript, and custom CSS. Fully static output, locally served fonts, an optimized portrait, and a small amount of framework-free JavaScript.

## Run locally

Requires Node.js 24 (Node 22.12+ is supported) and npm.

```sh
npm ci
npm run dev
```

Open the address printed by Astro (normally `http://127.0.0.1:4321`).

```sh
npm run validate  # Astro/TypeScript diagnostics, build, output checks
npm run preview   # preview the production build
```

## What's included

- A responsive homepage with portrait, subtle orbital motion, featured projects, professional timeline, education, prominent grouped technical skills, blog platform links, and contact links.
- Four project detail pages and an archive preserving all seven projects from the original portfolio, plus four additional public projects.
- A plain-language homelab overview explaining applications, deployments, and monitoring.
- Mobile navigation, skip link, focus indicators, reduced-motion support, print styles, and clipboard feedback with a manual-copy fallback.
- Canonical metadata, sitemap, robots.txt, custom favicon, and a real 404 document.
- Docker, NGINX, Compose, CI validation, and an on-demand GHCR publishing workflow.

There are no API credentials, live status counters, third-party font calls, analytics, external JavaScript, contact-form backend, or Sites hosting dependencies.

## Edit the content

| File                   | Purpose                                                      |
| ---------------------- | ------------------------------------------------------------ |
| `src/data/profile.ts`  | Identity, social links, career milestones, education, skills |
| `src/data/projects.ts` | Featured project stories and the full archive                |

| `src/assets/harish.jpg` | Original supplied portrait; Astro produces responsive WebP assets |
| `src/pages/index.astro` | Homepage structure and introduction |
| `src/components/Lab.astro` | Plain-language homelab overview |
| `src/styles/global.css` | Theme tokens, layout, responsive rules, print styles |

Keep employment achievements factual. The source material provides job titles and start milestones, not quantified professional impact; the site does not invent metrics or employment end dates. See `CONTENT_SOURCES.md` for provenance and editorial choices.

The writing section links directly to Tech Bytes and Medium through `src/data/profile.ts`. There is no article list to maintain or feed service to configure; new posts remain discoverable through those platform links.

## Build for your domain

The default canonical origin is `https://harish2k01.xyz`. To change it, set `SITE_URL` in the build process or update `astro.config.mjs`.

```sh
SITE_URL=https://your-domain.example npm run build
```

PowerShell:

```powershell
$env:SITE_URL = 'https://your-domain.example'
npm run build
```

Serve `dist/` with any static web server. Preserve directory routes such as `/projects/homelab-ops/` and configure missing URLs to return HTTP 404 with `404.html`.

## Self-host with Docker

```sh
docker compose up --build -d
```

Visit `http://localhost:8080`. Compose binds to loopback by default, ready for a reverse proxy on the same host. Change the port binding intentionally if your proxy runs elsewhere. Optional Compose variables: `PORT` and `SITE_URL` (see `.env.example`).

Build/run without Compose:

```sh
docker build --build-arg SITE_URL=https://harish2k01.xyz -t portfolio-next:local .
docker run -d --name portfolio-next -p 8080:8080 portfolio-next:local
```

The runtime uses unprivileged NGINX on port 8080. `/healthz` is available for health probes. HTML revalidates, content-hashed assets have immutable caching, and unknown routes retain HTTP 404. Terminate TLS at your existing ingress or reverse proxy.

## GitHub Actions and Kubernetes

`Validate portfolio` runs on pushes to `main` and pull requests. It checks the source and generated site, builds the image, and verifies the home route, a project route, and production 404 handling.

`Publish container on demand` runs **only when manually dispatched**. It validates during the Docker build and publishes `ghcr.io/harish2k01/portfolio-next:sha-<full-commit-sha>` with provenance and an SBOM. It does not deploy to a cluster or update any existing GitOps repository.

For your existing Helm/GitOps setup:

1. Dispatch the publish workflow for the desired commit.
2. Point the workload at the resulting immutable SHA tag.
3. Set the container and service target port to **8080**.
4. Set readiness/liveness probes to `/healthz` on port 8080.
5. Configure registry pull credentials if the GHCR package is private.
6. Route your domain through the existing ingress/Gateway setup.

Use the existing deployment's image tag to roll back. Nothing in this repository modifies the original portfolio deployment automatically.

## Verification

`npm run validate` checks types, builds all seven HTML pages, checks local route/anchor/asset integrity, verifies essential retained content and sitemap routes, and guards against accidental client-framework hydration or oversized JavaScript.

CI additionally builds and runs the actual production container. Browser review should cover desktop and narrow mobile widths, the menu, keyboard tab navigation, the homelab overview, education details, copy feedback, and project pages.

## Rights

No open-source license has been assigned. The portrait and personal writing remain the owner's content. Bundled font packages retain their own license notices in their package distributions.
