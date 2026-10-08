# Avo

Live at **[avo.tasti.io](https://avo.tasti.io)**. Part of the
[Tasti.io demos](https://demo.tasti.io).

An owner types one sentence, such as "closed Saturday for a private event". Avo
writes it three ways, for the venue's website banner, for Instagram and Facebook,
and for Google Business. Nothing goes anywhere until the owner approves. After
approval the banner is published to the venue's public page, and then the agent
fetches that page over the network and checks that its own words are actually on
it before it reports anything as done.

## The one rule

**Nothing is reported as done until it has been checked where a customer would see it.**

Most tools mark a post published the moment they hand it off, so the owner learns
it never arrived from a customer. Here the report comes from looking:

- `lib/draft.js` is the only place a model is called. Claude Haiku turns the
  sentence into three drafts through a tool schema, each channel with its own
  shape (a one-line notice, a short note to followers, a factual record). The
  prompt forbids inventing reasons, dates or discounts the owner did not give.
- `api/publish.js` is the approval step. It signs the approved banner text with an
  HMAC (`lib/sign.js`) and returns the address of the public page.
- `lib/venue.js` renders the venue page, and shows the banner only when the
  signature verifies. A tampered, expired or unsigned payload produces a page with
  no banner.
- `api/verify.js` fetches that page like any visitor, decodes the HTML entities the
  renderer escaped, and looks for the exact approved words.

Because the page refuses a bad signature, the check can genuinely fail. The demo
has a button, "approve, but break the handoff", that corrupts the signature on
purpose so the visitor can watch the agent fetch the page, not find its words, and
say so instead of showing a green tick. A check that cannot fail would prove
nothing.

The approval is not a demo convenience. It is the product's position: the owner
approves, the agent does the work.

## What is real and what is simulated

- **Real:** the drafting call to Claude Haiku (when live drafting is on), the
  signing, the server-rendered public page, and the network fetch that verifies it.
- **Simulated:** only the website banner is published. Instagram, Facebook and
  Google Business have no connector in this demo, so the report shows them as
  **queued**, with the note "nothing was sent". Reporting them as sent would be the
  exact failure the product is built against.
- **Invented:** the venue. Harbour & Co, its address, phone, hours and menu
  (`lib/venue-brand.js`) are fictional, the same group the other demos run on (see
  [harbour-data](https://github.com/Tasti-io/harbour-data)). Putting a real
  restaurant's name on invented announcements would be putting words in its mouth.
- **No database.** Each visitor's announcement travels only inside their own signed
  URL and expires after an hour, so nothing is shared between visitors.

## Running it safely in public

Every live draft costs money, so `lib/budget.js` decides what an anonymous visitor
may spend, strongest guard first:

1. A spend limit on the Anthropic workspace the key belongs to. The provider
   enforces it, so it is the only true ceiling; everything below makes reaching it
   unlikely.
2. A kill switch: `DEMO_LIVE_DRAFTS=false` serves prepared drafts instead
   (`lib/canned.js`), and the page says which mode it is in.
3. Short input and short output: 280 characters in, 700 tokens out.
4. A per-address rate limit (8 an hour) and a per-instance daily count (300).
   Serverless instances do not share memory, so this is per instance and not a
   global ceiling. That is why the ceiling lives at the provider.

Two more guards protect the page rather than the budget:

- If the visitor writes something that is not an announcement (a question, an
  instruction aimed at the model), the model answers in prose instead of calling
  the tool. That prose is never passed through: the API returns `declined` and the
  page shows a fixed reply. A public page carrying the company's name should not
  echo whatever a stranger can coax out of a model.
- If the provider cannot be reached, the visitor gets prepared drafts with a notice
  saying why, so the loop stays walkable.

`cleanKey()` in `lib/draft.js` strips invisible characters from the API key before
it becomes an HTTP header, because one pasted zero-width space makes `fetch` throw
in a way that looks exactly like an outage.

## Layout

```
api/draft.js        POST: budget checks, one sentence to three drafts, or prepared drafts with a notice
api/publish.js      POST: the approval step; signs the banner text, returns the venue page address
api/venue.js        GET /venue: the venue's public page (rewritten in vercel.json)
api/verify.js       POST: fetches the public page and looks for the approved words
lib/draft.js        the model call, tool schema, house style per channel, cleanKey()
lib/sign.js         HMAC signing with a one-hour expiry, and breakToken() for the failure demo
lib/venue.js        server-rendered venue page; banner only on a valid signature, all text escaped
lib/venue-brand.js  the invented venue
lib/budget.js       limits for anonymous use
lib/canned.js       prepared drafts for when live drafting is off or out of budget
public/             the page: a small state machine over the four endpoints, no recorded playback
scripts/dev.mjs     local server that routes the handlers the way Vercel does
scripts/selftest.mjs  25 checks, no network
```

## Run

```bash
npm run check   # self-test, no API key needed
npm run dev     # http://localhost:3020; reads ANTHROPIC_API_KEY from the environment
```

Without a key the demo still runs, on prepared drafts. Set `DEMO_SIGNING_SECRET` in
production; the built-in fallback is fine locally because forging a token only
shows the forger a banner nobody else sees.

No npm dependencies.
