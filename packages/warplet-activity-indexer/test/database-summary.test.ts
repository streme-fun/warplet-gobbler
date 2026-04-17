import test from "node:test";
import assert from "node:assert/strict";
import { summarizeDatabaseConnectionString } from "../src/lib/database.js";

test("summarizeDatabaseConnectionString redacts a URL into safe connection details", () => {
  assert.deepEqual(
    summarizeDatabaseConnectionString(
      "postgresql://user%40name:secret@db.internal:5432/postgres?sslmode=disable",
    ),
    {
      protocol: "postgresql:",
      host: "db.internal",
      port: "5432",
      database: "postgres",
      user: "user@name",
      sslmode: "disable",
    },
  );
});