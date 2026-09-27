import { readFile, writeFile, appendFile } from "node:fs/promises";
import { allPages } from "./github.mjs";
import { registryClient } from "./registry.mjs";
import { VERSION, compareVersions } from "./version.mjs";
const plan = JSON.parse(await readFile("image-plan.json", "utf8"));
const inspect = await registryClient(
  process.env.GITHUB_REPOSITORY.toLowerCase(),
  process.env.GH_TOKEN,
  process.env.GITHUB_ACTOR,
);
const built = await inspect(plan.immutable);
if (
  !built ||
  built.labels["org.opencontainers.image.revision"] !== plan.sha ||
  built.labels["io.harish.portfolio.blog-sha256"] !== plan.hash
)
  throw new Error("Published image identity mismatch");
const releases = (await allPages("releases")).filter(
  (r) => !r.draft && !r.prerelease && VERSION.test(r.tag_name),
);
releases.sort((a, b) => compareVersions(a.tag_name, b.tag_name));
const latest = releases.at(-1)?.tag_name === plan.tag;
await writeFile(
  "image.json",
  JSON.stringify(
    {
      version: plan.tag,
      revision: plan.sha,
      blogSha256: plan.hash,
      image: plan.image,
      digest: built.digest,
      immutableTag: plan.immutable,
      shaTag: plan.shaTag,
    },
    null,
    2,
  ) + "\n",
);
if (process.env.GITHUB_OUTPUT)
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `digest=${built.digest}\nlatest=${latest}\n`,
  );
