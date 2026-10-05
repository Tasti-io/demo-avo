/**
 * The demo's front end: four steps, in order, with nothing hidden between them.
 *
 * Deliberately a state machine rather than a scripted animation. Every panel the
 * visitor sees is the actual response from the actual endpoint, including the
 * failures, because a demo that plays a recording of success is worth exactly as
 * much as a tool that reports success without checking.
 */

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clock = (iso) => new Date(iso).toLocaleTimeString("en-CA", { hour12: false });

const CHANNELS = [
  { key: "website", label: "Website banner", where: "the top of harbourandco.example" },
  { key: "meta", label: "Instagram and Facebook", where: "a caption for both" },
  { key: "google_business", label: "Google Business", where: "the profile customers see in search" },
];

let state = { sentence: "", draft: null };

/* ---------- tabs ---------- */

const tabs = [...document.querySelectorAll('[role="tab"]')];
function showTab(id) {
  for (const t of tabs) {
    const on = t.id === id;
    t.classList.toggle("is-on", on);
    t.setAttribute("aria-selected", String(on));
    t.tabIndex = on ? 0 : -1;
    $(t.getAttribute("aria-controls")).hidden = !on;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}
for (const t of tabs) t.addEventListener("click", () => showTab(t.id));
document.getElementById("go-how")?.addEventListener("click", () => { showTab("tab-how"); document.getElementById("tab-how").focus(); });
document.addEventListener("keydown", (e) => {
  if (!tabs.includes(document.activeElement)) return;
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  const next = tabs[(tabs.indexOf(document.activeElement) + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
  next.focus();
  showTab(next.id);
});

/* ---------- the composer ---------- */

const sentence = $("sentence");
const thread = $("thread");

sentence.addEventListener("input", () => {
  $("count").textContent = `${sentence.value.length} / 280`;
});
for (const chip of document.querySelectorAll(".chip")) {
  chip.addEventListener("click", () => {
    sentence.value = chip.dataset.fill;
    sentence.dispatchEvent(new Event("input"));
    sentence.focus();
  });
}
sentence.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ask();
});
$("go").addEventListener("click", ask);

const say = (who, html) => {
  thread.insertAdjacentHTML("beforeend", `<div class="turn"><div class="who">${esc(who)}</div>${html}</div>`);
  thread.lastElementChild.scrollIntoView({ behavior: "smooth", block: "nearest" });
};

async function post(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `request failed (${res.status})`);
  return json;
}

/* ---------- step 1: ask ---------- */

async function ask() {
  const text = sentence.value.trim();
  if (!text) { sentence.focus(); return; }

  state = { sentence: text, draft: null };
  thread.innerHTML = "";
  $("go").disabled = true;
  $("go").textContent = "Avo is writing";

  say("you", `<p class="said">${esc(text)}</p>`);

  try {
    const draft = await post("/api/draft", { sentence: text });
    if (draft.declined) { showDeclined(); return; }
    state.draft = draft;
    showDraft(draft);
  } catch (err) {
    say("avo", `<p class="agent">I could not draft that: ${esc(err.message)}</p>`);
  } finally {
    $("go").disabled = false;
    $("go").textContent = "Ask Avo to draft it";
  }
}

/* An honest dead end rather than an error. Avo turns a sentence into
   announcements; a question, an instruction aimed at the model, or an insult is
   not one, and pretending otherwise would put nonsense on a public page. */
function showDeclined() {
  say("avo", `
    <p class="agent">I cannot put that on a sign.</p>
    <p class="agent" style="margin-top:8px">I take one sentence from the owner and write it for three
      channels. I am not a chat, I cannot see your sales, and I will not announce something the
      owner did not say. Tell me what you want customers to read.</p>`);
}

/* ---------- step 2: the drafts, unsent ---------- */

function showDraft(draft) {
  const cards = CHANNELS.map((c) => `
    <div class="draft">
      <div class="draft-head"><span><b>${esc(c.label)}</b> &middot; ${esc(c.where)}</span><span class="tag">draft</span></div>
      <div class="draft-body">${esc(draft.channels[c.key] ?? "")}</div>
    </div>`).join("");

  say("avo", `
    <p class="agent">Three drafts, read as <b>${esc(draft.kind)}</b>.
      ${draft.source === "prepared" ? "" : "Nothing has been published."}</p>
    ${cards}
    ${draft.notice ? `<div class="notice">${esc(draft.notice)}</div>` : ""}
    <p class="agent" style="margin-top:12px">Nothing leaves this page until you approve it.</p>
    <div class="actions">
      <button class="btn primary" id="approve">Approve</button>
      <button class="btn ghost" id="discard">Discard</button>
      <button class="linkish" id="approve-broken">approve, but break the handoff</button>
    </div>`);

  $("approve").addEventListener("click", () => approve(false));
  $("approve-broken").addEventListener("click", () => approve(true));
  $("discard").addEventListener("click", () => {
    say("avo", `<p class="agent">Discarded. Nothing was sent anywhere.</p>`);
    for (const id of ["approve", "discard", "approve-broken"]) $(id)?.setAttribute("disabled", "");
  });
}

/* ---------- steps 3 and 4: publish, then go and look ---------- */

async function approve(broken) {
  for (const id of ["approve", "discard", "approve-broken"]) $(id)?.setAttribute("disabled", "");
  const text = state.draft.channels.website;

  try {
    const { token, venuePath } = await post("/api/publish", { text, broken });
    $("venue").src = venuePath;
    $("viewing").textContent = broken
      ? "published with a corrupted signature, so the page will refuse it"
      : "the banner above is rendered from the approved announcement";

    say("avo", `<p class="agent">Published to the website banner${broken ? ", with the handoff broken on purpose" : ""}. Checking the page now.</p>`);

    const report = await post("/api/verify", { token, text });
    showReport(report);
  } catch (err) {
    say("avo", `<p class="agent">That did not work: ${esc(err.message)}</p>`);
  }
}

function showReport(report) {
  const verified = report.results.find((r) => r.live)?.state === "verified";

  const rows = report.results.map((r) => `
    <div class="result">
      <span class="n">${esc(r.channel)}<span class="note">${esc(r.note)}</span></span>
      <span class="tag ${r.state === "verified" ? "live" : r.state === "not found" ? "bad" : ""}">${esc(r.state)}</span>
    </div>`).join("");

  say("avo", `
    <p class="agent">${verified
      ? `I fetched <b>${esc(report.checkedUrl)}</b> and the words are on the page. Checked at <b>${esc(clock(report.at))}</b>.`
      : `I fetched <b>${esc(report.checkedUrl)}</b> and my own words are <b>not on it</b>. I am not telling you this is done. Checked at <b>${esc(clock(report.at))}</b>.`}</p>
    ${rows}
    <p class="agent" style="margin-top:12px">${verified
      ? "Two channels are queued rather than sent, because this demo has no connector to them. Saying sent would be the thing this is built against."
      : "This is the failure on purpose. The point is that the same report would arrive if a real handoff failed, instead of a green tick."}</p>`);
}
