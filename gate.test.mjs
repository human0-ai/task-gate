import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTaskLink, buildGateUrl, isAppAuthor } from "./gate.mjs";

const UUID = "1f2e3d4c-5b6a-7980-1234-567890abcdef";

test("parseTaskLink reads a labelled Task: line", () => {
  const body = `Implements the thing.\n\nTask: https://dashboard.human0.ai/tasks/${UUID}\n`;
  assert.equal(parseTaskLink(body), UUID);
});

test("parseTaskLink is case-insensitive on the label and uuid", () => {
  const body = `task:  https://dashboard.human0.ai/tasks/${UUID.toUpperCase()}`;
  assert.equal(parseTaskLink(body), UUID);
});

test("parseTaskLink ignores tasks URLs not on a Task: line", () => {
  const body = `See https://dashboard.human0.ai/tasks/${UUID} for context.`;
  assert.equal(parseTaskLink(body), null);
});

test("parseTaskLink returns the labelled task, not an unlabelled one above it", () => {
  const other = "00000000-0000-0000-0000-000000000000";
  const body = `Related: https://dashboard.human0.ai/tasks/${other}\nTask: https://dashboard.human0.ai/tasks/${UUID}`;
  assert.equal(parseTaskLink(body), UUID);
});

test("parseTaskLink returns null for missing or empty body", () => {
  assert.equal(parseTaskLink(""), null);
  assert.equal(parseTaskLink(null), null);
  assert.equal(parseTaskLink("No task here."), null);
});

test("buildGateUrl encodes the PR url as a query param", () => {
  const url = buildGateUrl("https://app.human0.ai", UUID, "https://github.com/o/r/pull/7");
  const parsed = new URL(url);
  assert.equal(parsed.pathname, "/api/integrations/task-gate");
  assert.equal(parsed.searchParams.get("taskId"), UUID);
  assert.equal(parsed.searchParams.get("pr"), "https://github.com/o/r/pull/7");
});

test("buildGateUrl trims a trailing slash on the base", () => {
  const url = buildGateUrl("https://app.human0.ai/", UUID, "https://github.com/o/r/pull/7");
  assert.ok(url.startsWith("https://app.human0.ai/api/integrations/task-gate?"));
});

test("isAppAuthor matches with or without the [bot] suffix", () => {
  assert.ok(isAppAuthor("human0-ai[bot]", "human0-ai"));
  assert.ok(isAppAuthor("human0-ai", "human0-ai[bot]"));
  assert.ok(isAppAuthor("Human0-AI[bot]", "human0-ai"));
});

test("isAppAuthor rejects a different login and empty inputs", () => {
  assert.ok(!isAppAuthor("octocat", "human0-ai"));
  assert.ok(!isAppAuthor("", "human0-ai"));
  assert.ok(!isAppAuthor("human0-ai", ""));
});
