// Ambient declaration for the pdf-parse internal entrypoint. The published
// @types/pdf-parse only covers the package root, not the `/lib/pdf-parse.js`
// subpath we import to avoid the package's debug harness.
declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfParseResult {
    text: string;
    numpages: number;
    info?: unknown;
    metadata?: unknown;
    version?: string;
  }
  function pdf(dataBuffer: Buffer, options?: Record<string, unknown>): Promise<PdfParseResult>;
  export default pdf;
}
