// One place that loads listings. Every page asks this file for houses.
//
// It first asks /api/listings (live Flexmls listings via the Spark API).
// If that isn't set up yet or fails, it falls back to the sample houses in
// data/listings.json, and LISTINGS_ARE_SAMPLE stays true so pages can say so.
let LISTINGS_ARE_SAMPLE = true;
let listingsPromise;

async function loadJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url}`);
  return res.json();
}

function getListings() {
  if (!listingsPromise) {
    listingsPromise = loadJson("/api/listings")
      .then((live) => {
        if (!Array.isArray(live) || !live.length) throw new Error("No live listings");
        LISTINGS_ARE_SAMPLE = false;
        document.documentElement.classList.add("live-listings");
        return live;
      })
      .catch(() => loadJson("data/listings.json"));
  }
  return listingsPromise;
}

async function getListing(id) {
  const all = await getListings();
  return all.find((l) => l.id === id);
}

function formatPrice(n) {
  return "$" + Number(n).toLocaleString("en-US");
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function factsLine(l) {
  if (l.type === "Land") return `${l.lotAcres} acres · Land`;
  return `${l.beds} bd · ${l.baths} ba · ${Number(l.sqft).toLocaleString()} sqft`;
}

function listingCard(l) {
  const badgeClass = l.status === "Pending" ? "badge pending" : "badge";
  return `
    <a class="card" href="listing.html?id=${encodeURIComponent(l.id)}">
      <img src="${escapeHtml(l.photos[0])}" alt="Photo of ${escapeHtml(l.address)}" loading="lazy">
      <div class="card-body">
        <span class="${badgeClass}">${escapeHtml(l.status)}</span>
        <div class="price">${formatPrice(l.price)}</div>
        <div class="facts">${factsLine(l)}</div>
        <p class="address">${escapeHtml(l.address)}, ${escapeHtml(l.city)}, ${escapeHtml(l.state)} ${escapeHtml(l.zip)}</p>
      </div>
    </a>`;
}
