import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return c.json({ ok: true, service: "warplet-activity-indexer" });
});

app.get("/healthz", (c) => {
  return c.json({ ok: true });
});

export default app;