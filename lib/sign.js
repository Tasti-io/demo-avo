/**
 * Signing the announcement that travels between the agent and the public page.
 *
 * This demo keeps no database. The announcement the visitor approves is carried
 * to the venue page inside the URL, which raises an obvious objection: if the page
 * simply renders whatever the URL says, then the agent's check can never fail, and
 * a check that cannot fail is theatre.
 *
 * So the payload is signed, and the venue page renders the banner only when the
 * signature verifies. That makes the verification step genuinely fallible: a
 * tampered, expired or unsigned payload produces a page with no banner, the agent
 * fetches it, does not find its own words, and says so. The demo has a button that
 * does exactly that on purpose, because showing the check failing is the only way
 * to prove the check is real.
 *
 * The secret protects nothing valuable. Nothing here is shared between visitors:
 * each person's announcement exists only in their own URL, so the worst anyone can
 * do by forging one is show themselves a banner nobody else will ever see.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET = process.env.DEMO_SIGNING_SECRET || "tasti-public-demo-not-a-real-secret";
const MAX_AGE_MS = 60 * 60 * 1000; // an hour is longer than anyone spends in a demo

const b64url = (buf) => Buffer.from(buf).toString("base64url");
const unb64url = (s) => Buffer.from(s, "base64url").toString("utf8");

const mac = (body) => createHmac("sha256", SECRET).update(body).digest("base64url");

export function sign(payload) {
  const body = b64url(JSON.stringify({ ...payload, at: Date.now() }));
  return `${body}.${mac(body)}`;
}

/** Returns the payload, or null with a reason. Never throws on bad input. */
export function verify(token) {
  if (typeof token !== "string" || !token.includes(".")) return { ok: false, reason: "no token" };
  const [body, given] = token.split(".", 2);

  const expected = mac(body);
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "signature does not match" };

  let payload;
  try {
    payload = JSON.parse(unb64url(body));
  } catch {
    return { ok: false, reason: "payload is not readable" };
  }

  if (!payload.at || Date.now() - payload.at > MAX_AGE_MS) return { ok: false, reason: "expired" };
  return { ok: true, payload };
}

/** A token the venue page will refuse, for demonstrating a failed publish. */
export function breakToken(token) {
  const [body] = String(token).split(".", 2);
  return `${body}.${mac(body + "x")}`;
}
