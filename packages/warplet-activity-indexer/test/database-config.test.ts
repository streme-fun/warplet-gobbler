import test from "node:test";
import assert from "node:assert/strict";
import { resolveDatabaseConnectionString } from "../src/lib/database.js";

test("resolveDatabaseConnectionString removes ssl params when DATABASE_SSL_MODE=disable", () => {
  const actual = resolveDatabaseConnectionString(
    "postgresql://user:pass@db:5432/postgres?sslmode=require&application_name=ponder",
    { sslMode: "disable" },
  );

  assert.equal(actual, "postgresql://user:pass@db:5432/postgres?application_name=ponder");
});

test("resolveDatabaseConnectionString overrides sslmode when explicitly provided", () => {
  const actual = resolveDatabaseConnectionString(
    "postgresql://user:pass@db:5432/postgres?sslmode=require",
    { sslMode: "prefer" },
  );

  assert.equal(actual, "postgresql://user:pass@db:5432/postgres?sslmode=prefer");
});