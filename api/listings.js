// Vercel serverless function: returns live MLS listings from Flexmls (Spark API)
// in the same shape as data/listings.json, so the site's pages don't change.
//
// Settings (add in Vercel > Project > Settings > Environment Variables):
//   SPARK_ACCESS_TOKEN   IDX access token from sparkplatform.com (required)
//   SPARK_API_BASE       optional, defaults to https://sparkapi.com
//   LISTINGS_LIMIT       optional, max homes to show (default 200)
//
// Until SPARK_ACCESS_TOKEN is set this returns 503 and the site keeps
// showing the sample houses.

const SELECT = [
  "ListingKey", "ListingId", "StandardStatus", "ListPrice", "UnparsedAddress",
  "City", "StateOrProvince", "PostalCode", "BedroomsTotal", "BathroomsTotalInteger",
  "LivingArea", "LotSizeAcres", "YearBuilt", "PropertyType", "PropertySubType",
  "PublicRemarks", "OnMarketDate", "ListOfficeName",
].join(",");

function mapType(p) {
  const sub = (p.PropertySubType || "").toLowerCase();
  const type = (p.PropertyType || "").toLowerCase();
  if (type.includes("land") || sub.includes("land") || sub.includes("lot")) return "Land";
  if (sub.includes("condo")) return "Condo";
  if (sub.includes("town")) return "Townhouse";
  if (type.includes("residential")) return "Single Family";
  return p.PropertySubType || p.PropertyType || "Other";
}

function mapListing(p) {
  const photos = (p.Media || [])
    .filter((m) => m.MediaURL && (!m.MediaCategory || /photo/i.test(m.MediaCategory)))
    .sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0))
    .map((m) => m.MediaURL);
  const street = (p.UnparsedAddress || "").split(",")[0].trim();
  return {
    id: p.ListingId || p.ListingKey,
    status: p.StandardStatus === "Active Under Contract" ? "Pending" : p.StandardStatus || "Active",
    price: p.ListPrice || 0,
    address: street,
    city: p.City || "",
    state: p.StateOrProvince || "",
    zip: p.PostalCode || "",
    beds: p.BedroomsTotal || 0,
    baths: p.BathroomsTotalInteger || 0,
    sqft: p.LivingArea || 0,
    lotAcres: p.LotSizeAcres || 0,
    yearBuilt: p.YearBuilt || null,
    type: mapType(p),
    photos: photos.length ? photos : ["images/house1.svg"],
    description: p.PublicRemarks || "",
    listDate: (p.OnMarketDate || "").slice(0, 10),
    listOffice: p.ListOfficeName || "",
  };
}

module.exports = async function handler(req, res) {
  const token = process.env.SPARK_ACCESS_TOKEN;
  if (!token) return res.status(503).json({ error: "MLS feed not configured yet." });

  const base = process.env.SPARK_API_BASE || "https://sparkapi.com";
  const limit = Math.min(parseInt(process.env.LISTINGS_LIMIT, 10) || 200, 1000);
  const params = new URLSearchParams({
    $filter: "StandardStatus eq 'Active' or StandardStatus eq 'Active Under Contract' or StandardStatus eq 'Pending'",
    $select: SELECT,
    $expand: "Media",
    $orderby: "OnMarketDate desc",
    $top: String(limit),
  });

  try {
    const r = await fetch(`${base}/Reso/OData/Property?${params}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!r.ok) {
      const detail = (await r.text()).slice(0, 300);
      console.error("Spark API error", r.status, detail);
      return res.status(502).json({ error: "MLS feed error." });
    }
    const data = await r.json();
    const listings = (data.value || []).map(mapListing);
    // Cache at Vercel's edge for 15 minutes so the MLS isn't hit on every visit.
    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=3600");
    return res.status(200).json(listings);
  } catch (err) {
    console.error("Spark API request failed", err);
    return res.status(502).json({ error: "MLS feed unavailable." });
  }
};
