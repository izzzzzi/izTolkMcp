import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const contentDir = join(dirname(fileURLToPath(import.meta.url)), "content");

const cache = new Map<string, string>();

export function loadContent(filename: string): string {
  let text = cache.get(filename);
  if (text === undefined) {
    text = readFileSync(join(contentDir, filename), "utf-8");
    cache.set(filename, text);
  }
  return text;
}
