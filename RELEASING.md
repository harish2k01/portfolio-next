# Releases, image identity, and article refreshes

## Code releases

1. Work on a side branch and open a PR to `main`.
2. Add exactly one label: `major`, `minor`, or `patch`. Other labels are allowed. The label check reruns when labels change.
3. Review `release-label` and `validate` checks before merging. Prefer squash merges (merge commits and rebase merges are also recognized through the GitHub merge SHA).
4. `Release and refresh` validates the code, creates a lightweight Git tag and a published GitHub release at the PR merge SHA, and calls the publisher directly. No PAT is required.
5. A trusted main-branch job fetches RSS strictly from Ghost inside the cluster and passes the validated snapshot as an artifact. The publisher checks out the exact release SHA, verifies the tag and ancestry, tests the production container, and publishes linux/amd64 and linux/arm64 images with provenance and SBOM attestations.

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

The version alias tracks the latest article snapshot for that release. A bare source SHA is not a complete image identity because external article content can change independently. Git tags never move. Immutable content tags are reused, not overwritten. Aliases for the same content image share its digest; tagging an existing image is not a rebuild.

OCI labels include source repository, release URL, version, full source SHA, description, and `io.harish.portfolio.blog-sha256`. Build attestations record build provenance and package inventory. The release assets `image.json` and `blog.json` record the latest published digest and exact article snapshot. Older content snapshots remain available through their immutable images. Keep immutable tags/digests used by deployments or rollback; no automatic deletion is configured.

Unchanged articles do not pull fresh base images. Dependency and base-image updates use reviewed PRs so they can be validated and released independently of article refreshes.

## Hosting and rollout

After publication, the latest stable release calls the `homelab-ops` version updater with the verified tag and digest. Argo CD deploys the committed digest. This updater also runs after an unchanged-image check to recover a prior failed GitOps update; identical values produce no commit or rollout. Older releases never update the live deployment. See [DEPLOYMENT.md](DEPLOYMENT.md) for workflow configuration and required App secrets. Roll back using a previous digest, not the mutable version alias.

## Release verification

- PR validation covers feed normalization and failures, SemVer increments, queued-merge reconciliation, image skip/reuse/build decisions, and Docker HTTP routing. PR checks do not publish images or create releases.
- After a merge, verify the new semantic version, generated release notes, `image.json` / `blog.json`, and GHCR immutable/version/SHA-content tags.
- Manually dispatch `Release and refresh` again with an unchanged feed. Expect **Nothing changed**, no Docker build/push, and the same digest.
- After the next new blog post, dispatch again (or wait for the schedule). Expect the same Git tag/release, a new content image, and the version alias pointing at it.

## Repository configuration

Recommended branch protection requires `release-label` and `validate` on pull requests to `main`, requires a pull request before merging, and blocks force pushes and branch deletion. Tag protection should prevent moving/deleting `v*` tags while allowing the release workflow to create them. These settings are managed in GitHub, separately from the checked-in workflows.

All jobs use the dedicated ARC runner. PR validation only runs for same-repository branches, with read-only permissions and no publishing credentials. External fork jobs are skipped; reviewed contributions can be imported into a maintainer branch. Keep approval for **all external contributors** enabled and review workflow changes before approving a run, since a fork can propose its own runner selection. Checkout in this repository does not persist credentials in Git configuration.

Repository visibility and GHCR package visibility are separate settings. Public packages support anonymous image pulls; private packages require registry pull credentials on the deployment.
