import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("dist");
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? walk(path.join(dir, entry.name))
          : path.join(dir, entry.name),
      ),
    )
  ).flat();
}
const files = await walk(root);
const pages = await Promise.all(
  files
    .filter((file) => file.endsWith(".html"))
    .map(async (file) => ({ file, html: await readFile(file, "utf8") })),
);
const attrs = (html, name) =>
  [...html.matchAll(new RegExp(`\\s${name}="([^"]*)"`, "g"))].map(
    (match) => match[1],
  );

test("all generated pages have document metadata and one primary heading", () => {
  assert.equal(pages.length, 7, "home, archive, four project stories, and 404");
  for (const { file, html } of pages) {
    assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, file);
    assert.match(html, /<html lang="en"/, file);
    assert.match(html, /<title>[^<]+<\/title>/, file);
    assert.match(html, /<meta name="description" content="[^"]+"/, file);
    assert.match(html, /<link rel="canonical" href="https?:\/\//, file);
    const ids = attrs(html, "id");
    assert.equal(new Set(ids).size, ids.length, `Duplicate IDs: ${file}`);
  }
});

test("internal routes, anchors and local assets resolve", async () => {
  for (const { file, html } of pages) {
    const route = path
      .relative(root, file)
      .replaceAll(path.sep, "/")
      .replace(/index\.html$/, "");
    const base = new URL(route, "https://portfolio.test/");
    for (const value of [...attrs(html, "href"), ...attrs(html, "src")]) {
      if (!value || /^(https?:|mailto:|data:)/.test(value)) continue;
      const url = new URL(value, base);
      const relative = decodeURIComponent(url.pathname).replace(/^\//, "");
      let target = path.join(root, relative);
      if (url.pathname.endsWith("/")) target = path.join(target, "index.html");
      assert.ok(
        (await stat(target).catch(() => null))?.isFile(),
        `Missing ${value} in ${file}`,
      );
      if (url.hash) {
        const content = await readFile(target, "utf8");
        assert.ok(
          attrs(content, "id").includes(decodeURIComponent(url.hash.slice(1))),
          `Missing anchor ${value} in ${file}`,
        );
      }
    }
  }
});

test("the static site stays small and does not hydrate a framework", async () => {
  const scripts = files.filter((file) => file.endsWith(".js"));
  const bytes = (
    await Promise.all(scripts.map(async (file) => (await stat(file)).size))
  ).reduce((a, b) => a + b, 0);
  for (const { html } of pages) {
    const inlineBytes = [
      ...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g),
    ].reduce((total, match) => total + Buffer.byteLength(match[1]), 0);
    assert.ok(
      bytes + inlineBytes < 30_000,
      `JavaScript exceeds 30 kB budget: ${bytes + inlineBytes}`,
    );
    assert.ok(
      !html.includes("<astro-island"),
      "Unexpected client framework hydration",
    );
    const externalScripts = [
      ...html.matchAll(/<script\b[^>]*\bsrc="https?:[^>]*>/g),
    ].map((match) => match[0]);
    assert.equal(
      externalScripts.length,
      1,
      "Only the approved Umami tracker should be external",
    );
    const tracker = externalScripts[0];
    assert.equal(
      attrs(tracker, "src")[0],
      "https://umami.harish2k01.xyz/script.js",
    );
    assert.equal(
      attrs(tracker, "data-website-id")[0],
      "674d53a6-4ee7-4806-add2-b53dd17d2f6c",
    );
    assert.equal(
      attrs(tracker, "data-domains")[0],
      "harish2k01.xyz",
      "Local previews must not send pageviews",
    );
    assert.match(tracker, /\sdefer(?:\s|>|=)/);
    assert.ok(
      html.indexOf(tracker) < html.indexOf("</head>"),
      "Tracker belongs in the shared document head",
    );
  }
});

test("all existing portfolio projects and career milestones remain discoverable", () => {
  const all = pages.map((page) => page.html).join(" ");
  for (const text of [
    "Tic Tac Toe",
    "Smart Switch",
    "Hospital Management System",
    "Portfolio Platform",
    "NielsenIQ",
    "Workhall",
    "Vuram",
    "Vikaasa",
    "01 Jul",
    "2022",
  ]) {
    // July internship is described in prose rather than as a separate role.
    if (text === "01 Jul") {
      assert.ok(all.includes("July 2022"));
      continue;
    }
    assert.ok(all.includes(text), `Missing source content: ${text}`);
  }
});

test("robots and sitemap use the same deployment origin", async () => {
  const robots = await readFile(path.join(root, "robots.txt"), "utf8");
  const sitemap = await readFile(path.join(root, "sitemap.xml"), "utf8");
  const origin = process.env.SITE_URL || "https://harish2k01.xyz";
  assert.ok(robots.includes(new URL("/sitemap.xml", origin).href));
  assert.equal((sitemap.match(/<loc>/g) || []).length, 6);
  assert.ok(!sitemap.includes("/404"));
});
