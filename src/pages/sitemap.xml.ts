import type { APIRoute } from "astro";
import { projects } from "../data/projects";
export const GET: APIRoute = ({ site }) => {
  const routes = [
    "/",
    "/projects/",
    ...projects.map((project) => `/projects/${project.slug}/`),
  ];
  const escape = (s: string) =>
    s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map((route) => `<url><loc>${escape(new URL(route, site).href)}</loc></url>`).join("")}</urlset>`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } },
  );
};
