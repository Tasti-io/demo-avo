/**
 * The one model call in this demo: a sentence in, three channel drafts out.
 *
 * This is where the model belongs. Writing the same announcement three ways, each
 * to a different house style, is exactly the job a person does badly at 06:40 and
 * a model does well. Everything after this point in the loop is ordinary code:
 * signing, fetching the page, and looking for the words.
 *
 * Nothing is published by this function. It returns drafts, and the loop requires
 * a human click before anything reaches a channel. That is not a limitation of the
 * demo, it is the product's position: the owner approves, the agent does the work.
 */
import { VENUE } from "./venue-brand.js";
import { LIMITS } from "./budget.js";

const API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

const TOOL = {
  name: "write_drafts",
  description: "Write the announcement for each channel.",
  input_schema: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["general", "hours", "promo", "closure"] },
      website: { type: "string", description: "One line for a banner across the top of the venue's own page. At most 90 characters. No hashtags, no emoji." },
      meta: { type: "string", description: "Instagram and Facebook caption. Two or three short lines. At most one emoji, and only if it earns its place. No hashtag lists." },
      google_business: { type: "string", description: "Google Business Profile update. Factual and plain, two sentences, no emoji, no exclamation marks." },
    },
    required: ["kind", "website", "meta", "google_business"],
  },
};

const SYSTEM = [
  `You write short public announcements for ${VENUE.name}, a small hospitality group in Vancouver.`,
  `Hours: ${VENUE.hours.map(([d, h]) => `${d} ${h}`).join("; ")}.`,
  "",
  "Always answer by calling the write_drafts tool. Do not reply in prose.",
  "",
  "Say only what the owner said. Never invent a reason, a date, a discount or a detail they did not",
  "give you. If something a customer would need is missing, leave it out rather than guessing it.",
  "Plain words throughout. No marketing voice, no exclamation marks, no em dashes.",
  "",
  "The three channels are three different rooms, and writing the same sentence into all three is the",
  "failure this exists to prevent. Each has its own shape:",
  "",
  "  website         A notice, not a message. The shortest true version. One line, under 90",
  "                  characters, no greeting, no sign off. Someone reads it in half a second on",
  "                  their way to the menu.",
  "",
  "  meta            A note to people who already follow you. Two or three short lines on separate",
  "                  lines. It may carry one concrete human detail the banner has no room for, as",
  "                  long as the owner actually said it. No hashtags.",
  "",
  "  google_business A record, written for someone who has never been. Two sentences. Name the day",
  "                  and the time precisely, state when normal service resumes, no personality.",
  "",
  "When the owner's sentence carries only one fact there is nothing for the longer channels to",
  "carry either, and the Meta draft may be as short as the banner. Padding it with warmth nobody",
  "asked for is worse than being brief.",
  "",
  "Worked example. Owner says: back open monday after the flood, kitchen still limited",
  "  website:         Open again Monday. The kitchen is on a short menu for now.",
  "  meta:            We are open again from Monday.",
  "                   The kitchen is still on a short menu while the repairs finish, so the board",
  "                   will be smaller than usual for a week or so.",
  "  google_business: Harbour & Co reopens on Monday following water damage repairs. A reduced menu",
  "                   is in place until the kitchen is fully restored.",
].join("\n");

/**
 * Clean the key before it becomes an HTTP header.
 *
 * A key pasted through a console, a password manager or a terminal prompt can
 * arrive carrying a stray non-breaking space or zero width character. An API key
 * is base64url text and never legitimately contains one, but a header value
 * cannot hold a character above 255, so one invisible passenger makes fetch throw
 * before a single request is sent. The symptom is indistinguishable from an
 * outage, which is a miserable thing to debug on a page nobody is watching.
 */
export function cleanKey(raw) {
  const key = String(raw ?? "").replace(/[^\x21-\x7E]/g, "");
  return key.startsWith("sk-ant-") ? key : null;
}

export async function draftAnnouncement({ sentence, apiKey = process.env.ANTHROPIC_API_KEY, model = MODEL }) {
  const key = cleanKey(apiKey);
  if (!key) throw new Error("the API key is missing or does not look like an Anthropic key");

  const res = await fetch(API, {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: LIMITS.maxOutputTokens,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content: `The owner says: ${sentence}` }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();

  const call = body.content?.find((c) => c.type === "tool_use");
  if (!call) {
    // Asked something that is not an announcement: a question, an instruction aimed
    // at the model, an insult. The model answers in prose instead of calling the
    // tool, which is the right refusal. We do not pass that prose through: this is a
    // public page carrying our name, and echoing whatever a stranger can coax out of
    // a model is a brand surface nobody is watching. A fixed reply is also the
    // truthful one, because the honest answer never varies. Avo writes announcements
    // and is not a chat.
    return { declined: true, usage: body.usage };
  }

  const { kind, website, meta, google_business } = call.input;
  return {
    kind,
    channels: { website, meta, google_business },
    source: "live",
    usage: body.usage,
  };
}
