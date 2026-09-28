import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bumpLabel,
  nextVersion,
  compareVersions,
  planVersions,
} from "../scripts/release/version.mjs";
import { downloadReleaseAsset } from "../scripts/release/github.mjs";
import { imagePlan, registryClient } from "../scripts/release/registry.mjs";

test("exactly one version label is required", () => {
  assert.equal(
    bumpLabel([{ name: "enhancement" }, { name: "minor" }]),
    "minor",
  );
  for (const labels of [
    [],
    ["enhancement"],
    ["major", "patch"],
    ["minor", "patch"],
    ["Major"],
  ])
    assert.throws(() => bumpLabel(labels));
});
test("semantic version increments reset lower components and bootstrap correctly", () => {
  assert.equal(nextVersion("v0.0.0", "minor"), "v0.1.0");
  assert.equal(nextVersion("v1.9.9", "major"), "v2.0.0");
  assert.equal(nextVersion("v1.9.9", "minor"), "v1.10.0");
  assert.equal(nextVersion("v1.9.9", "patch"), "v1.9.10");
  assert.ok(compareVersions("v1.10.0", "v1.9.9") > 0);
  for (const tag of ["latest", "v01.0.0", "v1.2.3-rc.1"])
    assert.throws(() => nextVersion(tag, "patch"));
});
const identity = { tag: "v1.2.3", sha: "a".repeat(40), hash: "b".repeat(64) };
const published = {
  digest: `sha256:${"c".repeat(64)}`,
  labels: {
    "org.opencontainers.image.revision": identity.sha,
    "io.harish.portfolio.blog-sha256": identity.hash,
  },
};
test("unchanged content skips publishing; changed content builds once", () => {
  assert.equal(imagePlan({ ...identity, current: published }).action, "skip");
  assert.equal(
    imagePlan({ ...identity, hash: "d".repeat(64), current: published }).action,
    "build",
  );
  assert.equal(imagePlan({ ...identity }).action, "build");
});
test("retry or reverted articles reuse the immutable image without a new digest", () => {
  const plan = imagePlan({ ...identity, immutable: published });
  assert.equal(plan.action, "reuse");
  assert.equal(plan.digest, published.digest);
  assert.throws(
    () => imagePlan({ ...identity, sha: "e".repeat(40), immutable: published }),
    /collision/,
  );
});
test("GHCR authentication and network errors are never treated as missing images", async () => {
  await assert.rejects(
    registryClient(
      "owner/repo",
      "token",
      "owner",
      async () => new Response("", { status: 403 }),
    ),
    /authentication failed/,
  );
  let calls = 0;
  const inspect = await registryClient(
    "owner/repo",
    "token",
    "owner",
    async () =>
      ++calls === 1
        ? Response.json({ token: "registry-token" })
        : new Response("", { status: 500 }),
  );
  await assert.rejects(inspect("v1.0.0"), /inspection failed/);
});
test("a missing manifest is a first publication, with no existing state to mutate", async () => {
  let calls = 0;
  const inspect = await registryClient(
    "owner/repo",
    "token",
    "owner",
    async () =>
      ++calls === 1
        ? Response.json({ token: "registry-token" })
        : new Response("", { status: 404 }),
  );
  assert.equal(await inspect("v1.0.0"), null);
});
test("multi-platform OCI indexes resolve the application config, not an attestation", async () => {
  const digest = `sha256:${"1".repeat(64)}`;
  const responses = [
    Response.json({ token: "registry-token" }),
    Response.json(
      {
        manifests: [
          {
            platform: { os: "unknown", architecture: "unknown" },
            digest: "attestation",
          },
          { platform: { os: "linux", architecture: "amd64" }, digest },
        ],
      },
      { headers: { "docker-content-digest": digest } },
    ),
    Response.json({ config: { digest } }),
    Response.json({ config: { Labels: published.labels } }),
  ];
  const inspect = await registryClient(
    "owner/repo",
    "token",
    "owner",
    async () => responses.shift(),
  );
  assert.deepEqual(await inspect("v1.2.3"), {
    digest,
    labels: published.labels,
  });
});
test("release asset downloads use the GitHub REST asset endpoint", async () => {
  const calls = [];
  const assetData = Buffer.from('{"digest":"sha256:test"}');
  const download = await downloadReleaseAsset(
    "v1.2.3",
    "image.json",
    async (url, options) => {
      calls.push({ url, options });
      return calls.length === 1
        ? Response.json({
            assets: [
              {
                name: "image.json",
                url: "https://api.github.com/assets/42",
              },
            ],
          })
        : new Response(assetData);
    },
  );
  assert.deepEqual(download, assetData);
  assert.equal(calls[1].options.headers.Accept, "application/octet-stream");
});
const merged = (sha, number, labels) => ({
  sha,
  prs: [
    {
      number,
      merged_at: "2026-09-28",
      base: { ref: "main" },
      merge_commit_sha: sha,
      labels,
    },
  ],
});
test("queued merges each receive a release in order; reruns do not bump again", () => {
  const commits = [
    merged("a", 1, ["minor"]),
    merged("b", 2, ["patch"]),
    merged("c", 3, ["major"]),
  ];
  assert.deepEqual(
    planVersions("v0.0.0", commits).map((p) => p.tag),
    ["v0.1.0", "v0.1.1", "v1.0.0"],
  );
  assert.deepEqual(planVersions("v1.0.0", []), []);
  assert.equal(planVersions("v0.1.0", commits.slice(1))[0].tag, "v0.1.1");
});
test("unmerged PRs and direct commits do not release; a bad label rejects the batch", () => {
  assert.deepEqual(
    planVersions("v1.0.0", [
      { sha: "a", prs: [] },
      { sha: "b", prs: [{ merged_at: null }] },
    ]),
    [],
  );
  assert.throws(
    () =>
      planVersions("v1.0.0", [merged("a", 1, ["patch"]), merged("b", 2, [])]),
    /exactly one/,
  );
});
