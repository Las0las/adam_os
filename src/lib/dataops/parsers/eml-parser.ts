import { simpleParser } from "mailparser";
import type { ParserHandler, CanonicalParseOutput } from "./parser-types";
import type { RawAsset } from "@/types/dataops";
import { detectFileKind } from "../ingestion/file-kind-detector";
import { loadAssetBytes } from "./load-bytes";

export const emlParser: ParserHandler = {
  key: "eml",
  supports: (asset: RawAsset) => asset.kind === "eml",
  async parse(asset: RawAsset): Promise<CanonicalParseOutput> {
    const bytes = await loadAssetBytes(asset);
    const mail = await simpleParser(bytes);

    const toText = (
      v: { text: string } | { text: string }[] | undefined,
    ): string | undefined => (Array.isArray(v) ? v.map((x) => x.text).join(", ") : v?.text);

    const childAssets: NonNullable<CanonicalParseOutput["childAssets"]> = (
      mail.attachments ?? []
    ).map((att) => {
      const fileName = att.filename ?? "attachment";
      return {
        kind: detectFileKind(att.filename ?? "att", att.contentType),
        fileName,
        mimeType: att.contentType ?? null,
        content: att.content.toString("base64"),
        metadata: { attachment: true },
      };
    });

    return {
      document: {
        documentType: "email_message",
        title: mail.subject ?? null,
        textContent: mail.text ?? "",
        metadata: {
          from: mail.from?.text,
          to: toText(mail.to),
          cc: toText(mail.cc),
          subject: mail.subject,
          date: mail.date ? mail.date.toISOString() : null,
          messageId: mail.messageId,
        },
      },
      childAssets,
    };
  },
};
