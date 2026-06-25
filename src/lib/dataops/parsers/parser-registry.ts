// Parser registry (§15, §17). Routing is by ParserHandler.supports().

import type { ParserHandler } from "./parser-types";
import type { RawAsset } from "@/types/dataops";
import { jsonParser } from "./json-parser";
import { csvParser } from "./csv-parser";
import { xmlParser } from "./xml-parser";
import { xlsxParser } from "./xlsx-parser";
import { pdfParser } from "./pdf-parser";
import { docxParser } from "./docx-parser";
import { emlParser } from "./eml-parser";
import { imageOcrParser } from "./image-ocr-parser";
import { textParser } from "./text-parser";

// Specialized parsers precede the text fallback so kinds like pdf/docx/eml/html
// route to their dedicated handler rather than the generic text parser.
const handlers: ParserHandler[] = [
  jsonParser,
  csvParser,
  xmlParser,
  xlsxParser,
  pdfParser,
  docxParser,
  emlParser,
  imageOcrParser,
  textParser,
];

export function registerParser(handler: ParserHandler): void {
  handlers.unshift(handler); // most-recently registered wins
}

export function resolveParser(asset: RawAsset): ParserHandler | undefined {
  return handlers.find((h) => h.supports(asset));
}

export function hasParser(key: string): boolean {
  return handlers.some((h) => h.key === key);
}

export function listParsers(): ParserHandler[] {
  return [...handlers];
}
