# Deployment

The portfolio is a static Astro build served by unprivileged NGINX. It can run on any static host or with Docker; the published site uses Kubernetes, Helm, and Argo CD.

For local builds and Docker commands, see [README.md](README.md). Release and image identity are described in [RELEASING.md](RELEASING.md).

## Production architecture

| Component            | Repository or configuration                       | Purpose                                               |
| -------------------- | ------------------------------------------------- | ----------------------------------------------------- |
| Current website      | `harish2k01/portfolio-next`                       | Serves `harish2k01.xyz`                               |
| Previous website     | `harish2k01/Portfolio`                            | Serves `v1.harish2k01.xyz` independently              |
| Helm chart           | `harish2k01/helm-charts`, `charts/portfolio-next` | Packages the Kubernetes application                   |
| GitOps configuration | `harish2k01/homelab-ops`                          | Stores the Argo CD application and environment values |
| CI runner            | `portfolio-next-runner` ARC scale set             | Runs validation, publishing, and deployment updates   |

The current website runs as service `portfolio-next` in namespace `portfolio`. NGINX listens on container port 8080; the service exposes port 80. The previous website uses the separate `portfolio-prod` service.

## Workflow configuration

The checked-in workflows target this portfolio's infrastructure. Running them in another repository requires configuring the runner labels, image repository, RSS source, and GitOps destination for that environment.

All jobs select the dedicated `portfolio-next-runner` ARC scale set, including the reusable GitOps updater. The runner uses ephemeral Docker-in-Docker containers and does not mount a Kubernetes service-account token. The ARC GitHub App installation must include this repository.

Publishing to GHCR uses the workflow's `GITHUB_TOKEN`. The GitOps updater uses these repository secrets:

| Secret               | Purpose                                  |
| -------------------- | ---------------------------------------- |
| `GH_APP_ID`          | GitHub App ID for the deployment updater |
| `GH_APP_PRIVATE_KEY` | Private key for that App                 |

The deployment App needs Contents write access to `homelab-ops`. Because the updater commits directly to the deployment branch, applicable branch protections must permit that App's updates. Credentials belong in GitHub secrets or Kubernetes Secrets, not in source files.

PR validation runs only for branches in this repository. External fork jobs are skipped because the runner has access to private infrastructure. Maintainers can import reviewed contributions into a repository branch for validation. Require GitHub Actions approval for all external contributors and review workflow changes before approving execution; the job condition alone is not a security boundary.

## Container builds

The Astro build runs on `$BUILDPLATFORM`. Its static output is copied into each target platform's NGINX image without executing target-architecture commands, so AMD64 and ARM64 publishing does not require QEMU. CI builds both platforms with provenance and SBOM attestations.

The publisher also supports early releases whose Dockerfiles predate the native build-stage pin. It adapts that instruction in a temporary build recipe without changing the release's Git tag or checked-out source. The `io.harish.portfolio.packaging-revision` image label identifies the publishing workflow revision.

## Article snapshots

Local builds read `https://harish2k01.in/rss/`. The trusted release job sets `PORTFOLIO_RSS_URL` to the in-cluster Ghost endpoint and supplies the canonical Host and forwarded HTTPS headers. This avoids dependency on public edge filtering for publishing.

The release job normalizes and validates the feed, then uploads a short-lived snapshot artifact. The publisher checks out the exact release SHA and uses that snapshot for its build. Article links remain public HTTPS URLs. Publishing fails if the feed is unavailable or invalid; it does not silently substitute stale content.

## Image updates and Argo CD

1. A labeled PR merge creates the next semantic Git release.
2. The publisher builds the released code with the validated article snapshot, or reuses the matching image.
3. After verifying the digest, only the latest stable release calls `homelab-ops/.github/workflows/update-version.yaml` with `app_name: portfolio-next`, `image_tag`, and `image_digest`.
4. The updater changes `charts/portfolio-next/values.yaml`. Argo CD applies the new Deployment using `repository@sha256:...`.

A changed article snapshot changes the pod image digest even when the version tag stays the same. Unchanged images and values produce no build, registry write, Git commit, or rollout. The updater can retry an interrupted deployment update without rebuilding. Older releases may recover missing images but cannot replace the live deployment.

Rollback restores a known-good digest in the values file. The Helm chart version is independent of the application release; article refreshes do not republish the chart.

## Routing and health

DNS, Cloudflare Tunnel configuration, and TLS termination are managed outside this repository. The two public hostnames route to their respective Kubernetes services. A gateway or reverse proxy must preserve the request hostname and serve a certificate covering it.

The container provides `/healthz` for probes, revalidates HTML, gives content-hashed assets immutable caching, and returns HTTP 404 for unknown routes. Production verification includes the public hostname, project routes, health endpoint, and a running image digest matching the release's `image.json` asset.

GHCR package visibility is configured separately from repository visibility. Kubernetes needs anonymous pull access to the image or a suitable `imagePullSecret`.
