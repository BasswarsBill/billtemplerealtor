# Bill Temple, Realtor website

Plain static site (HTML, CSS, vanilla JavaScript). No build step. Deploys to Vercel as-is.

## Pages
- `index.html` home page with newest listings
- `listings.html` search and filter homes for sale
- `listing.html?id=...` one home's details
- `forms.html` client forms (built separately in `forms/`)

## Listings
All pages load houses through `js/listings-data.js`. Right now it reads sample data from
`data/listings.json`. When MLS/IDX feed access is approved, a Vercel function at
`api/listings.js` will fetch from the MLS and return the same shape, and `LISTINGS_SOURCE`
switches to `/api/listings`.

## Editing contact details
Agent name, brokerage, phone and email are in `js/site.js` (`SITE`).

## Run locally
`npx serve .` (or any static server), then open http://localhost:3000.
