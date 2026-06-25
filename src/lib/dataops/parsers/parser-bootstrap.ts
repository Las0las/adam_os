// Parser bootstrap: ensures every concrete parser is registered. The registry
// already wires these statically; this provides an explicit, idempotent entry
// point for callers that want to guarantee registration (and is safe to call
// repeatedly — parsers already present by key are not re-registered).

import { registerParser, hasParser } from "./parser-registry";
import type { ParserHandler } from "./parser-types";
import { jsonParser } from "./json-parser";
import { csvParser } from "./csv-parser";
import { textParser } from "./text-parser";
import { xmlParser } from "./xml-parser";
import { xlsxParser } from "./xlsx-parser";
import { pdfParser } from "./pdf-parser";
import { docxParser } from "./docx-parser";
import { emlParser } from "./eml-parser";
import { imageOcrParser } from "./image-ocr-parser";

const ALL: ParserHandler[] = [
  jsonParser,
  csvParser,
  textParser,
  xmlParser,
  xlsxParser,
  pdfParser,
  docxParser,
  emlParser,
  imageOcrParser,
];

let bootstrapped = false;

export function bootstrapParsers(): void {
  if (bootstrapped) return;
  for (const handler of ALL) {
    if (!hasParser(handler.key)) registerParser(handler);
  }
  bootstrapped = true;
}
