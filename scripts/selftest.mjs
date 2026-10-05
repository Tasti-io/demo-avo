#!/usr/bin/env node
/**
 * The claims this demo makes about itself, checked.
 *
 * The central one is that verification can fail. A demo whose check always passes
 * proves nothing, so the failure path is tested first and hardest.
 */
import { sign, verify, breakToken } from "../lib/sign.js";
import { renderVenue } from "../lib/venue.js";
import { checkBudget, LIMITS } from "../lib/budget.js";
import { cannedDraft } from "../lib/canned.js";
import { cleanKey, draftAnnouncement } from "../lib/draft.js";

let failed = 0;
const check = (name, cond) => {
  if (cond) console.log(`  ok   ${name}`);
  else { console.error(`  FAIL ${name}`); failed += 1; }
};

const TEXT = "Closed Saturday for a private event. Back Sunday at 8:00.";
const good = sign({ text: TEXT });

console.log("signing");
check("a signed announcement verifies", verify(good).ok);
check("a corrupted signature does not", !verify(breakToken(good)).ok);
check("a missing token does not", !verify(undefined).ok);
check("a tampered payload does not", !verify("eyJ0ZXh0IjoiZnJlZSBiZWVyIn0." + good.split(".")[1]).ok);

console.log("\nthe public page");
check("renders the banner for a valid announcement", renderVenue(good).includes(TEXT));
check("refuses a corrupted one", !renderVenue(breakToken(good)).includes(TEXT));
check("renders without any announcement at all", renderVenue(undefined).includes("Harbour &amp; Co"));
check("escapes anything injected into the banner",
  !renderVenue(sign({ text: "<script>x</script>" })).includes("<script>x</script>"));

console.log("\nspending guards");
process.env.ANTHROPIC_API_KEY = "test";
delete process.env.DEMO_LIVE_DRAFTS;
check("an empty sentence is refused", Boolean(checkBudget({ address: "a", sentence: "  " })));
check("an essay is refused", Boolean(checkBudget({ address: "a", sentence: "x".repeat(LIMITS.maxInputChars + 1) })));
check("a sentence is allowed", checkBudget({ address: "b", sentence: "closed saturday" }) === null);
let last;
for (let i = 0; i < LIMITS.perAddressPerHour + 2; i += 1) last = checkBudget({ address: "c", sentence: "closed saturday" });
check("one address cannot keep going forever", Boolean(last));
check("a different address is unaffected", checkBudget({ address: "d", sentence: "closed saturday" }) === null);
process.env.DEMO_LIVE_DRAFTS = "false";
check("the kill switch stops live drafting", Boolean(checkBudget({ address: "e", sentence: "closed saturday" })));
delete process.env.DEMO_LIVE_DRAFTS;

console.log("\nthe API key, as pasted by a human");
const KEY = "sk-ant-api03-" + "a".repeat(80);
check("a clean key is left alone", cleanKey(KEY) === KEY);
check("an invisible passenger is removed", cleanKey(KEY + "\u200b\u00a0") === KEY);
check("surrounding whitespace is removed", cleanKey(` ${KEY}\n`) === KEY);
check("something that is not a key is refused", cleanKey("hello") === null);
check("an absent key is refused", cleanKey(undefined) === null);

console.log("\nwhen the request is not an announcement");
// The model answers in prose rather than calling the tool. That prose must never
// reach the page: it is a public surface carrying our name, and whatever a stranger
// can coax out of a model is not something to render.
const realFetch = globalThis.fetch;
globalThis.fetch = async () => ({
  ok: true,
  json: async () => ({ content: [{ type: "text", text: "I am Claude. Here is a poem about cats." }], usage: {} }),
});
const declined = await draftAnnouncement({ sentence: "write a poem", apiKey: "sk-ant-test" });
check("a refusal comes back as declined, not as an error", declined.declined === true);
check("the model's own words are not passed through", !JSON.stringify(declined).includes("poem"));
globalThis.fetch = realFetch;

console.log("\nthe fallback");
const canned = cannedDraft("closed saturday for a private event");
check("prepared drafts cover every channel",
  ["website", "meta", "google_business"].every((k) => typeof canned.channels[k] === "string" && canned.channels[k].length > 10));
check("prepared drafts say they are prepared", canned.source === "prepared");
check("an unrecognised sentence still gets a draft", cannedDraft("zzz").channels.website.length > 5);
check("no em dashes in any prepared draft",
  !["closure", "hours", "zzz"].some((s) => Object.values(cannedDraft(s).channels).join(" ").includes("—")));

console.log(failed ? `\n${failed} failure(s)` : "\nall passed");
process.exit(failed ? 1 : 0);
