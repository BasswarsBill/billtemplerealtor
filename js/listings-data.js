// One place that loads listings. Every page asks this file for houses.
//
// TODAY: reads sample houses from data/listings.json.
// LATER: once MLS/IDX feed access is approved, switch LISTINGS_SOURCE to "/api/listings"
// (a small Vercel function that pulls from the MLS and returns the same shape of data).
// Nothing else on the site needs to change.
const LISTINGS_SOURCE = "data/listings.json";

async function getListings() {
  const res = await fetch(LISTINGS_SOURCE);
  if (!res.ok) throw new Error("Could not load listings");
  return res.json();
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
