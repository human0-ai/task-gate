// Pure helpers for the task gate — no I/O, so they unit-test without a runner,
// the GitHub API, or the platform endpoint. run.mjs imports them back.

// A Human0 task id is a standard UUID. Agents attach their PR to the task and
// write the task link into the PR description so the two point at each other.
const TASK_URL = /\/tasks\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i;

// Pull the task id out of a `Task: <dashboard-url>/tasks/<uuid>` line in the PR
// body. We key off an explicit `Task:` label rather than the first tasks URL
// anywhere in the text, so a task referenced in prose (or a checklist link)
// can't be mistaken for the one this PR claims to implement. Returns the lower-
// cased uuid, or null when no labelled link is present.
export function parseTaskLink(body) {
  for (const line of (body || "").split(/\r?\n/)) {
    if (!/^\s*Task\s*:/i.test(line)) continue;
    const m = line.match(TASK_URL);
    if (m) return m[1].toLowerCase();
  }
  return null;
}

// Build the gate-status URL. The PR URL is carried as a query param and must be
// encoded — URL/URLSearchParams handles that and rejects a malformed base.
export function buildGateUrl(endpointBase, taskId, prUrl) {
  const base = (endpointBase || "").replace(/\/+$/, "");
  const url = new URL(`${base}/api/integrations/task-gate`);
  url.searchParams.set("taskId", taskId);
  url.searchParams.set("pr", prUrl);
  return url.toString();
}

// The PR author is the GitHub App only when the login matches the configured
// bot login. GitHub appends `[bot]` to app logins, so accept the bare app slug
// too rather than forcing the caller to know which form GitHub will send.
export function isAppAuthor(login, appLogin) {
  if (!login || !appLogin) return false;
  const norm = (s) => s.toLowerCase().replace(/\[bot\]$/, "");
  return norm(login) === norm(appLogin);
}
