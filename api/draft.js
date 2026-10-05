/**
 * POST /api/draft — one sentence in, three channel drafts out.
 *
 * Nothing is published here. The response is a proposal that the visitor has to
 * approve, which is the product's actual position and not a demo convenience.
 */
import { draftAnnouncement } from "../lib/draft.js";
import { cannedDraft } from "../lib/canned.js";
import { checkBudget, callerAddress, LIMITS } from "../lib/budget.js";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).end(JSON.stringify({ error: "POST only" }));
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body ?? {};
  const sentence = String(body.sentence ?? "").trim().slice(0, LIMITS.maxInputChars + 1);

  const blocked = checkBudget({ address: callerAddress(req), sentence });
  if (blocked && !sentence) {
    return res.status(400).end(JSON.stringify({ error: blocked }));
  }
  if (blocked) {
    // Still walk the loop, on prepared text, and say so on the page.
    return res.status(200).end(JSON.stringify({ ...cannedDraft(sentence), notice: blocked }));
  }

  try {
    const out = await draftAnnouncement({ sentence });
    return res.status(200).end(JSON.stringify(out));
  } catch (err) {
    // A provider hiccup should not end the demo in front of whoever is watching.
    return res.status(200).end(JSON.stringify({
      ...cannedDraft(sentence),
      notice: `the model could not be reached just now (${String(err.message).slice(0, 80)}), so these are prepared examples`,
    }));
  }
}
