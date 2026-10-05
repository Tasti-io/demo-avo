/**
 * What an anonymous stranger is allowed to spend.
 *
 * This demo really does call a model, which means every visitor costs money and
 * a bored one could cost a lot. Four guards, strongest first:
 *
 * 1. A spend limit on the Anthropic workspace the key belongs to. This is the only
 *    guard that is actually a ceiling, because it is enforced by the provider and
 *    not by code that can be bypassed. Everything below is there to make reaching
 *    it unlikely, not to make it impossible.
 * 2. A kill switch. Set DEMO_LIVE_DRAFTS=false and the demo serves prepared drafts
 *    instead, with the swap visible on the page. It keeps working; it stops paying.
 * 3. Short input and short output. A sentence is a sentence: anything past 280
 *    characters is refused before the request is made, and the reply is capped.
 * 4. A per-address rate limit.
 *
 * Be honest about guard 4: serverless functions do not share memory, so this
 * counts per running instance and a busy moment spreads requests across several.
 * It stops a person leaning on the button; it is not a hard global ceiling, and
 * nothing of this shape can be without a shared store. That is precisely why the
 * ceiling lives at the provider instead.
 */

export const LIMITS = {
  maxInputChars: 280,
  maxOutputTokens: 700,
  perAddressPerHour: 8,
  perInstancePerDay: 300,
};

const seen = new Map(); // address -> { count, resetAt }
let dayCount = 0;
let dayStartedAt = Date.now();

const HOUR = 3_600_000;
const DAY = 86_400_000;

export function liveDraftsEnabled() {
  return process.env.DEMO_LIVE_DRAFTS !== "false" && Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Why the request cannot run live, or null when it can. */
export function checkBudget({ address, sentence }) {
  if (typeof sentence !== "string" || !sentence.trim()) return "say what you want announced";
  if (sentence.length > LIMITS.maxInputChars) {
    return `that is ${sentence.length} characters; a demo takes up to ${LIMITS.maxInputChars}`;
  }
  if (!liveDraftsEnabled()) return "live drafting is off right now, so these are prepared examples";

  if (Date.now() - dayStartedAt > DAY) {
    dayCount = 0;
    dayStartedAt = Date.now();
  }
  if (dayCount >= LIMITS.perInstancePerDay) return "the demo has hit its budget for today, so these are prepared examples";

  const key = address || "unknown";
  const now = Date.now();
  const entry = seen.get(key);
  if (!entry || now > entry.resetAt) {
    seen.set(key, { count: 1, resetAt: now + HOUR });
  } else if (entry.count >= LIMITS.perAddressPerHour) {
    return "that is enough tries from one place for now, so these are prepared examples";
  } else {
    entry.count += 1;
  }

  // Keep the map from growing without bound on a long-lived instance.
  if (seen.size > 5000) for (const [k, v] of seen) if (now > v.resetAt) seen.delete(k);

  dayCount += 1;
  return null;
}

export function callerAddress(req) {
  const fwd = req.headers?.["x-forwarded-for"];
  return (Array.isArray(fwd) ? fwd[0] : String(fwd ?? "")).split(",")[0].trim() || "unknown";
}
