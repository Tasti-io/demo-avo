/**
 * Prepared drafts, for when live drafting is off or the budget is spent.
 *
 * A demo that breaks when it runs out of money is a demo that breaks in front of
 * whoever happens to arrive after it does. These keep the loop walkable, and the
 * page says plainly which mode it is in rather than passing them off as fresh
 * work. A prospect who later discovers the "agent" was a lookup table stops
 * believing everything else on the page too.
 */
const CANNED = [
  {
    match: /clos|shut|private|event/i,
    kind: "closure",
    channels: {
      website: "Closed Saturday for a private event. Back Sunday at 8:00.",
      meta: "We are closed this Saturday for a private event.\nBack Sunday at 8:00, same bread, same coffee.",
      google_business: "Harbour & Co will be closed on Saturday for a private event. We reopen Sunday at 8:00 with normal hours. Thank you for your patience.",
    },
  },
  {
    match: /hour|open|late|early/i,
    kind: "hours",
    channels: {
      website: "Open until 21:00 on Fridays from this week.",
      meta: "Fridays run late now. Kitchen until 20:30, room until 21:00.",
      google_business: "Starting this week, Harbour & Co is open until 21:00 on Fridays. Kitchen closes at 20:30.",
    },
  },
  {
    match: /.*/,
    kind: "general",
    channels: {
      website: "New on the menu this week.",
      meta: "Something new on the menu this week. Come and find out what.",
      google_business: "Harbour & Co has a new item on the menu this week. Normal hours apply.",
    },
  },
];

export function cannedDraft(sentence) {
  const hit = CANNED.find((c) => c.match.test(sentence || "")) ?? CANNED.at(-1);
  return { kind: hit.kind, channels: { ...hit.channels }, source: "prepared" };
}
