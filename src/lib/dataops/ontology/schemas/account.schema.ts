// Account canonical schema (ONT-001) — models clients. Required: title (the
// account/client name). Status domain: active | prospect | at_risk | churned |
// inactive. Extra properties pass through.

import { z } from "zod";
import type { CanonicalObjectSchema } from "./types";

export const ACCOUNT_STATUS = [
  "active",
  "prospect",
  "at_risk",
  "churned",
  "inactive",
] as const;

const properties = z.object({}).passthrough();

export const accountSchema: CanonicalObjectSchema = {
  objectType: "Account",
  requireTitle: true,
  status: z.enum(ACCOUNT_STATUS),
  properties,
};
