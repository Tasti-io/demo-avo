#!/usr/bin/env node
// Local preview: serves public/ and routes the /api handlers the same way Vercel
// will, including the /venue rewrite declared in vercel.json.
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import os from "node:os";

// Local convenience only: pick the key up from the file it already lives in, so a
// developer never types it on a command line where the shell history keeps it.
// Nothing outside this dev script reads that file; on Vercel the key is an
// environment variable like any other.
if (!process.env.ANTHROPIC_API_KEY) {
  try {
    const line = readFileSync(path.join(os.homedir(), ".tasti/anthropic.env"), "utf8")
      .split("\n").find((l) => l.startsWith("ANTHROPIC_API_KEY="));
    if (line) process.env.ANTHROPIC_API_KEY = line.slice("ANTHROPIC_API_KEY=".length).trim();
  } catch { /* no key file: the demo falls back to prepared drafts, which is the point of them */ }
}

import draft from "../api/draft.js";
import publish from "../api/publish.js";
import venue from "../api/venue.js";
import verify from "../api/verify.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
const ROUTES = { "/api/draft": draft, "/api/publish": publish, "/api/venue": venue, "/venue": venue, "/api/verify": verify };

const readBody = (req) =>
  new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => { data += c; });
    req.on("end", () => resolve(data));
  });

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const route = ROUTES[url.pathname];

  if (route) {
    const shim = {
      setHeader: (k, v) => res.setHeader(k, v),
      status: (c) => ({ end: (b) => { res.statusCode = c; res.end(b); } }),
    };
    const body = req.method === "POST" ? await readBody(req) : undefined;
    return route({ method: req.method, headers: req.headers, query: Object.fromEntries(url.searchParams), body }, shim);
  }

  const file = url.pathname === "/" ? "index.html" : url.pathname.replace(/^\//, "");
  try {
    const content = await readFile(path.join(ROOT, "public", file));
    res.setHeader("Content-Type", TYPES[path.extname(file)] ?? "application/octet-stream");
    res.end(content);
  } catch {
    res.statusCode = 404;
    res.end("not found");
  }
}).listen(3020, () => console.log("avo demo on http://localhost:3020"));
