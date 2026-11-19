// Builds data/market.json, the numbers behind market.html and the home page market snapshot.
//
// Runs automatically every week from GitHub (.github/workflows/update-market.yml) and
// commits the file only when the numbers change, which makes Vercel republish the site.
// Run by hand with:  node scripts/update-market.mjs
//
// Free public sources, no keys needed:
//   Realtor.com Economic Research (monthly listing data by metro and county)
//   Freddie Mac weekly mortgage rates, read from FRED (Federal Reserve Bank of St. Louis)
//
// The output is plain JSON on purpose: the same file can feed social media posts later
// (see "headlines" and "socialPost").

import { readFile, writeFile } from "node:fs/promises";

const OUT = new URL("../data/market.json", import.meta.url);

const METRO = { code: "25060", name: "Gulfport-Biloxi metro" };
const COUNTIES = [
  { fips: "28047", name: "Harrison County" },
  { fips: "28045", name: "Hancock County" },
  { fips: "28059", name: "Jackson County" },
  { fips: "28131", name: "Stone County" },
];

const RDC = "https://econdata.s3-us-west-2.amazonaws.com/Reports/Core/";
const METRO_HISTORY_CSV = RDC + "RDC_Inventory_Core_Metrics_Metro_History.csv";
const COUNTY_CSV = RDC + "RDC_Inventory_Core_Metrics_County.csv";
const FRED = (id) => `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

async function getText(url) {
  const r = await fetch(url, { headers: { "User-Agent": "realtor-site-market-update" } });
  if (!r.ok) throw new Error(`${url} answered ${r.status}`);
  return r.text();
}

// Small CSV reader that handles quoted fields like "Gulfport-Biloxi, MS".
function parseCsv(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const out = [];
    let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    rows.push(out);
  }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const num = (v) => (v === undefined || v === "" || v === null || isNaN(Number(v)) ? null : Number(v));
const pct = (v) => (num(v) === null ? null : Math.round(num(v) * 1000) / 10); // 0.0763 -> 7.6
const monthKey = (yyyymm) => `${yyyymm.slice(0, 4)}-${yyyymm.slice(4, 6)}`;
const dayLabel = (iso) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}`;
const monthLabel = (key) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;

async function listingData() {
  const metroRows = parseCsv(await getText(METRO_HISTORY_CSV))
    .filter((r) => r.cbsa_code === METRO.code)
    .sort((a, b) => b.month_date_yyyymm.localeCompare(a.month_date_yyyymm));
  if (!metroRows.length) throw new Error("Gulfport-Biloxi was not in the Realtor.com metro file");
  const m = metroRows[0];

  const priorDom = num(m.median_days_on_market) && num(m.median_days_on_market_yy) !== null
    ? Math.round(num(m.median_days_on_market) / (1 + num(m.median_days_on_market_yy)))
    : null;

  const countyRows = parseCsv(await getText(COUNTY_CSV));
  const counties = COUNTIES.map((c) => {
    const r = countyRows.find((x) => x.county_fips === c.fips);
    if (!r) return null;
    return {
      name: c.name,
      medianListPrice: num(r.median_listing_price),
      medianListPriceYoY: pct(r.median_listing_price_yy),
      activeListings: num(r.active_listing_count),
      daysOnMarket: num(r.median_days_on_market),
      pricePerSqft: num(r.median_listing_price_per_square_foot),
    };
  }).filter(Boolean);

  return {
    area: METRO.name,
    month: monthKey(m.month_date_yyyymm),
    monthLabel: monthLabel(monthKey(m.month_date_yyyymm)),
    medianListPrice: num(m.median_listing_price),
    medianListPriceYoY: pct(m.median_listing_price_yy),
    activeListings: num(m.active_listing_count),
    activeListingsYoY: pct(m.active_listing_count_yy),
    newListings: num(m.new_listing_count),
    pendingListings: num(m.pending_listing_count),
    daysOnMarket: num(m.median_days_on_market),
    daysOnMarketYearAgo: priorDom,
    priceReducedShare: pct(m.price_reduced_share),
    pricePerSqft: num(m.median_listing_price_per_square_foot),
    medianSqft: num(m.median_square_feet),
    history: metroRows.slice(0, 13).reverse().map((r) => ({
      month: monthKey(r.month_date_yyyymm),
      medianListPrice: num(r.median_listing_price),
      activeListings: num(r.active_listing_count),
      daysOnMarket: num(r.median_days_on_market),
    })),
    counties,
  };
}

async function fredSeries(id) {
  return parseCsv(await getText(FRED(id)))
    .map((r) => ({ date: r.observation_date || r.DATE, value: num(r[id]) }))
    .filter((r) => r.date && r.value !== null);
}

async function rateData() {
  const [thirty, fifteen] = await Promise.all([fredSeries("MORTGAGE30US"), fredSeries("MORTGAGE15US")]);
  const last = thirty[thirty.length - 1];
  const yearAgo = thirty.length > 52 ? thirty[thirty.length - 53] : null;
  return {
    date: last.date,
    thirtyYear: last.value,
    fifteenYear: fifteen.length ? fifteen[fifteen.length - 1].value : null,
    thirtyYearYearAgo: yearAgo ? yearAgo.value : null,
    history: thirty.slice(-53).map((r) => ({ date: r.date, thirtyYear: r.value })),
  };
}

const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
const updown = (p) => (p > 0 ? `up ${Math.abs(p)}%` : p < 0 ? `down ${Math.abs(p)}%` : "unchanged");

function writeHeadlines(l, r) {
  const h = [];
  if (l) {
    h.push(`The typical home for sale on the Mississippi Gulf Coast was listed at ${money(l.medianListPrice)} in ${l.monthLabel}` +
      (l.medianListPriceYoY !== null ? `, ${updown(l.medianListPriceYoY)} from a year earlier.` : "."));
    const a = l.activeListingsYoY;
    h.push(`There were ${l.activeListings.toLocaleString("en-US")} homes for sale` +
      (a === null ? "." : a === 0 ? ", about the same as a year ago." : `, ${Math.abs(a)}% ${a > 0 ? "more" : "fewer"} than a year ago.`));
    if (l.daysOnMarket) {
      h.push(`Homes sat on the market for a typical ${l.daysOnMarket} days` +
        (l.daysOnMarketYearAgo ? `, compared with ${l.daysOnMarketYearAgo} days a year ago.` : "."));
    }
    if (l.priceReducedShare) h.push(`About ${Math.round(l.priceReducedShare)}% of listings had a price cut during the month.`);
  }
  if (r) {
    h.push(`The average 30-year mortgage rate was ${r.thirtyYear.toFixed(2)}% the week of ${dayLabel(r.date)}` +
      (r.thirtyYearYearAgo ? `, compared with ${r.thirtyYearYearAgo.toFixed(2)}% a year ago.` : "."));
  }
  return h;
}

function writeSocialPost(l, r) {
  const lines = ["Mississippi Gulf Coast market update" + (l ? ` (${l.monthLabel})` : "")];
  if (l) {
    lines.push(`🏠 Typical list price: ${money(l.medianListPrice)}` + (l.medianListPriceYoY !== null ? ` (${l.medianListPriceYoY > 0 ? "+" : ""}${l.medianListPriceYoY}% vs last year)` : ""));
    lines.push(`📋 Homes for sale: ${l.activeListings.toLocaleString("en-US")}` + (l.activeListingsYoY !== null ? ` (${l.activeListingsYoY > 0 ? "+" : ""}${l.activeListingsYoY}%)` : ""));
    if (l.daysOnMarket) lines.push(`⏱️ Typical days on market: ${l.daysOnMarket}`);
  }
  if (r) lines.push(`💵 30-year mortgage rate: ${r.thirtyYear.toFixed(2)}%`);
  lines.push("Thinking about buying or selling? Ask me what your home is worth.");
  return lines.join("\n");
}

async function main() {
  let previous = null;
  try { previous = JSON.parse(await readFile(OUT, "utf8")); } catch { /* first run */ }

  // If one source is down this week, keep last week's numbers for it instead of failing.
  let listings = previous?.listings ?? null;
  let rates = previous?.rates ?? null;
  const problems = [];
  try { listings = await listingData(); } catch (e) { problems.push("listings: " + e.message); }
  try { rates = await rateData(); } catch (e) { problems.push("rates: " + e.message); }
  if (!listings && !rates) throw new Error("No market data could be fetched:\n" + problems.join("\n"));
  problems.forEach((p) => console.warn("Kept previous data for " + p));

  const data = {
    updated: previous?.updated ?? null,
    area: "Mississippi Gulf Coast (Gulfport-Biloxi metro: Harrison, Hancock, Jackson and Stone counties)",
    headlines: writeHeadlines(listings, rates),
    socialPost: writeSocialPost(listings, rates),
    listings,
    rates,
    sources: [
      { name: "Realtor.com Economic Research, monthly housing inventory data", url: "https://www.realtor.com/research/data/" },
      { name: "Freddie Mac Primary Mortgage Market Survey, via FRED (Federal Reserve Bank of St. Louis)", url: "https://fred.stlouisfed.org/series/MORTGAGE30US" },
    ],
  };

  const same = previous && JSON.stringify({ ...previous, updated: null }) === JSON.stringify({ ...data, updated: null });
  if (same) { console.log("Market data unchanged."); return; }
  data.updated = new Date().toISOString().slice(0, 10);
  await writeFile(OUT, JSON.stringify(data, null, 2) + "\n");
  console.log("Wrote data/market.json\n" + data.headlines.join("\n"));
}

main().catch((e) => { console.error(e); process.exit(1); });
