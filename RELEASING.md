# Releases, image identity, and article refreshes

## Code releases

1. Work on a side branch and open a PR to `main`.
2. Add exactly one label: `major`, `minor`, or `patch`. Other labels are allowed. The label check reruns when labels change.
3. Review `release-label` and `validate` checks before merging. Prefer squash merges (merge commits and rebase merges are also recognized through the GitHub merge SHA).
4. `Release and refresh` validates the code, creates a lightweight Git tag and a published GitHub release at the PR merge SHA, and calls the publisher directly. No PAT is required.
5. The publisher checks out that exact SHA, verifies the tag and ancestry, fetches RSS strictly, tests the production container, and publishes linux/amd64 and linux/arm64 images with provenance and SBOM attestations.

Starting point is `v0.0.0`: the first `minor` release is `v0.1.0`, first `major` is `v1.0.0`. `package.json` is a private build-tool manifest; Git release tags are the authority for product versions. Patch increments reset nothing; minor resets patch; major resets minor and patch.

A GitHub release created using `GITHUB_TOKEN` does not trigger a second release-event workflow. The reusable workflow call handles that case. Manually published releases also wake the orchestrator. Stable release tags must be `vMAJOR.MINOR.PATCH`, point to main history, and contain this pipeline. Prereleases are excluded.

All release/refresh runs share one concurrency group and do not cancel active publication. The planner reconciles every unreleased merged PR in first-parent order, so replacing a pending run cannot silently drop a version bump. Direct pushes do not independently create versions. Avoid direct code pushes and changing version labels after merge. An invalid label blocks reconciliation; correct the label and rerun.

## Daily refresh

Scheduled at `17 1 * * *` UTC (06:47 IST). GitHub may delay schedules. The manual `Release and refresh` dispatch on `main` uses the same idempotent logic and is also the retry mechanism.

Only the newest stable release gets routine feed refreshes. A release whose initial image publication failed is also retried until its image metadata asset exists. If an unreleased merge is waiting because a previous run failed or was superseded, it is reconciled before refresh.

The feed is `https://harish2k01.in/rss/`. Normalize, sort, deduplicate, and select the latest three articles, then hash their titles, canonical URLs, and displayed dates. Feed build timestamps, tracking parameters, and edits to older articles do not cause image churn. New articles, edits to displayed titles/links/dates, and deletions affecting the displayed three do.

| Situation                                                       | Result                                                                            |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Displayed articles unchanged                                    | No site/container build, push, new digest, Git tag, or GitHub release             |
| Displayed articles changed                                      | Build the same released code with the new snapshot; publish one new content image |
| Feed timeout, HTTP error, malformed XML, empty feed, unsafe URL | Fail visibly; preserve the existing image and aliases                             |
| Desired content image already exists                            | Reuse its digest and repair/promote aliases; no rebuild                           |
| Registry authentication or service error                        | Fail; never treat it as a missing image                                           |
| Image push succeeded but alias/metadata update failed           | Retry reuses the immutable image and repairs publication                          |

There are no visitors' browser feed requests. Local builds may use the committed fallback; release publishing never silently falls back. Container builds use the prepared snapshot without a second network fetch, keeping the hash and rendered content consistent.

## Image references

For release `v0.1.0`, source commit `COMMIT`, and normalized content SHA-256 `HASH`:

| Reference               | Meaning                                                             |
| ----------------------- | ------------------------------------------------------------------- |
| `:v0.1.0`               | Mutable alias: latest article snapshot for this code release        |
| `:latest`               | Mutable alias for the newest stable release and its latest articles |
| `:v0.1.0-blog-HASH`     | Immutable code-version + article-content image                      |
| `:sha-COMMIT-blog-HASH` | Immutable full source SHA + article-content alias                   |
| `@sha256:DIGEST`        | Exact OCI image index, recommended for deployment/rollback          |

The version alias is intentionally mutable to meet the daily-refresh requirement. A bare source SHA is not a complete image identity because external article content can change independently. Git tags never move. Immutable content tags are reused, not overwritten. All tags use the same image digest; tagging an existing image is not a rebuild.

OCI labels include source repository, release URL, version, full source SHA, description, and `io.harish.portfolio.blog-sha256`. Build attestations record build provenance and package inventory. The release assets `image.json` and `blog.json` record the latest published digest and exact article snapshot. Older content snapshots remain available through their immutable images. Keep immutable tags/digests used by deployments or rollback; no automatic deletion is configured.

Unchanged articles intentionally do not pull fresh base images. Dependency/base-image updates should use a reviewed patch PR; otherwise a routine daily build would defeat the no-change requirement.

## Hosting and rollout

GHCR publishing does not deploy the website. Configure your existing GitOps/image updater to detect changes to the version alias's **digest** and update the workload to the new digest. `imagePullPolicy: Always` only checks on pod startup. A running pod is not restarted when a registry tag changes. Roll back using a previous immutable tag or digest, not the mutable version alias.

## First PR acceptance test

- The PR should carry `minor`; validation includes feed normalization/failure cases, SemVer increments, queued-merge reconciliation, image skip/reuse/build decisions, and Docker HTTP routing.
- GitHub Actions write paths do not execute in PR checks. The first real release and GHCR publish require merging this PR to main; no release is created just by opening it.
- After merge, verify `v0.1.0`, its generated release notes, `image.json` / `blog.json`, and the GHCR immutable/version/SHA-content tags.
- Manually dispatch `Release and refresh` again with an unchanged feed. Expect **Nothing changed**, no Docker build/push, and the same digest.
- After the next new blog post, dispatch again (or wait for the schedule). Expect the same Git tag/release, a new content image, and the version alias pointing at it.

## Public repository configuration

After making the repository public, require `release-label` and `validate` on `main`, require a pull request before merging, and block force pushes and branch deletion. Tag protection must prevent moving/deleting `v*` tags while still allowing the release workflow to create them.

Fork PRs run validation with read-only permissions and no publishing credentials. Release reconciliation dry-runs are restricted to branches in this repository; untrusted forks still run unit tests, the static build, and container checks. Keep GitHub's approval requirement for external contributors' workflows enabled. Checkout does not persist credentials in Git configuration.

Repository visibility and GHCR package visibility are separate settings. If anonymous image pulls are wanted, set the package to public after its first publication and verify an unauthenticated pull. Otherwise, keep registry pull credentials on the deployment.

Making a repository public also exposes its reachable commit history and Actions logs. Removing a file in a new commit does not remove old versions. Review those before changing visibility; this workflow does not rewrite history or change visibility automatically.
