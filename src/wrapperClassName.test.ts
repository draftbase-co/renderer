import assert from "node:assert/strict";
import { test } from "node:test";
import { wrapperClassName } from "./wrapperClassName.js";

test("defaults to db-content", () => {
  assert.equal(wrapperClassName(undefined, undefined), "db-content");
});

test("unstyled drops db-content", () => {
  assert.equal(wrapperClassName(true, undefined), undefined);
});

test("merges custom className", () => {
  assert.equal(wrapperClassName(false, "prose"), "db-content prose");
});

test("unstyled keeps custom className", () => {
  assert.equal(wrapperClassName(true, "prose"), "prose");
});
