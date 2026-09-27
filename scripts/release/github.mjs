export async function github(route, { method = "GET", body } = {}) {
  const response = await fetch(
    `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/${route}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${process.env.GH_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok)
    throw new Error(`GitHub ${method} ${route}: HTTP ${response.status}`);
  return response.status === 204 ? null : response.json();
}
export async function allPages(route) {
  const result = [];
  for (let page = 1; ; page++) {
    const batch = await github(
      `${route}${route.includes("?") ? "&" : "?"}per_page=100&page=${page}`,
    );
    result.push(...batch);
    if (batch.length < 100) return result;
  }
}
