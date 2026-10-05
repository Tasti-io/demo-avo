/** GET /api/venue?a=<signed announcement> — the venue's public page. */
import { renderVenue } from "../lib/venue.js";

export default function handler(req, res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).end(renderVenue(req.query?.a));
}
