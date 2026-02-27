import fs from "node:fs";
import path from "node:path";

const appVersionFile = path.resolve("src/components/layout/AppVersion.tsx");

const source = fs.readFileSync(appVersionFile, "utf8");
const match = source.match(/const version = "(\d+)\.(\d+)\.(\d+)"/);

if (!match) {
  console.error("[bump:build-version] Could not find version string in AppVersion.tsx");
  process.exit(1);
}

const major = Number.parseInt(match[1], 10);
const minor = Number.parseInt(match[2], 10);
const patch = Number.parseInt(match[3], 10);
const nextPatch = patch + 1;

const currentVersion = `${major}.${minor}.${patch}`;
const nextVersion = `${major}.${minor}.${nextPatch}`;

const updated = source.replace(
  /const version = "\d+\.\d+\.\d+"/,
  `const version = "${nextVersion}"`,
);

fs.writeFileSync(appVersionFile, updated, "utf8");
console.log(`[bump:build-version] ${currentVersion} -> ${nextVersion}`);
