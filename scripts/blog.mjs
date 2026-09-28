import { XMLParser } from "fast-xml-parser";
import { SyntaxValidator } from "fast-xml-validator";
import { createHash } from "node:crypto";
import { readFile, writeFile, appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const FEED = "https://harish2k01.in/rss/";
export const SNAPSHOT = "src/data/blog.json";
const LIMIT = 2 * 1024 * 1024;

export function normalizeArticles(items) {
  const seen = new Set();
  const articles = items
    .map((item) => {
      if (typeof item.title !== "string" || typeof item.url !== "string")
        throw new Error("Invalid article title or URL");
      const title = item.title
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim();
      const url = new URL(item.url);
      if (
        url.origin !== "https://harish2k01.in" ||
        url.username ||
        url.password
      )
        throw new Error("Article URL must belong to Tech Bytes over HTTPS");
      url.hash = "";
      // Tracking query strings do not affect what the portfolio displays.
      url.search = "";
      const date = new Date(item.published ?? item.date);
      if (!title || title.length > 300 || !Number.isFinite(date.getTime()))
        throw new Error("Invalid article title or date");
      return {
        title,
        url: url.href,
        date: date.toISOString().slice(0, 10),
        published: date.toISOString(),
      };
    })
    .sort(
      (a, b) =>
        b.published.localeCompare(a.published) || a.url.localeCompare(b.url),
    );
  const selected = articles
    .filter(({ url }) => {
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    })
    .slice(0, 3);
  if (selected.length !== 3)
    throw new Error("Expected at least three valid articles");
  return { schema: 1, articles: selected };
}

export function parseFeed(xml) {
  if (Buffer.byteLength(xml) > LIMIT || /<!\s*(DOCTYPE|ENTITY)/i.test(xml))
    throw new Error("Feed is oversized or contains unsupported declarations");
  if (SyntaxValidator.validate(xml) !== true)
    throw new Error("Malformed RSS XML");
  const parsed = new XMLParser({
    parseTagValue: false,
    trimValues: true,
  }).parse(xml);
  const items = parsed.rss?.channel?.item;
  if (!Array.isArray(items)) throw new Error("RSS feed has no article list");
  return normalizeArticles(
    items.map((item) => ({
      title: item.title,
      url: item.link,
      date: item.pubDate,
    })),
  );
}

export function contentHash(snapshot) {
  const visible = normalizeArticles(snapshot.articles).articles.map(
    ({ title, url, date }) => ({ title, url, date }),
  );
  return createHash("sha256")
    .update(JSON.stringify({ schema: 1, articles: visible }))
    .digest("hex");
}

export async function fetchFeed(fetcher = fetch) {
  const response = await fetcher(FEED, {
    signal: AbortSignal.timeout(15_000),
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml",
      "User-Agent": "HarishPortfolio/1.0",
    },
    redirect: "error",
  });
  if (!response.ok) throw new Error(`RSS request failed: ${response.status}`);
  let size = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > LIMIT) throw new Error("RSS feed exceeds size limit");
    chunks.push(chunk);
  }
  return parseFeed(Buffer.concat(chunks).toString("utf8"));
}

export async function refresh({
  strict = false,
  offline = false,
  file = SNAPSHOT,
  fetcher = fetch,
} = {}) {
  let snapshot;
  if (offline)
    snapshot = normalizeArticles(
      JSON.parse(await readFile(file, "utf8")).articles,
    );
  else {
    try {
      snapshot = await fetchFeed(fetcher);
    } catch (error) {
      if (strict) throw error;
      console.warn(
        `RSS unavailable; using checked-in article snapshot. ${error.message}`,
      );
      snapshot = normalizeArticles(
        JSON.parse(await readFile(file, "utf8")).articles,
      );
    }
  }
  await writeFile(file, JSON.stringify(snapshot, null, 2) + "\n");
  return { snapshot, hash: contentHash(snapshot) };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const { hash } = await refresh({
    strict: process.argv.includes("--strict"),
    offline: process.env.BLOG_MODE === "snapshot",
  });
  console.log(`Latest three articles: ${hash}`);
  if (process.env.GITHUB_OUTPUT)
    await appendFile(process.env.GITHUB_OUTPUT, `hash=${hash}\n`);
}
