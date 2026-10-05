/**
 * POST /api/verify — go and look at the page, then report.
 *
 * This is the whole argument of the product in one request. Most tools mark a
 * thing published the moment they have handed it off, which means the owner finds
 * out it never arrived from a customer. This fetches the public page over the
 * network, decodes what the renderer escaped, and looks for the exact words it
 * claims to have put there. If they are not on the page it says so, and that
 * answer is as real as the other one; the demo has a button that forces it.
 *
 * The two external channels are reported as queued, not sent, because in this demo
 * no connector exists for them. Saying "sent" would be the exact lie the product
 * is built against.
 */
import { verify as verifyToken } from "../lib/sign.js";

function decodeEntities(html) {
  return html
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'");
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).end(JSON.stringify({ error: "POST only" }));

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body ?? {};
  const token = String(body.token ?? "");
  const expected = String(body.text ?? "").trim();

  const proto = (req.headers["x-forwarded-proto"] ?? "http").toString().split(",")[0];
  const host = (req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:3020").toString();
  const url = `${proto}://${host}/venue?a=${encodeURIComponent(token)}`;

  const at = new Date().toISOString();
  const signature = verifyToken(token);

  let found = false;
  let note;
  try {
    const page = await fetch(url, { headers: { "user-agent": "tasti-avo-demo-verifier" } });
    if (!page.ok) {
      note = `the page answered ${page.status}`;
    } else {
      found = decodeEntities(await page.text()).includes(expected);
      note = found
        ? "fetched the page and found the exact words"
        : `fetched the page and the words are not on it${signature.ok ? "" : ` (${signature.reason})`}`;
    }
  } catch (err) {
    note = `could not reach the page (${String(err.message).slice(0, 80)})`;
  }

  res.status(200).end(JSON.stringify({
    checkedUrl: url.replace(/\?a=.*$/, ""),
    at,
    results: [
      { channel: "Website banner", state: found ? "verified" : "not found", live: true, note },
      { channel: "Instagram and Facebook", state: "queued", live: false, note: "no connector in this demo, so nothing was sent" },
      { channel: "Google Business", state: "queued", live: false, note: "no connector in this demo, so nothing was sent" },
    ],
  }));
}
