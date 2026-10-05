/**
 * POST /api/publish — the approval step.
 *
 * Signing happens here, on the server, because the secret belongs here. The
 * response is the address of the public page carrying the announcement, which the
 * verifier then goes and fetches like any other visitor would.
 *
 * `broken: true` signs the payload and then corrupts the signature on purpose. It
 * is the demo's way of showing that the check can come back negative, which is the
 * only thing that makes a positive result worth anything.
 */
import { sign, breakToken } from "../lib/sign.js";
import { LIMITS } from "../lib/budget.js";

export default function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).end(JSON.stringify({ error: "POST only" }));

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body ?? {};
  const text = String(body.text ?? "").trim().slice(0, LIMITS.maxInputChars);
  if (!text) return res.status(400).end(JSON.stringify({ error: "nothing to publish" }));

  const token = body.broken ? breakToken(sign({ text })) : sign({ text });
  res.status(200).end(JSON.stringify({ token, venuePath: `/venue?a=${encodeURIComponent(token)}` }));
}
