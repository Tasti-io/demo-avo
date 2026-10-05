/**
 * The venue's own public page, server rendered.
 *
 * It exists so the agent has something true to check. The banner appears only when
 * the signed announcement verifies, which is what lets the verification step come
 * back negative when it should. A page that printed whatever arrived in the URL
 * would make the agent's report meaningless.
 */
import { VENUE } from "./venue-brand.js";
import { verify } from "./sign.js";

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function renderVenue(token) {
  const result = verify(token);
  const banner = result.ok && result.payload.text
    ? `<div class="banner" role="status"><span class="dot"></span>${esc(result.payload.text)}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(VENUE.name)}</title>
<meta name="robots" content="noindex">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap" rel="stylesheet">
<style>
 *{margin:0;padding:0;box-sizing:border-box}
 :root{--ink:#1B1A18;--mid:#57534E;--faint:#8A857D;--rule:#E5E1D8;--paper:#FFF;--canvas:#F3F1EC;--teal:#0F8A7A}
 body{font-family:'DM Sans',system-ui,sans-serif;background:var(--canvas);color:var(--ink)}
 .banner{background:var(--teal);color:#fff;padding:13px 20px;font-size:14.5px;font-weight:500;
         display:flex;align-items:center;gap:10px}
 .dot{width:7px;height:7px;border-radius:50%;background:#fff;opacity:.85;flex:none}
 .wrap{max-width:720px;margin:0 auto;padding:44px 20px 60px}
 h1{font-family:'DM Serif Display',Georgia,serif;font-size:40px;line-height:1.1}
 .tag{color:var(--mid);margin-top:8px;font-size:16px}
 .card{background:var(--paper);border:1px solid var(--rule);border-radius:10px;margin-top:26px;overflow:hidden}
 .card h2{font-family:'DM Serif Display',Georgia,serif;font-size:17px;font-weight:400;padding:14px 18px;border-bottom:1px solid var(--rule)}
 .row{display:flex;justify-content:space-between;gap:16px;padding:11px 18px;border-bottom:1px solid var(--rule);font-size:14.5px}
 .row:last-child{border-bottom:0}
 .row span:first-child{color:var(--mid)}
 footer{margin-top:28px;font-size:13px;color:var(--faint);line-height:20px}
</style></head><body>
${banner}
<div class="wrap">
  <h1>${esc(VENUE.name)}</h1>
  <p class="tag">${esc(VENUE.tagline)}</p>
  <div class="card"><h2>Hours</h2>
    ${VENUE.hours.map(([d, h]) => `<div class="row"><span>${esc(d)}</span><span>${esc(h)}</span></div>`).join("")}
  </div>
  <div class="card"><h2>A few things we make</h2>
    ${VENUE.menu.map(([i, p]) => `<div class="row"><span>${esc(i)}</span><span>${esc(p)}</span></div>`).join("")}
  </div>
  <footer>${esc(VENUE.address)} &middot; ${esc(VENUE.phone)}<br>
  This venue is invented. It is the public page used by a working demo at
  <a href="/" style="color:var(--teal)">avo.tasti.io</a>.</footer>
</div></body></html>`;
}
