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

- A responsive homepage with portrait, subtle orbital motion, featured projects, professional timeline, education, prominent grouped technical skills, the latest three RSS articles and blog platform links, and contact links.
- Four project detail pages and an archive preserving all seven projects from the original portfolio, plus four additional public projects.
- A plain-language homelab overview explaining applications, deployments, and monitoring.
- Subtle one-time scroll reveals, hover feedback, mobile navigation, skip link, focus indicators, reduced-motion support, print styles, and clipboard feedback with a manual-copy fallback.
- Canonical metadata, sitemap, robots.txt, custom favicon, and a real 404 document.
- Docker, NGINX, Compose, PR-label semantic releases, and content-aware GHCR refreshes.

There are no API credentials, live status counters, third-party font calls, contact-form backend, or Sites hosting dependencies. The shared layout loads a deferred Umami tracker from `umami.harish2k01.xyz`, limited to `harish2k01.xyz` so local previews do not record visits. This is the only external JavaScript; the local JavaScript budget excludes the separately loaded tracker.

## Edit the content

| File                       | Purpose                                                      |
| -------------------------- | ------------------------------------------------------------ |
| `src/data/profile.ts`      | Identity, social links, career milestones, education, skills |
| `src/data/projects.ts`     | Featured project stories and archive                         |
| `src/data/blog.json`       | Validated article snapshot; generated from RSS               |
| `scripts/blog.mjs`         | Build-time RSS fetch, normalization, and fallback            |
| `src/assets/harish.jpg`    | Portrait, optimized by Astro                                 |
| `src/pages/index.astro`    | Homepage structure and content                               |
| `src/components/Lab.astro` | Open homelab workflow diagram                                |
| `src/styles/global.css`    | Theme, layout, responsive styles, and micro-interactions     |

Update career milestones, project descriptions, and social links in the data files above. Layout and styling are separate from the content.

`npm run build` fetches the latest three Tech Bytes articles from RSS. Local builds fall back to the committed snapshot if the feed is unavailable. `npm run blog:refresh` is strict and fails without modifying the snapshot when RSS is invalid or unavailable. CI uses `BLOG_MODE=snapshot` for deterministic validation. The publisher fetches strictly before building, then freezes that snapshot for Docker.

Tech Bytes and Medium profile links remain visible. No feed request runs in the visitor's browser. Publishing a new article requires no portfolio commit.

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
npm run blog:refresh
docker compose up --build -d
```

Visit `http://localhost:8080`. Compose binds to loopback by default, ready for a reverse proxy on the same host. Change the port binding intentionally if your proxy runs elsewhere. Optional Compose variables: `PORT` and `SITE_URL` (see `.env.example`).

Build/run without Compose:

```sh
npm run blog:refresh
docker build --build-arg SITE_URL=https://harish2k01.xyz -t portfolio-next:local .
docker run -d --name portfolio-next -p 8080:8080 portfolio-next:local
```

The runtime uses unprivileged NGINX on port 8080. `/healthz` is available for health probes. HTML revalidates, content-hashed assets have immutable caching, and unknown routes retain HTTP 404. Terminate TLS at your existing ingress or reverse proxy.

## GitHub Actions and Kubernetes

Open a PR with exactly one of `major`, `minor`, or `patch`. After merging to `main`, the workflow creates the next Git tag and GitHub release, then publishes a multi-platform image to `ghcr.io/harish2k01/portfolio-next`. The first `minor` PR starts at `v0.1.0`.

A daily workflow scheduled for midnight UTC (05:30 IST) checks the latest three articles against the latest stable release's published image. GitHub may delay the actual start. If content is unchanged and publication is complete, it skips rebuilding and registry writes. Changed content builds from the same release commit—or reuses an existing matching image—and updates the version alias without creating a Git tag or release for the article update. Feed failures preserve the existing image. The workflow also retries incomplete publications and processes pending code releases.

See [RELEASING.md](RELEASING.md) for image tags, immutability, retry behavior, merge checks, rollback, and the first-PR acceptance test.

The reusable `portfolio-next` Helm chart lives in [helm-charts](https://github.com/harish2k01/helm-charts/tree/main/charts/portfolio-next). Argo CD configuration and environment values live in [homelab-ops](https://github.com/harish2k01/homelab-ops). Publishing the latest release updates the deployment's image tag and digest through the existing reusable version-update workflow. Changed digests roll out new pods; unchanged images and values produce no rollout.

All jobs use the dedicated `portfolio-next-runner` ARC scale set. RSS is fetched directly from the in-cluster Ghost service to avoid the HTTP 403 seen on the GitHub-hosted runner. See [DEPLOYMENT.md](DEPLOYMENT.md) for runner setup, secrets, the `harish2k01.xyz` / `v1.harish2k01.xyz` cutover, and verification.

## Verification

`npm run validate` checks types, builds all seven HTML pages, checks local route/anchor/asset integrity, verifies essential retained content and sitemap routes, guards against accidental client-framework hydration or oversized JavaScript, and exercises RSS/release/image decision logic.

CI additionally builds and runs the actual production container. Browser review should cover desktop and narrow mobile widths, the menu, keyboard tab navigation, the homelab overview, education details, copy feedback, and project pages.

## Rights

No open-source license has been assigned. The portrait and personal writing remain the owner's content. Bundled font packages retain their own license notices in their package distributions.

The npm manifest has `private: true` to prevent accidental npm publication; it does not control GitHub repository visibility.
