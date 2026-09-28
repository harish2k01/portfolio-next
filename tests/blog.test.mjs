import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  normalizeArticles,
  parseFeed,
  contentHash,
  refresh,
  fetchFeed,
} from "../scripts/blog.mjs";

const items = [1, 2, 3, 4].map((i) => ({
  title: `Article ${i}`,
  url: `https://harish2k01.in/post-${i}/`,
  date: `2026-09-${20 + i}`,
}));
const xml = (entries = items, meta = "") =>
  `<rss><channel>${meta}${entries.map((a) => `<item><title><![CDATA[${a.title}]]></title><link>${a.url}</link><pubDate>${a.date}</pubDate></item>`).join("")}</channel></rss>`;

test("latest three articles are deterministic and ignore feed-level timestamps", () => {
  const first = parseFeed(xml());
  assert.deepEqual(
    first.articles.map((a) => a.title),
    ["Article 4", "Article 3", "Article 2"],
  );
  assert.equal(
    contentHash(first),
    contentHash(
      parseFeed(
        xml([...items].reverse(), "<lastBuildDate>later</lastBuildDate>"),
      ),
    ),
  );
  assert.equal(
    contentHash(first),
    contentHash(normalizeArticles([...items, items[3]])),
  );
});
test("visible edits/new posts change the hash; older edits and tracking parameters do not", () => {
  const before = contentHash(normalizeArticles(items));
  for (const field of ["title", "url", "date"]) {
    const next = structuredClone(items);
    next[3][field] = {
      title: "Edited title",
      url: "https://harish2k01.in/renamed/",
      date: "2026-09-25",
    }[field];
    assert.notEqual(before, contentHash(normalizeArticles(next)));
  }
  const older = structuredClone(items);
  older[0].title = "Old edit";
  assert.equal(before, contentHash(normalizeArticles(older)));
  const tracked = items.map((a) => ({
    ...a,
    url: a.url + "?utm_source=rss#section",
  }));
  assert.equal(before, contentHash(normalizeArticles(tracked)));
});
test("malformed, unsafe, empty and oversized feeds fail closed", () => {
  for (const bad of [
    "not xml",
    "<rss></rss>",
    '<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss/>',
    "x".repeat(2_100_000),
  ])
    assert.throws(() => parseFeed(bad));
  for (const url of [
    "javascript:alert(1)",
    "https://other.example/",
    "http://harish2k01.in/post/",
    "https://user:pass@harish2k01.in/",
  ])
    assert.throws(() =>
      normalizeArticles([{ ...items[0], url }, ...items.slice(1)]),
    );
  assert.throws(() =>
    normalizeArticles([{ ...items[0], date: "invalid" }, ...items.slice(1)]),
  );
  assert.throws(() => normalizeArticles(items.slice(0, 2)));
});
test("strict fetch failure preserves the saved snapshot; local builds use fallback", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "portfolio-feed-"));
  const file = path.join(dir, "blog.json");
  const saved = JSON.stringify(normalizeArticles(items));
  await writeFile(file, saved);
  const fetcher = async () => {
    throw new Error("offline");
  };
  try {
    await assert.rejects(refresh({ strict: true, file, fetcher }), /offline/);
    assert.equal(await readFile(file, "utf8"), saved);
    const result = await refresh({ file, fetcher });
    assert.equal(result.hash, contentHash(normalizeArticles(items)));
    await refresh({
      file,
      offline: true,
      fetcher: () => {
        throw new Error("must not fetch");
      },
    });
  } finally {
    await rm(dir, { recursive: true });
  }
});
test("HTTP errors do not turn into an empty article list", async () => {
  await assert.rejects(
    fetchFeed(async () => new Response("Unavailable", { status: 503 })),
    /503/,
  );
});

test("trusted origin fetch keeps public article URLs and refuses a blocked feed", async () => {
  const endpoint = "http://ghost.ghost.svc.cluster.local:2368/rss/";
  const xml =
    "<rss><channel>" +
    items
      .map(
        (item) =>
          `<item><title>${item.title}</title><link>${item.url}</link><pubDate>${item.date}</pubDate></item>`,
      )
      .join("") +
    "</channel></rss>";
  const snapshot = await fetchFeed(async (url, options) => {
    assert.equal(url, endpoint);
    assert.equal(options.redirect, "error");
    assert.equal(options.headers.Host, "harish2k01.in");
    assert.equal(options.headers["X-Forwarded-Proto"], "https");
    return new Response(xml);
  }, endpoint);
  assert.equal(contentHash(snapshot), contentHash(normalizeArticles(items)));
  await assert.rejects(
    fetchFeed(async () => new Response("Forbidden", { status: 403 })),
    /403.*in-cluster/,
  );
  for (const bad of [
    "file:///etc/passwd",
    "https://user:pass@harish2k01.in/rss/",
  ])
    await assert.rejects(
      fetchFeed(() => {
        throw new Error("must not fetch");
      }, bad),
      /HTTP\(S\)/,
    );
});

test("same-day articles use publication time; invisible timestamp edits do not rebuild", () => {
  const sameDay = items.map((a, i) => ({
    ...a,
    date: `2026-09-28T0${i + 1}:00:00Z`,
  }));
  const snapshot = normalizeArticles(sameDay);
  assert.deepEqual(
    snapshot.articles.map((a) => a.title),
    ["Article 4", "Article 3", "Article 2"],
  );
  assert.deepEqual(normalizeArticles(snapshot.articles), snapshot);
  const changedTime = structuredClone(snapshot);
  changedTime.articles[0].published = "2026-09-28T04:30:00Z";
  assert.equal(contentHash(snapshot), contentHash(changedTime));
  changedTime.articles[0].published = "2026-09-28T02:30:00Z";
  assert.notEqual(contentHash(snapshot), contentHash(changedTime));
});
