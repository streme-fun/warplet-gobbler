import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileBackedMessageDeduper } from "../src/lib/telegram-dedupe.js";

test("FileBackedMessageDeduper persists sent message keys to disk", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "telegram-dedupe-"));
  const filePath = join(tempDir, "sent.txt");
  const deduper = new FileBackedMessageDeduper(filePath);

  assert.equal(await deduper.has("tx:1"), false);
  await deduper.mark("tx:1");
  assert.equal(await deduper.has("tx:1"), true);

  const reloaded = new FileBackedMessageDeduper(filePath);
  assert.equal(await reloaded.has("tx:1"), true);

  await reloaded.mark("tx:1");
  const lines = (await readFile(filePath, "utf8")).trim().split("\n");
  assert.deepEqual(lines, ["tx:1"]);
});