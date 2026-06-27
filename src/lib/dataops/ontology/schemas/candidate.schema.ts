// Candidate canonical schema (ONT-001). Required: at least one of fullName|email.
// Status domain: new | active | placed | archived. Extra properties pass through.

import { z } from "zod";
import type { CanonicalObjectSchema } from "./types";

export const CANDIDATE_STATUS = ["new", "active", "placed", "archived"] as const;

const properties = z
  .object({
    fullName: z.string().min(1).nullish(),
    email: z.string().min(1).nullish(),
  })
  .passthrough()
  .superRefine((val, ctx) => {
    if (!val.fullName && !val.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fullName"],
        message: "Candidate SHALL have at least one of fullName or email",
      });
    }
  });

export const candidateSchema: CanonicalObjectSchema = {
  objectType: "Candidate",
  requireTitle: false, // title = fullName ?? email ?? externalKey (derived, not required)
  status: z.enum(CANDIDATE_STATUS),
  properties,
};
