import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");

// Copy manifest.json
fs.copyFileSync(path.join(root, "manifest.json"), path.join(dist, "manifest.json"));

// Copy icons
const iconsDir = path.join(dist, "icons");
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });
for (const size of ["16", "48", "128"]) {
  fs.copyFileSync(
    path.join(root, "public", "icons", `${size}.png`),
    path.join(iconsDir, `${size}.png`)
  );
}

// Move popup HTML from nested path to root and fix paths
const popupSrc = path.join(dist, "src", "popup", "index.html");
if (fs.existsSync(popupSrc)) {
  let html = fs.readFileSync(popupSrc, "utf-8");
  html = html.replace(/src="[^"]*\/popup\.js"/g, 'src="./popup.js"');
  html = html.replace(/href="[^"]*\/chunks\//g, 'href="./chunks/');
  html = html.replace(/src="[^"]*\/chunks\//g, 'src="./chunks/');
  fs.writeFileSync(path.join(dist, "popup.html"), html);
}

// Move sidepanel HTML from nested path to root and fix paths
const sidepanelSrc = path.join(dist, "src", "popup", "sidepanel.html");
if (fs.existsSync(sidepanelSrc)) {
  let spHtml = fs.readFileSync(sidepanelSrc, "utf-8");
  spHtml = spHtml.replace(/src="[^"]*\/sidepanel\.js"/g, 'src="./sidepanel.js"');
  spHtml = spHtml.replace(/src="[^"]*\/popup\.js"/g, 'src="./popup.js"');
  spHtml = spHtml.replace(/href="[^"]*\/chunks\//g, 'href="./chunks/');
  spHtml = spHtml.replace(/src="[^"]*\/chunks\//g, 'src="./chunks/');
  fs.writeFileSync(path.join(dist, "sidepanel.html"), spHtml);
}

// Clean up nested src directory after extracting HTML files
const srcDir = path.join(dist, "src");
if (fs.existsSync(srcDir)) {
  fs.rmSync(srcDir, { recursive: true, force: true });
}

console.log("Post-build: manifest, icons, popup.html, sidepanel.html copied to dist/");
