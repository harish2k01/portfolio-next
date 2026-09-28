# Portfolio deployment

## Repositories and routing

| Component                | Source                                            | Runtime                                                                                  |
| ------------------------ | ------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Current website          | `harish2k01/portfolio-next`                       | `harish2k01.xyz`, service `portfolio-next` in namespace `portfolio`, container port 8080 |
| Archived website         | `harish2k01/Portfolio`                            | `v1.harish2k01.xyz`, existing `portfolio-prod` service/release in namespace `portfolio`  |
| Reusable chart           | `harish2k01/helm-charts`, `charts/portfolio-next` | Chart version `0.1.0`, published through the existing Helm/OCI workflow                  |
| Deployment configuration | `harish2k01/homelab-ops`                          | `argocd-apps/portfolio-next.yaml` and `charts/portfolio-next/values.yaml`                |
| ARC runner               | `homelab-ops`                                     | `portfolio-next-runner`, namespace `arc-systems`, chart `gha-runner-scale-set` 0.14.0    |

The old application keeps its resource names, image repository and release workflow. Its HTTPRoute adds `v1.harish2k01.xyz` and retains its internal hostname. The new application uses separate resources, so the sites can run side by side.

## Runner and credentials

The dedicated ARC scale set uses the existing `arc-github-app` Secret and Docker-in-Docker convention. It scales from zero to three ephemeral runners. All portfolio-next jobs, including validation and the reusable GitOps update job, select `portfolio-next-runner`.

The ARC GitHub App must be installed for `portfolio-next`. The Secret remains in Kubernetes; no private key is committed here. Add the existing deployment App credentials as repository secrets **GH_APP_ID** and **GH_APP_PRIVATE_KEY** in `portfolio-next`, as in the old Portfolio repository. That App needs Contents write access to `homelab-ops` for the established direct GitOps commit workflow.

Public fork PR jobs are excluded from the self-hosted validation jobs. Keep GitHub's **Require approval for all external contributors** setting enabled: a fork can propose its own workflow changes, so the checked-in job condition alone is not a security boundary. Review workflow changes before approving a run. Import an approved external contribution into a maintainer-owned branch to run its checks. No privileged runner or credential is supplied to an automatically accepted external PR.

The new runner must be registered before merging or running the portfolio workflow changes; otherwise jobs remain queued. The runner pod does not mount a Kubernetes service-account token. Docker builds use ARC's separate ephemeral DinD container.

The static Astro build runs on `$BUILDPLATFORM`; the runtime stage copies its output into each platform's NGINX image without executing target-architecture commands. AMD64 and ARM64 publication therefore needs no QEMU registration or host `binfmt_misc` support. PR CI also builds both platforms, including SBOM/provenance, without pushing an image.

For recovery of `v0.1.0` and `v0.2.0`, the publisher creates a temporary copy of their Dockerfile with only the Node build-stage platform pinned. It verifies the expected instruction before building and leaves release tags and source files untouched. The image's `io.harish.portfolio.packaging-revision` label records the publishing workflow revision. After merging the fix, dispatch **Release and refresh** from main if needed; rerunning the old failed run would still use its old workflow.

## RSS 403 recovery

The first `v0.1.0` release was created, but image publication stopped because the GitHub-hosted runner received HTTP 403 from the public RSS endpoint. Fetching the same feed locally succeeded.

The trusted `articles` job now reads `http://ghost.ghost.svc.cluster.local:2368/rss/` inside the cluster. It sends Ghost's canonical Host and forwarded HTTPS headers; a direct read against the running Ghost service returned **200 application/rss+xml** with these headers. It normalizes and validates articles using trusted main-branch tooling and uploads one short-lived snapshot artifact. The image publisher checks out the exact release SHA and downloads that snapshot. This also lets the existing `v0.1.0` image be recovered without moving its tag or modifying its source commit.

Normal local builds still use `https://harish2k01.in/rss/`. The internal endpoint is only selected through `PORTFOLIO_RSS_URL` by the trusted release job. Article links remain public HTTPS URLs. Errors still fail closed; there is no stale fallback during publishing.

## Image updates and Argo CD

1. A labeled PR merge creates the next semantic Git release.
2. The publisher builds the released code with the validated RSS snapshot, or skips/reuses the existing image when appropriate.
3. After verifying the image digest, only the **latest stable release** calls `homelab-ops/.github/workflows/update-version.yaml` with `app_name: portfolio-next`, `image_tag`, and `image_digest`.
4. The updater changes `charts/portfolio-next/values.yaml`. Argo CD notices the Git commit and applies a Deployment with `repository@sha256:...`.

A changed blog snapshot changes the pod image digest even when `image.tag` stays the same. No-change runs produce no image build, registry write, Git commit or rollout. The GitOps updater is still checked on an unchanged-image retry so an interrupted GitOps update can recover without rebuilding. Older releases may recover missing images but cannot replace the live deployment.

Roll back by restoring a prior known-good digest in the values file. The chart version is independent of the application release; image refreshes do not republish the Helm chart.

## Bootstrap and cutover order

1. Merge/publish the `helm-charts` chart addition. Verify `portfolio-next` chart `0.1.0` is available in the Helm repository.
2. Merge the `homelab-ops` changes, which add the digest-capable updater, runner application, website application, routes and certificate names. Use the existing GitOps apply approval to bootstrap the runner first. The website application may remain pending until its first image is published; leave public traffic on the old site during this interval.
3. Grant the ARC App access to this repository and add the two deployment App secrets. Confirm `portfolio-next-runner` accepts jobs.
4. Merge the labeled portfolio-next PR. The planner retries the unfinished `v0.1.0` image and publishes the new release. Confirm the latest release's `image.json`, GHCR digest and resulting `homelab-ops` values commit.
5. Merge the old Portfolio canonical-URL update using its conventional `fix:` commit/squash title so its existing semantic-release workflow rebuilds it for `v1.harish2k01.xyz`.
6. Confirm both Argo applications are healthy, and the `wildcard-k8s` Certificate includes `harish2k01.xyz` and `v1.harish2k01.xyz` and reports Ready.
7. Update the externally managed DNS/Cloudflare Tunnel public hostnames only after the new application is healthy.

### DNS and Cloudflare Tunnel

The tunnel's remotely managed hostname configuration is not stored in these repositories. Preserve the existing connector/tunnel; map these public names to the corresponding service:

| Public hostname     | Direct tunnel origin                                   |
| ------------------- | ------------------------------------------------------ |
| `harish2k01.xyz`    | `http://portfolio-next.portfolio.svc.cluster.local:80` |
| `v1.harish2k01.xyz` | `http://portfolio-prod.portfolio.svc.cluster.local:80` |

Alternatively, keep the existing HTTPS Traefik gateway origin for both hostnames and preserve each request's Host/SNI. The configured HTTPRoutes select the correct application, and the expanded certificate covers both names. Do not turn off TLS verification. Ensure both DNS records point to the chosen tunnel/gateway; the new DNS name needs its own record.

Repository and GHCR package visibility are independent. Confirm the published image is anonymously pullable or provide `imagePullSecrets` before deployment. None of these source changes automatically edit DNS, Cloudflare settings, or GitHub App installations.

## Acceptance checks

- `https://harish2k01.xyz` shows the new portfolio; `/healthz` returns 200 and unknown paths return 404.
- `https://v1.harish2k01.xyz` shows the old portfolio with its own canonical URL.
- The running Deployment image matches the release asset digest.
- Manually dispatch `Release and refresh` with unchanged articles: image digest, GitOps commit and pod generation remain unchanged.
- After a new article, the same release tag gets a new content digest, the values commit changes, and Argo CD rolls out that digest.
