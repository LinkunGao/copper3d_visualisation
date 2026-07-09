import { test } from "node:test";
import assert from "node:assert/strict";
import { createPreRenderRegistry } from "./preRenderRegistry.ts";

const noop = () => {};

test("add returns a real id, and ids start at 0", () => {
  const r = createPreRenderRegistry();
  assert.equal(r.add(() => {}), 0);
  assert.equal(r.add(() => {}), 1);
  assert.equal(r.add(() => {}), 2);
});

test("ids keep increasing and are never reused after a removal", () => {
  const r = createPreRenderRegistry();
  const a = r.add(() => {});
  const b = r.add(() => {});
  r.remove(a);
  const c = r.add(() => {});
  assert.equal(b, 1);
  assert.equal(c, 2, "a fresh callback must not inherit the removed id");
});

test("removing one callback does NOT invalidate the ids of the others", () => {
  // The old implementation spliced `cache` at the raw id, so removing id 0 silently
  // shifted every later callback down by one and their stored ids pointed at neighbours.
  const r = createPreRenderRegistry();
  const calls: string[] = [];
  const first = r.add(() => calls.push("first"));
  const second = r.add(() => calls.push("second"));
  const third = r.add(() => calls.push("third"));

  r.remove(first);
  r.cache.forEach((fn) => (fn as () => void)());
  assert.deepEqual(calls, ["second", "third"]);

  calls.length = 0;
  r.remove(second); // `second`'s id must still name `second`, not `third`
  r.cache.forEach((fn) => (fn as () => void)());
  assert.deepEqual(calls, ["third"]);

  calls.length = 0;
  r.remove(third);
  r.cache.forEach((fn) => (fn as () => void)());
  assert.deepEqual(calls, []);
});

test("a callback whose id is 0 is still registered exactly once", () => {
  // The old `if (!fn.id)` guard treated the very first id (0) as 'unregistered'.
  const r = createPreRenderRegistry();
  const fn = () => {};
  assert.equal(r.add(fn), 0);
  assert.equal(r.add(fn), 0, "re-adding the same fn returns its existing id");
  assert.equal(r.cache.length, 1, "and must not duplicate it in the cache");
});

test("remove ignores an unknown id", () => {
  const r = createPreRenderRegistry();
  r.add(noop);
  r.remove(999);
  assert.equal(r.cache.length, 1);
});

test("remove is idempotent", () => {
  const r = createPreRenderRegistry();
  const id = r.add(noop);
  r.remove(id);
  r.remove(id);
  assert.equal(r.cache.length, 0);
});

test("cache preserves insertion order", () => {
  const r = createPreRenderRegistry();
  const order: number[] = [];
  r.add(() => order.push(1));
  r.add(() => order.push(2));
  r.add(() => order.push(3));
  r.cache.forEach((fn) => (fn as () => void)());
  assert.deepEqual(order, [1, 2, 3]);
});

test("two registries hand out ids independently of each other", () => {
  const a = createPreRenderRegistry();
  const b = createPreRenderRegistry();
  const shared = () => {};
  assert.equal(a.add(shared), 0);
  assert.equal(b.add(shared), 0);
  a.remove(0);
  assert.equal(a.cache.length, 0);
  assert.equal(b.cache.length, 1, "removing from one registry must not touch the other");
});
