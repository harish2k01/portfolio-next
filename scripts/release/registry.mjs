import { appendFile, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { contentHash } from "../blog.mjs";
import { VERSION } from "./version.mjs";
import { github } from "./github.mjs";
import { execFileSync } from "node:child_process";

const ACCEPT =
  "application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json";
export function imagePlan({ tag, sha, hash, current, immutable }) {
  if (
    !VERSION.test(tag) ||
    !/^[a-f0-9]{40}$/.test(sha) ||
    !/^[a-f0-9]{64}$/.test(hash)
  )
    throw new Error("Invalid image identity");
  if (
    current?.labels?.["org.opencontainers.image.revision"] === sha &&
    current.labels["io.harish.portfolio.blog-sha256"] === hash
  )
    return { action: "skip", digest: current.digest };
  if (immutable) {
    if (
      immutable.labels["org.opencontainers.image.revision"] !== sha ||
      immutable.labels["io.harish.portfolio.blog-sha256"] !== hash
    )
      throw new Error("Immutable image tag collision; refusing to overwrite");
    return { action: "reuse", digest: immutable.digest };
  }
  return { action: "build" };
}

export async function registryClient(
  repository,
  token,
  username,
  fetcher = fetch,
) {
  if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/.test(repository))
    throw new Error("Invalid registry repository");
  const auth = await fetcher(
    `https://ghcr.io/token?service=ghcr.io&scope=repository:${repository}:pull`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${username}:${token}`).toString("base64")}`,
      },
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!auth.ok) throw new Error(`GHCR authentication failed: ${auth.status}`);
  const bearer = (await auth.json()).token;
  if (!bearer) throw new Error("GHCR did not return a registry token");
  async function request(path, allowMissing = false) {
    const response = await fetcher(`https://ghcr.io/v2/${repository}/${path}`, {
      headers: { Authorization: `Bearer ${bearer}`, Accept: ACCEPT },
      signal: AbortSignal.timeout(20_000),
    });
    if (response.status === 404 && allowMissing) return null;
    if (!response.ok)
      throw new Error(`GHCR inspection failed: ${response.status}`);
    return {
      body: await response.json(),
      digest: response.headers.get("docker-content-digest"),
    };
  }
  return async function inspect(tag) {
    if (!/^[a-zA-Z0-9_.:-]+$/.test(tag))
      throw new Error("Invalid image reference");
    const manifest = await request(`manifests/${tag}`, true);
    if (!manifest) return null;
    let body = manifest.body;
    if (body.manifests) {
      const platform = body.manifests.find(
        (m) =>
          m.platform?.os === "linux" && m.platform?.architecture === "amd64",
      );
      if (!platform) throw new Error("Image has no linux/amd64 manifest");
      body = (await request(`manifests/${platform.digest}`)).body;
    }
    if (!body.config?.digest || !/^sha256:[a-f0-9]{64}$/.test(manifest.digest))
      throw new Error("Invalid registry image metadata");
    const config = await request(`blobs/${body.config.digest}`);
    return {
      digest: manifest.digest,
      labels: config.body.config?.Labels || {},
    };
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const tag = process.env.RELEASE_TAG,
    sha = process.env.RELEASE_SHA;
  const hash = contentHash(
    JSON.parse(await readFile("src/data/blog.json", "utf8")),
  );
  const repository = process.env.GITHUB_REPOSITORY.toLowerCase();
  const image = `ghcr.io/${repository}`;
  const immutableTag = `${tag}-blog-${hash}`;
  const inspect = await registryClient(
    repository,
    process.env.GH_TOKEN,
    process.env.GITHUB_ACTOR,
  );
  const current = await inspect(tag),
    immutable = await inspect(immutableTag);
  const plan = imagePlan({ tag, sha, hash, current, immutable });
  // Repair interrupted promotion/metadata uploads without rebuilding the image.
  if (plan.action === "skip") {
    const release = await github(`releases/tags/${tag}`);
    const asset = release.assets.find((a) => a.name === "image.json");
    const metadata = asset
      ? JSON.parse(
          execFileSync(
            "gh",
            [
              "release",
              "download",
              tag,
              "--repo",
              process.env.GITHUB_REPOSITORY,
              "--pattern",
              "image.json",
              "--output",
              "-",
            ],
            { encoding: "utf8" },
          ),
        )
      : null;
    if (
      metadata?.digest !== current.digest ||
      metadata?.blogSha256 !== hash ||
      metadata?.revision !== sha
    )
      plan.action = "reuse";
  }
  const result = {
    ...plan,
    image,
    tag,
    sha,
    hash,
    immutable: immutableTag,
    shaTag: `sha-${sha}-blog-${hash}`,
  };
  await writeFile("image-plan.json", JSON.stringify(result, null, 2));
  if (process.env.GITHUB_OUTPUT)
    for (const [key, value] of Object.entries(result))
      await appendFile(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  console.log(
    `${plan.action}: ${image}:${tag} (articles ${hash.slice(0, 12)})`,
  );
}
