import assert from "node:assert/strict";
import test from "node:test";
import { DATASET_ID, DEFAULT_STATE } from "../src/lib/data";
import { handbookDatasetId, sanitizeHandbookState, type HandbookState } from "../src/lib/handbooks";
import { sanitizeState } from "../src/lib/rules";

test("cloud reads and writes target the selected dataset and preserve revision checks", async t => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://planner.example.test";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";
  t.after(() => {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
  });

  const { authEmailRedirectTo, getCloudClient, readCloudPlan, releaseCloudClient, writeCloudPlan } = await import("../src/lib/cloud");
  assert.equal(authEmailRedirectTo(new URL("https://s3hu.github.io/planner/?q=1#fragment")), "https://s3hu.github.io/planner/");
  assert.equal(authEmailRedirectTo(new URL("https://planner.example.test/")), "https://planner.example.test/");

  const profile = { ...DEFAULT_STATE.profile, admissionYear: 2026 };
  const datasetId = handbookDatasetId(profile)!;
  const handbook: HandbookState = { version: 1, datasetId, profile, completed: [], planned: [], campus: "all" };
  const userId = "account-id";
  const calls: { url: URL; method: string; body: unknown }[] = [];
  let reply: unknown;
  const fetch = t.mock.method(globalThis, "fetch", async (input: URL | string, init: RequestInit) => {
    const url = new URL(input);
    assert.equal(url.pathname, "/rest/v1/course_plans");
    calls.push({ url, method: init.method!, body: init.body ? JSON.parse(String(init.body)) : null });
    return Response.json(reply);
  });

  reply = [{ state: DEFAULT_STATE, revision: 5 }];
  const savedStandard = await readCloudPlan(userId, DATASET_ID, sanitizeState);
  assert.deepEqual(savedStandard, { state: DEFAULT_STATE, revision: 5 });

  reply = [];
  assert.equal(await readCloudPlan(userId, datasetId, sanitizeHandbookState), null);

  reply = { revision: 1 };
  assert.equal(await writeCloudPlan(userId, datasetId, sanitizeHandbookState, handbook, null), 1);

  reply = [{ state: handbook, revision: 1 }];
  assert.deepEqual(await readCloudPlan(userId, datasetId, sanitizeHandbookState), { state: handbook, revision: 1 });

  reply = [{ revision: 2 }];
  const edited: HandbookState = { ...handbook, profile: { ...profile, term: "前期" } };
  assert.equal(await writeCloudPlan(userId, datasetId, sanitizeHandbookState, edited, 1), 2);

  reply = [];
  await assert.rejects(writeCloudPlan(userId, datasetId, sanitizeHandbookState, edited, 1), /別の端末でプランが更新/);

  reply = [{ state: handbook, revision: 2 }];
  const anotherDataset = handbookDatasetId({ ...profile, admissionYear: 2024 })!;
  await assert.rejects(readCloudPlan(userId, anotherDataset, sanitizeHandbookState), /保存したプランの形式が異なります/);
  await assert.rejects(writeCloudPlan(userId, anotherDataset, sanitizeHandbookState, handbook, null), /保存するプランの形式/);

  reply = [{ revision: 6 }];
  assert.equal(await writeCloudPlan(userId, DATASET_ID, sanitizeState, savedStandard!.state, 5), 6);

  assert.deepEqual(calls.map(({ url, method, body }) => ({
    method, body, user: url.searchParams.get("user_id"), dataset: url.searchParams.get("dataset_id"),
    revision: url.searchParams.get("revision"),
  })), [
    { method: "GET", body: null, user: "eq.account-id", dataset: "eq." + DATASET_ID, revision: null },
    { method: "GET", body: null, user: "eq.account-id", dataset: "eq." + datasetId, revision: null },
    { method: "POST", body: { user_id: userId, dataset_id: datasetId, state: handbook, revision: 1 }, user: null, dataset: null, revision: null },
    { method: "GET", body: null, user: "eq.account-id", dataset: "eq." + datasetId, revision: null },
    { method: "PATCH", body: { state: edited, revision: 2 }, user: "eq.account-id", dataset: "eq." + datasetId, revision: "eq.1" },
    { method: "PATCH", body: { state: edited, revision: 2 }, user: "eq.account-id", dataset: "eq." + datasetId, revision: "eq.1" },
    { method: "GET", body: null, user: "eq.account-id", dataset: "eq." + anotherDataset, revision: null },
    { method: "PATCH", body: { state: DEFAULT_STATE, revision: 6 }, user: "eq.account-id", dataset: "eq." + DATASET_ID, revision: "eq.5" },
  ]);
  const count = fetch.mock.callCount();
  const client = await getCloudClient();
  const dispose = t.mock.method(client.auth, "dispose");
  await releaseCloudClient();
  assert.equal(dispose.mock.callCount(), 1);
  await releaseCloudClient();
  assert.equal(dispose.mock.callCount(), 1);
  assert.equal(fetch.mock.callCount(), count);
});
