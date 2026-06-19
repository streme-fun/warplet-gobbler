import http from "node:http";
import crypto from "node:crypto";

const port = Number(process.env.PORT ?? "3211");
const host = process.env.HOST ?? "127.0.0.1";
const upstream = new URL(process.env.UPSTREAM_URL ?? "http://127.0.0.1:3106");
const token = process.env.AUTH_TOKEN;
const cookieName = process.env.AUTH_COOKIE_NAME ?? "warplet_legacy_auction_auth";

if (!token) {
  console.error("AUTH_TOKEN is required");
  process.exit(1);
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function hasValidCookie(cookieHeader = "") {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .some((part) => {
      const [name, ...valueParts] = part.split("=");
      return name === cookieName && timingSafeEqual(decodeURIComponent(valueParts.join("=")), token);
    });
}

function cleanPath(reqUrl) {
  const url = new URL(reqUrl, "https://warplet-legacy-auction.repo.box");
  url.searchParams.delete("token");
  return `${url.pathname}${url.search}${url.hash}`;
}

function proxyRequest(req, res) {
  const target = new URL(req.url ?? "/", upstream);
  const proxyReq = http.request(
    {
      hostname: target.hostname,
      port: target.port,
      path: `${target.pathname}${target.search}`,
      method: req.method,
      headers: {
        ...req.headers,
        host: upstream.host,
        "x-forwarded-host": req.headers.host ?? "",
        "x-forwarded-proto": "https",
      },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on("error", (error) => {
    res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end(`Preview upstream unavailable: ${error.message}`);
  });

  req.pipe(proxyReq);
}

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? "/", "https://warplet-legacy-auction.repo.box");
    const suppliedToken = url.searchParams.get("token");

    if (suppliedToken && timingSafeEqual(suppliedToken, token)) {
      res.writeHead(302, {
        "set-cookie": `${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`,
        location: cleanPath(req.url ?? "/"),
      });
      res.end();
      return;
    }

    if (!hasValidCookie(req.headers.cookie)) {
      res.writeHead(401, {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      });
      res.end("Protected preview. Open the magic link with a valid token.");
      return;
    }

    proxyRequest(req, res);
  })
  .listen(port, host, () => {
    console.log(`legacy auction auth proxy listening on ${host}:${port}`);
  });
