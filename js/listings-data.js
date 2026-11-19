// One place that loads listings. Every page asks this file for houses.
//
// Homes only show when SITE.showListings is true (js/site.js). Then it asks
// /api/listings (live Flexmls listings via the Spark API). The made-up houses in
// data/listings.json are used only if SITE.sampleListings is also true (testing).
let LISTINGS_ARE_SAMPLE = false;
let listingsPromise;

async function loadJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url}`);
  return res.json();
}

function getListings() {
  if (!listingsPromise) {
    if (!SITE.showListings) return (listingsPromise = Promise.resolve([]));
    listingsPromise = loadJson("/api/listings")
      .then((live) => {
        if (!Array.isArray(live) || !live.length) throw new Error("No live listings");
        LISTINGS_ARE_SAMPLE = false;
        document.documentElement.classList.add("live-listings");
        return live;
      })
      .catch(() => {
        if (!SITE.sampleListings) return [];
        LISTINGS_ARE_SAMPLE = true;
        document.documentElement.classList.add("sample-listings");
        return loadJson("data/listings.json");
      });
  }
  return listingsPromise;
}

// While homes are switched off, the listing pages send visitors to the buyer wish-list form,
// keeping any search they typed (town, price, beds) so the form starts filled in.
function sendToWishListIfNoListings() {
  if (SITE.showListings) return false;
  document.documentElement.style.visibility = "hidden"; // skip a flash of the empty page
  location.replace("find-a-home.html" + location.search);
  return true;
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
