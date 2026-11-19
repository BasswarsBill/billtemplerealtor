// Builds the neighborhood guides:
//   data/neighborhoods.json        everything about each town in one file (words + numbers + a social post)
//   neighborhoods.html             the list of all guides, with a map
//   neighborhoods/<town>.html      one guide page per town
//   media/towns/map-<town>.svg     a small map tile for each town (used until there is a photo)
//
// The words come from data/towns.json (edit that file, not the pages).
// The numbers come from free public sources, no keys needed:
//   U.S. Census Bureau, American Community Survey 5-year summary files (homes, rents, commute; new once a year)
//   Realtor.com Economic Research, monthly listing data by ZIP code
//
// Runs automatically from GitHub every week (.github/workflows/update-neighborhoods.yml) and
// whenever data/towns.json changes. Run by hand with:  node scripts/update-neighborhoods.mjs
// Add --offline to rebuild the pages from the numbers already saved, without fetching anything.

import { readFile, writeFile, mkdir } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const file = (p) => new URL(p, ROOT);
const OFFLINE = process.argv.includes("--offline");

// The address people use to reach the site. Used in social posts and page links.
const SITE_URL = "https://www.billtemplerealtor.com";

const ZIP_CSV = "https://econdata.s3-us-west-2.amazonaws.com/Reports/Core/RDC_Inventory_Core_Metrics_Zip.csv";
// Census summary files: one file per table, covering every place in the country. Read once a year
// (when a new 5-year release comes out); the API needs a key, these files don't.
const SF = (year) => `https://www2.census.gov/programs-surveys/acs/summary_file/${year}/table-based-SF`;
const SF_TABLE = (year, table) => `${SF(year)}/data/5YRData/acsdt5y${year}-${table.toLowerCase()}.dat`;
const SF_GEOS = (year) => `${SF(year)}/documentation/Geos${year}5YR.txt`;
const CENSUS_VARS = {
  population: "B01003_E001",
  housingUnits: "B25001_E001",
  occupiedUnits: "B25003_E001",
  ownerOccupied: "B25003_E002",
  medianHomeValue: "B25077_E001",
  medianRent: "B25064_E001",
  medianYearBuilt: "B25035_E001",
  commuteMinutesTotal: "B08013_E001",
  commuters: "B08303_E001",
};
const MS_STATE = "0400000US28";
const MS_PLACE = "1600000US28";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthLabel = (yyyymm) => `${MONTHS[Number(yyyymm.slice(4, 6)) - 1]} ${yyyymm.slice(0, 4)}`;
const num = (v) => (v === undefined || v === null || v === "" || isNaN(Number(v)) || Number(v) < -1e6 ? null : Number(v));
const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
const count = (n) => Math.round(n).toLocaleString("en-US");

async function get(url) {
  const r = await fetch(url, { headers: { "User-Agent": "realtor-site-neighborhood-guides" } });
  if (!r.ok) throw new Error(`${url.split("?")[0]} answered ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const split = (line) => {
    const out = []; let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c;
    }
    out.push(cur); return out;
  };
  const head = split(lines[0]);
  return lines.slice(1).map((l) => { const r = split(l); return Object.fromEntries(head.map((h, i) => [h, r[i]])); });
}

// ---------- Census ----------
// Streams a big pipe-delimited Census file and keeps only the Mississippi rows we need.
async function msRows(url, keep) {
  const r = await get(url);
  const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "", head = null;
  const rows = [];
  for (;;) {
    const { value, done } = await reader.read();
    buf += value || "";
    const lines = buf.split(/\r?\n/);
    buf = done ? "" : lines.pop();
    for (const line of lines) {
      if (!line) continue;
      if (!head) { head = line.split("|"); continue; }
      if (!keep(line)) continue;
      const cells = line.split("|");
      rows.push(Object.fromEntries(head.map((h, i) => [h, cells[i]])));
    }
    if (done) break;
  }
  return rows;
}

async function newestCensusYear() {
  const thisYear = new Date().getFullYear();
  for (let year = thisYear - 1; year >= thisYear - 4; year--) {
    const r = await fetch(SF_TABLE(year, "B01003"), { method: "HEAD" }).catch(() => null);
    if (r && r.ok) return year;
  }
  throw new Error("No American Community Survey summary files found");
}

async function censusData(towns, previous) {
  const year = await newestCensusYear();
  if (previous && previous.year === year && towns.every((t) => previous.towns[t.slug])) return previous; // nothing new
  const wanted = (line) => line.startsWith(MS_PLACE) || line.startsWith(MS_STATE);
  const values = {};
  for (const table of [...new Set(Object.values(CENSUS_VARS).map((v) => v.split("_")[0]))]) {
    for (const row of await msRows(SF_TABLE(year, table), wanted)) Object.assign((values[row.GEO_ID] ??= {}), row);
  }
  const geoRows = await msRows(SF_GEOS(year), (line) => line.includes(MS_PLACE));
  const names = Object.fromEntries(geoRows.map((g) => [(g.NAME || "").replace(/[\u2018\u2019]/g, "'"), g.GEO_ID]));

  const shape = (r) => {
    const v = Object.fromEntries(Object.entries(CENSUS_VARS).map(([k, id]) => [k, num(r?.[id])]));
    return {
      population: v.population,
      housingUnits: v.housingUnits,
      ownerShare: v.occupiedUnits ? Math.round((v.ownerOccupied / v.occupiedUnits) * 100) : null,
      medianHomeValue: v.medianHomeValue,
      medianRent: v.medianRent,
      medianYearBuilt: v.medianYearBuilt,
      commuteMinutes: v.commuters ? Math.round((v.commuteMinutesTotal / v.commuters) * 10) / 10 : null,
    };
  };
  const out = { year, survey: `${year - 4}-${year} American Community Survey 5-year estimates`, mississippi: shape(values[MS_STATE]), towns: {} };
  for (const t of towns) {
    const id = t.censusGeoId || names[t.censusName];
    if (!id || !values[id]) { console.warn(`Census: no place named "${t.censusName}"`); continue; }
    out.towns[t.slug] = { ...shape(values[id]), geoid: id };
  }
  if (!Object.keys(out.towns).length) throw new Error(`Census ${year}: none of the towns were found`);
  return out;
}

// ---------- Realtor.com listings by ZIP ----------
async function zipData(towns) {
  const want = new Set(towns.flatMap((t) => t.zips));
  const rows = parseCsv(await (await get(ZIP_CSV)).text()).filter((r) => want.has(r.postal_code));
  if (!rows.length) throw new Error("None of the ZIP codes were in the Realtor.com file");
  const month = rows.map((r) => r.month_date_yyyymm).sort().pop();
  const zips = {};
  for (const r of rows.filter((x) => x.month_date_yyyymm === month)) {
    const yy = num(r.median_listing_price_yy);
    zips[r.postal_code] = {
      area: r.zip_name.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/, Ms$/, "").replace("Diberville", "D'Iberville").replace("Bay Saint Louis", "Bay St. Louis"),
      medianListPrice: num(r.median_listing_price),
      medianListPriceYoY: yy === null ? null : Math.round(yy * 1000) / 10,
      activeListings: num(r.active_listing_count),
      daysOnMarket: num(r.median_days_on_market),
      pricePerSqft: num(r.median_listing_price_per_square_foot),
      lowVolume: r.quality_flag === "1",
    };
  }
  return { month: `${month.slice(0, 4)}-${month.slice(4, 6)}`, monthLabel: monthLabel(month), zips };
}

// ---------- Maps ----------
const K = Math.cos((30.4 * Math.PI) / 180);
function projector(view, width) {
  const [w, s, e, n] = view;
  const scale = width / ((e - w) * K);
  return { scale, height: Math.round((n - s) * scale), p: ([lon, lat]) => [+((lon - w) * K * scale).toFixed(1), +((n - lat) * scale).toFixed(1)] };
}
function landPath(rings, p) {
  return rings.map((r) => "M" + r.map((pt) => p(pt).join(" ")).join("L") + "Z").join("");
}
// view = [west, south, east, north]
function mapSvg(coast, towns, view, width, opts = {}) {
  const { p, height } = projector(view, width);
  const dots = towns.map((t) => {
    const [x, y] = p([t.lon, t.lat]);
    const on = t.slug === opts.highlight;
    const label = opts.labels === false ? "" :
      `<text x="${x}" y="${y - (on ? 22 : 14)}" class="${on ? "map-label on" : "map-label"}" text-anchor="middle">${esc(t.name)}</text>`;
    const dot = on
      ? `<circle cx="${x}" cy="${y}" r="16" class="map-ring"/><circle cx="${x}" cy="${y}" r="7" class="map-dot on"/>`
      : `<circle cx="${x}" cy="${y}" r="${opts.small ? 3.5 : 6}" class="map-dot"/>`;
    return opts.link ? `<a href="neighborhoods/${t.slug}.html" aria-label="${esc(t.name)} neighborhood guide">${dot}${label}</a>` : dot + label;
  }).join("");
  const style = opts.inline ? "" :
    `<style>.map-land{fill:#151515;stroke:#3a3a3a;stroke-width:1.2}.map-dot{fill:#5d7f92}.map-dot.on{fill:#9cc9e2}.map-ring{fill:none;stroke:#9cc9e2;stroke-width:1.5;opacity:.6}.map-water{fill:#03080b}</style>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"${opts.attrs || ""}>${style}<rect class="map-water" width="100%" height="100%"/><path class="map-land" fill-rule="evenodd" d="${landPath(coast.rings, p)}"/>${dots}</svg>`;
}
const around = (t, wDeg, hDeg) => [t.lon - wDeg / 2, t.lat - hDeg / 2, t.lon + wDeg / 2, t.lat + hDeg / 2];

// ---------- Writing ----------
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function townSummary(t, zips) {
  const zs = t.zips.map((z) => zips?.zips[z]).filter(Boolean);
  const active = zs.reduce((s, z) => s + (z.activeListings || 0), 0);
  const prices = zs.map((z) => z.medianListPrice).filter(Boolean);
  return { activeListings: zs.length ? active : null, priceLow: prices.length ? Math.min(...prices) : null, priceHigh: prices.length ? Math.max(...prices) : null };
}
const priceRange = (s) => (s.priceLow === null ? null : s.priceLow === s.priceHigh ? money(s.priceLow) : `${money(s.priceLow)} to ${money(s.priceHigh)}`);

function socialPost(t, c, s, zips) {
  const lines = [`Neighborhood spotlight: ${t.name}, Mississippi`, t.tagline];
  if (s.activeListings !== null) lines.push(`🏠 Homes for sale: ${count(s.activeListings)} (${zips.monthLabel})`);
  if (priceRange(s)) lines.push(`🏷️ Typical list price: ${priceRange(s)}${t.zips.length > 1 ? " depending on ZIP code" : ""}`);
  if (c?.commuteMinutes) lines.push(`🚗 Average commute: ${Math.round(c.commuteMinutes)} minutes`);
  if (t.highlights?.[0]) lines.push(`📍 Don't miss: ${t.highlights[0].name}`);
  lines.push(`Full guide: ${SITE_URL}/neighborhoods/${t.slug}.html`);
  return lines.join("\n");
}

function head(title, description, path) {
  return `<!doctype html>
<!-- Built by scripts/update-neighborhoods.mjs. Do not edit this file: change data/towns.json instead. -->
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base href="/">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${SITE_URL}/${path}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${SITE_URL}/${path}">
  <meta property="og:site_name" content="Bill Temple, Realtor">
  <meta property="og:image" content="${SITE_URL}/media/hero-poster.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="stylesheet" href="css/styles.css">
</head>`;
}
const FOOT = `
  <div id="site-footer"></div>
  <script src="js/site.js"></script>
</body>
</html>
`;
const FAIR_HOUSING = `<p class="fair-housing">Bill Temple and Epique Realty are committed to equal housing opportunity. This guide describes places, homes and public data. It does not describe or rate the people who live in any area, and it is not a recommendation of where anyone should live. Every buyer is welcome to look at homes anywhere.</p>`;

function townPage(t, all, data) {
  const c = data.census?.towns[t.slug];
  const ms = data.census?.mississippi;
  const s = townSummary(t, data.zips);
  const m = t.media || {};
  const description = `${t.name}, Mississippi neighborhood guide: homes for sale, typical prices, schools, commute and places to know in ${t.name}, ${t.county}.`;

  const heroBg = m.video
    ? `<video class="hero-media" src="${esc(m.video)}"${m.poster ? ` poster="${esc(m.poster)}"` : ""} autoplay muted loop playsinline preload="metadata" aria-hidden="true"></video>`
    : m.photo
      ? `<img class="hero-media" src="${esc(m.photo)}" alt="">`
      : mapSvg(data.coast, all, around(t, 0.42, 0.2), 1200, { highlight: t.slug, inline: true, attrs: ' class="hero-media town-map" preserveAspectRatio="xMidYMid slice" aria-hidden="true"' });

  const stats = [];
  if (s.activeListings !== null) stats.push([count(s.activeListings), "Homes for sale", data.zips.monthLabel]);
  if (c?.medianHomeValue) stats.push([money(c.medianHomeValue), "Median home value", "Owner estimate, Census"]);
  if (c?.commuteMinutes) stats.push([`${Math.round(c.commuteMinutes)} min`, "Average commute", "One way, Census"]);
  if (c?.medianYearBuilt) stats.push([String(c.medianYearBuilt), "Typical year built", "Median, Census"]);

  const vsMs = (v, f) => (ms && ms[f] ? ` <em>Mississippi: ${f.startsWith("median") && f !== "medianYearBuilt" ? money(ms[f]) : ms[f]}</em>` : "");
  const glance = c ? [
    ["Population", count(c.population)],
    ["Homes (housing units)", count(c.housingUnits)],
    ["Owner-occupied homes", `${c.ownerShare}%${ms ? ` <em>Mississippi: ${ms.ownerShare}%</em>` : ""}`],
    ["Median home value", money(c.medianHomeValue) + vsMs(c.medianHomeValue, "medianHomeValue")],
    ["Median rent", money(c.medianRent) + vsMs(c.medianRent, "medianRent")],
    ["Average commute", `${c.commuteMinutes} minutes${ms ? ` <em>Mississippi: ${ms.commuteMinutes}</em>` : ""}`],
    ["ZIP codes", t.zips.join(", ")],
  ] : [["County", t.county], ["ZIP codes", t.zips.join(", ")]];

  const zipRows = t.zips.map((z) => {
    const r = data.zips?.zips[z];
    if (!r) return "";
    const yy = r.medianListPriceYoY === null ? "" : `${r.medianListPriceYoY > 0 ? "+" : ""}${r.medianListPriceYoY}%`;
    return `<tr><th scope="row">${z}${r.lowVolume ? "*" : ""} <span>${esc(r.area)}</span></th><td>${r.medianListPrice ? money(r.medianListPrice) : "–"}</td><td>${yy}</td><td>${r.activeListings ?? "–"}</td><td>${r.daysOnMarket ?? "–"}</td><td>${r.pricePerSqft ? "$" + r.pricePerSqft : "–"}</td></tr>`;
  }).join("");
  const lowVol = t.zips.some((z) => data.zips?.zips[z]?.lowVolume);

  const nearby = (t.nearby || []).map((slug) => all.find((x) => x.slug === slug)).filter(Boolean);

  return `${head(`${t.name}, MS Neighborhood Guide | Bill Temple, Realtor`, description, `neighborhoods/${t.slug}.html`)}
<body class="home town">
  <div id="site-header"></div>

  <div class="hero town-hero${m.video || m.photo ? "" : " is-map"}">
    ${heroBg}
    <div class="container">
      <p class="eyebrow"><a href="neighborhoods.html">Neighborhood guides</a> · ${esc(t.county)}</p>
      <h1>${esc(t.name)}</h1>
      <p>${esc(t.tagline)}</p>
      <div class="actions">
        <a class="btn" href="listings.html?q=${encodeURIComponent(t.name)}">Homes for sale in ${esc(t.name)}</a>
        <a class="btn secondary" href="home-value.html">What's my home worth?</a>
      </div>
      ${m.credit ? `<p class="media-credit">${esc(m.credit)}</p>` : ""}
    </div>
  </div>

  <main>
    ${stats.length ? `<div class="container"><div class="stats${stats.length === 3 ? " stats-3" : ""}">${stats.map(([v, l, n]) => `<div><strong>${v}</strong><span>${l}</span><em>${esc(n)}</em></div>`).join("")}</div></div>` : ""}

    <section>
      <div class="container town-cols">
        <div class="town-intro">
          <p class="eyebrow">About ${esc(t.name)}</p>
          <h2>Living in ${esc(t.name)}</h2>
          ${t.intro.map((p) => `<p>${esc(p)}</p>`).join("\n          ")}
        </div>
        <aside class="glance">
          <p class="eyebrow">At a glance</p>
          <dl>${glance.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
          ${c ? `<p class="hv-fine">${esc(data.census.survey)}, U.S. Census Bureau.</p>` : ""}
        </aside>
      </div>
    </section>

    <section class="alt">
      <div class="container">
        <p class="eyebrow">Places to know</p>
        <h2>Around ${esc(t.name)}</h2>
        <ul class="places">${t.highlights.map((h) => `<li><strong>${esc(h.name)}</strong><span>${esc(h.text)}</span></li>`).join("")}</ul>
      </div>
    </section>

    ${zipRows ? `<section>
      <div class="container">
        <p class="eyebrow">Homes for sale · ${esc(data.zips.monthLabel)}</p>
        <h2>The market in ${esc(t.name)}</h2>
        <div class="table-wrap">
          <table class="mk-table zip-table">
            <thead><tr><th scope="col">ZIP code</th><th scope="col">Typical list price</th><th scope="col">vs last year</th><th scope="col">Homes for sale</th><th scope="col">Days on market</th><th scope="col">Price per sq ft</th></tr></thead>
            <tbody>${zipRows}</tbody>
          </table>
        </div>
        <p class="hv-fine">Asking prices of homes listed for sale, by ZIP code, from Realtor.com. ZIP codes don't follow city limits exactly.${lowVol ? " *Few listings in this ZIP code, so its numbers can jump around from month to month." : ""}</p>
        <div class="actions"><a class="btn secondary" href="market.html">Gulf Coast market update</a><a class="btn secondary" href="listings.html?q=${encodeURIComponent(t.name)}">See homes for sale</a></div>
      </div>
    </section>` : ""}

    <section class="alt">
      <div class="container town-cols">
        <div>
          <p class="eyebrow">Schools</p>
          <h2>Public school districts</h2>
          <ul class="schools">${t.schools.map((d) => `<li><span class="grade" aria-label="Grade ${esc(d.grade)}">${esc(d.grade)}</span><div><strong>${esc(d.district)}</strong>${d.note ? `<span>${esc(d.note)}</span>` : ""}</div></li>`).join("")}</ul>
          <p class="hv-fine">${esc(data.schoolGradesNote)} Sources: ${data.schoolGradesSources.map((x) => `<a href="${esc(x.url)}" rel="noopener">${esc(x.label)}</a>`).join("; ")}.</p>
        </div>
        <div>
          <p class="eyebrow">Getting around</p>
          <h2>Roads and commute</h2>
          <p class="town-text">${esc(t.gettingAround)}</p>
          ${c?.commuteMinutes ? `<p class="town-text">Workers who live in ${esc(t.name)} spend an average of ${c.commuteMinutes} minutes getting to work, one way${ms ? ` (Mississippi average: ${ms.commuteMinutes})` : ""}.</p>` : ""}
          <p class="eyebrow" style="margin-top:28px">Near the water</p>
          <p class="town-text">Flood zones and insurance costs can change from one street to the next on the Coast. Look up any address on <a href="https://msc.fema.gov/portal/home" rel="noopener">FEMA's flood map</a>, and ask me for help getting insurance quotes before you make an offer.</p>
        </div>
      </div>
    </section>

    <section>
      <div class="container value-band">
        <div>
          <p class="eyebrow">Own a home in ${esc(t.name)}?</p>
          <h2>Find out what it's worth</h2>
          <p class="town-text">Get a free, personal estimate based on recent sales near you, from someone who has bought, fixed up and sold homes on the Coast for more than 15 years.</p>
          <div class="actions"><a class="btn" href="home-value.html">Get my home value</a><a class="btn secondary" href="index.html#contact">Ask me about ${esc(t.name)}</a></div>
        </div>
        ${nearby.length ? `<div>
          <p class="eyebrow">Nearby guides</p>
          <ul class="nearby">${nearby.map((n) => `<li><a href="neighborhoods/${n.slug}.html">${esc(n.name)}</a><span>${esc(n.county)}</span></li>`).join("")}</ul>
          <a class="btn secondary" href="neighborhoods.html" style="margin-top:20px">All neighborhoods</a>
        </div>` : ""}
      </div>
    </section>

    <section class="alt">
      <div class="container market-sources">
        <h2>Where this information comes from</h2>
        <ul>
          ${c ? `<li><a href="https://data.census.gov/profile?g=${c.geoid}" rel="noopener">U.S. Census Bureau, ${esc(data.census.survey)}</a> (population, homes, home values, rents, commute)</li>` : ""}
          ${data.zips ? `<li><a href="https://www.realtor.com/research/data/" rel="noopener">Realtor.com Economic Research</a>, ZIP code listing data for ${esc(data.zips.monthLabel)}</li>` : ""}
          ${data.schoolGradesSources.map((x) => `<li><a href="${esc(x.url)}" rel="noopener">${esc(x.label)}</a></li>`).join("")}
          <li><a href="https://msc.fema.gov/portal/home" rel="noopener">FEMA Flood Map Service Center</a></li>
          <li>Map data © <a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap</a> contributors</li>
        </ul>
        <p>Numbers update automatically every week as new public data comes out. Census figures are estimates averaged over five years. Information is deemed reliable but not guaranteed.</p>
        ${FAIR_HOUSING}
      </div>
    </section>
  </main>
${FOOT}`;
}

function indexPage(all, data) {
  const VIEW = [-89.42, 30.24, -88.74, 30.5];
  const cards = all.map((t) => {
    const s = townSummary(t, data.zips);
    const c = data.census?.towns[t.slug];
    const img = t.media?.photo || `media/towns/map-${t.slug}.svg`;
    const facts = [
      s.activeListings !== null ? `${count(s.activeListings)} homes for sale` : null,
      c?.medianHomeValue ? `Median value ${money(c.medianHomeValue)}` : null,
    ].filter(Boolean).join(" · ");
    return `<a class="town-card" href="neighborhoods/${t.slug}.html">
          <span class="town-card-img" style="background-image:url('${esc(img)}')"></span>
          <span class="town-card-body"><small>${esc(t.county)}</small><strong>${esc(t.name)}</strong><span>${esc(t.tagline)}</span>${facts ? `<em>${facts}</em>` : ""}</span>
        </a>`;
  }).join("\n        ");
  return `${head("Mississippi Gulf Coast Neighborhood Guides | Bill Temple, Realtor", "Guides to Gulfport, Biloxi, Long Beach, Pass Christian, Bay St. Louis, Ocean Springs and D'Iberville: homes for sale, prices, schools, commute and places to know.", "neighborhoods.html")}
<body>
  <div id="site-header"></div>

  <main class="market">
    <section class="market-top">
      <div class="container">
        <p class="eyebrow">Neighborhood guides</p>
        <h1>Get to know the Mississippi Gulf Coast</h1>
        <p class="market-lede">Seven towns along the water, from Bay St. Louis to Ocean Springs. Each guide covers homes for sale, typical prices, public schools, commutes and the places locals know, using public data that updates itself.</p>
      </div>
    </section>

    <div class="container">
      <div class="coast-map">
        ${mapSvg(data.coast, all, VIEW, 1200, { link: true, inline: true, attrs: ' role="img" aria-label="Map of the Mississippi Gulf Coast towns"' })}
      </div>
    </div>

    <section>
      <div class="container">
        <div class="town-grid">
        ${cards}
        </div>
      </div>
    </section>

    <section class="alt">
      <div class="container value-band">
        <div>
          <p class="eyebrow">Buying or selling?</p>
          <h2>Not sure which town fits?</h2>
          <p class="town-text">Tell me what matters to you, like your budget, your commute, being near the water or room for a shop, and I'll help you compare homes across the Coast.</p>
          <div class="actions"><a class="btn" href="index.html#contact">Talk with Bill</a><a class="btn secondary" href="market.html">Market update</a><a class="btn secondary" href="home-value.html">Home value</a></div>
        </div>
        <div class="market-sources">
          <p class="hv-fine">Sources: U.S. Census Bureau American Community Survey; Realtor.com Economic Research; Mississippi Department of Education. Map data © <a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap</a> contributors.</p>
          ${FAIR_HOUSING}
        </div>
      </div>
    </section>
  </main>
${FOOT}`;
}

async function main() {
  const content = JSON.parse(await readFile(file("data/towns.json"), "utf8"));
  const coast = JSON.parse(await readFile(file("data/coast-outline.json"), "utf8"));
  const towns = content.towns;

  let previous = null;
  try { previous = JSON.parse(await readFile(file("data/neighborhoods.json"), "utf8")); } catch { /* first run */ }
  let census = previous?.census ?? null;
  let zips = previous?.zips ?? null;
  if (!OFFLINE) {
    // If a source is down this week, keep last week's numbers for it instead of failing.
    try { census = await censusData(towns, census); } catch (e) { console.warn("Kept previous Census numbers: " + e.message); }
    try { zips = await zipData(towns); } catch (e) { console.warn("Kept previous ZIP numbers: " + e.message); }
  }

  const data = {
    updated: previous?.updated ?? null,
    siteUrl: SITE_URL,
    schoolGradesNote: content.schoolGradesNote,
    schoolGradesSources: content.schoolGradesSources,
    census,
    zips,
    towns: towns.map((t) => {
      const s = townSummary(t, zips);
      return { ...t, url: `${SITE_URL}/neighborhoods/${t.slug}.html`, summary: s, socialPost: socialPost(t, census?.towns[t.slug], s, zips) };
    }),
  };
  const same = previous && JSON.stringify({ ...previous, updated: null }) === JSON.stringify({ ...data, updated: null });
  if (!same) data.updated = new Date().toISOString().slice(0, 10);

  const page = { ...data, coast };
  await mkdir(file("neighborhoods/"), { recursive: true });
  await mkdir(file("media/towns/"), { recursive: true });
  await writeFile(file("data/neighborhoods.json"), JSON.stringify(data, null, 2) + "\n");
  await writeFile(file("neighborhoods.html"), indexPage(towns, page));
  for (const t of towns) {
    await writeFile(file(`neighborhoods/${t.slug}.html`), townPage(t, towns, page));
    await writeFile(file(`media/towns/map-${t.slug}.svg`), mapSvg(coast, towns, around(t, 0.3, 0.195), 600, { highlight: t.slug, labels: false, small: true }));
  }
  console.log(`${same ? "Numbers unchanged. " : ""}Built ${towns.length} neighborhood guides.` +
    (census ? ` Census: ${census.survey}.` : " No Census numbers yet.") + (zips ? ` Listings: ${zips.monthLabel}.` : ""));
}

main().catch((e) => { console.error(e); process.exit(1); });
