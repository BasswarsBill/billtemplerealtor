// Recolors the small town map pictures (media/towns/map-*.svg) to match the
// --map-* and --brand colors at the top of css/styles.css.
// Run after changing site colors:  node scripts/recolor-map-tiles.mjs
// (scripts/update-neighborhoods.mjs does the same thing every week when it rebuilds the guides.)
import { readFile, writeFile, readdir } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const css = await readFile(new URL("css/styles.css", ROOT), "utf8");
const v = (name, fallback) => (css.match(new RegExp(`--${name}:\\s*([^;]+);`)) || [])[1]?.trim() || fallback;
const brand = v("brand", "#9cc9e2");
const style = `<style>.map-land{fill:${v("map-land", "#151515")};stroke:${v("map-edge", "#3a3a3a")};stroke-width:1.2}.map-dot{fill:${v("map-dot", "#5d7f92")}}.map-dot.on{fill:${brand}}.map-ring{fill:none;stroke:${brand};stroke-width:1.5;opacity:.6}.map-water{fill:${v("map-water", "#03080b")}}</style>`;

const dir = new URL("media/towns/", ROOT);
for (const name of await readdir(dir)) {
  if (!/^map-.*\.svg$/.test(name)) continue;
  const f = new URL(name, dir);
  const svg = await readFile(f, "utf8");
  await writeFile(f, svg.replace(/<style>[\s\S]*?<\/style>/, style));
  console.log("recolored", name);
}
