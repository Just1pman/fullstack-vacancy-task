import assert from "node:assert/strict";
import { test } from "node:test";
import { createLoader, type LoaderState } from "./loader.js";
import type { User } from "./api.js";

const users: User[] = [{ id: 1, name: "Ada", email: "ada@example.com" }];

test("load emits loading then ready", async () => {
  const states: LoaderState[] = [];
  const loader = createLoader(async () => users, (state) => states.push(state));

  await loader.load("Ada");

  assert.deepEqual(states, [
    { kind: "loading" },
    { kind: "ready", name: "Ada", users },
  ]);
});

test("a new load aborts the previous one and ignores its late response", async () => {
  let resolveFirst!: (users: User[]) => void;
  const firstResponse = new Promise<User[]>((resolve) => {
    resolveFirst = resolve;
  });
  let firstSignal: AbortSignal | undefined;
  const states: LoaderState[] = [];
  const loader = createLoader((name, signal) => {
    if (name === "second") return Promise.resolve(users);
    firstSignal = signal;
    return firstResponse;
  }, (state) => states.push(state));

  const firstLoad = loader.load("first");
  const secondLoad = loader.load("second");
  assert.equal(firstSignal?.aborted, true);
  await secondLoad;
  resolveFirst([{ id: 2, name: "Late", email: "late@example.com" }]);
  await firstLoad;

  assert.deepEqual(states, [
    { kind: "loading" },
    { kind: "loading" },
    { kind: "ready", name: "second", users },
  ]);
});

test("load emits an error state for request failures", async () => {
  const error = new Error("Request failed");
  const states: LoaderState[] = [];
  const loader = createLoader(async () => {
    throw error;
  }, (state) => states.push(state));

  await loader.load("");

  assert.deepEqual(states, [{ kind: "loading" }, { kind: "error", error }]);
});

test("load ignores AbortError for the current request", async () => {
  const states: LoaderState[] = [];
  const loader = createLoader(async () => {
    throw new DOMException("Aborted", "AbortError");
  }, (state) => states.push(state));

  await loader.load("");

  assert.deepEqual(states, [{ kind: "loading" }]);
});
