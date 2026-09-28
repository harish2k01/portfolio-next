import { readFile } from "node:fs/promises";
import { uploadReleaseAssets } from "./github.mjs";

await uploadReleaseAssets(process.env.RELEASE_TAG, [
  { name: "image.json", data: await readFile("image.json") },
  {
    name: "blog.json",
    data: await readFile("src/data/blog.json"),
  },
]);
