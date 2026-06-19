import { execFileSync } from "child_process";
import { parseTaskLink, buildGateUrl, isAppAuthor } from "./gate.mjs";

const REPO = requireEnv("REPO");
const PR_NUMBER = requireEnv("PR_NUMBER");
const ENDPOINT_BASE = requireEnv("ENDPOINT_BASE");
const GATE_TOKEN = requireEnv("GATE_TOKEN");
const APP_LOGIN = requireEnv("APP_LOGIN");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is required`);
  return value;
}

// argv-style invocation — no shell, so PR fields can't be interpolated into a
// command line. GH_TOKEN in the env authenticates the call.
function gh(args) {
  return execFileSync("gh", args, { encoding: "utf-8" }).trim();
}

// `pass`/`fail` are the two outcomes GitHub sees: exit 0 lets the merge proceed,
// exit 1 keeps the required check red. Reasons print as workflow annotations so
// the verdict is legible in the PR's Checks tab.
function pass(message) {
  console.log(`✅ task-gate: ${message}`);
  process.exit(0);
}

function fail(message) {
  console.log(`::error::task-gate: ${message}`);
  process.exit(1);
}

const pr = JSON.parse(
  gh(["api", `repos/${REPO}/pulls/${PR_NUMBER}`, "--jq", "{author: .user.login, body: .body, url: .html_url}"]),
);

// Only the Human0 app's PRs are gated — a human opening a PR is out of scope, so
// the gate stays green and never blocks them.
if (!isAppAuthor(pr.author, APP_LOGIN)) {
  pass(`PR author "${pr.author || "?"}" is not the Human0 app (${APP_LOGIN}) — gate does not apply.`);
}

const taskId = parseTaskLink(pr.body);
if (!taskId) {
  fail(
    `app-authored PR must link its task — add a "Task: ${ENDPOINT_BASE.replace(/\/+$/, "")}/tasks/<id>" ` +
      "line to the PR description.",
  );
}

const gateUrl = buildGateUrl(ENDPOINT_BASE, taskId, pr.url);
console.log(`Checking task ${taskId} against ${ENDPOINT_BASE} …`);

let verdict;
try {
  const resp = await fetch(gateUrl, {
    headers: { authorization: `Bearer ${GATE_TOKEN}` },
  });
  // A non-2xx from the gate is a fault on our side, not a verdict — fail closed
  // so a broken endpoint can never silently wave a PR through.
  if (!resp.ok) {
    fail(`gate endpoint returned HTTP ${resp.status} — failing closed until it recovers.`);
  }
  verdict = await resp.json();
} catch (e) {
  fail(`could not reach the gate endpoint: ${e.message}`);
}

const status = verdict?.status;
const reason = verdict?.reason || "(no reason given)";
if (status === "approved") {
  pass(`task ${taskId} is independently approved.`);
} else if (status === "blocked") {
  fail(reason);
} else {
  fail(`unexpected gate response: ${JSON.stringify(verdict)}`);
}
