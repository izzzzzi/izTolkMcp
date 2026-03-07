#!/usr/bin/env node
import { readFileSync, writeFileSync } from "fs";

const version = process.argv[2];
if (!version) {
  console.error("Usage: update-server-json.js <version>");
  process.exit(1);
}

const data = JSON.parse(readFileSync("server.json", "utf-8"));
data.version = version;
data.packages[0].version = version;
writeFileSync("server.json", `${JSON.stringify(data, null, 2)}\n`);
console.log(`Updated server.json to ${version}`);
