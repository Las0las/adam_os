// Parser registry (§15, §17). Routing is by ParserHandler.supports().

import type { ParserHandler } from "./parser-types";
import type { RawAsset } from "@/types/dataops";
import { jsonParser } from "./json-parser";
import { csvParser } from "./csv-parser";
import { textParser } from "./text-parser";

const handlers: ParserHandler[] = [jsonParser, csvParser, textParser];

export function registerParser(handler: ParserHandler): void {
  handlers.unshift(handler); // most-recently registered wins
}

export function resolveParser(asset: RawAsset): ParserHandler | undefined {
  return handlers.find((h) => h.supports(asset));
}

export function listParsers(): ParserHandler[] {
  return [...handlers];
}
