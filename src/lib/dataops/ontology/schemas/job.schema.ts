// Job canonical schema (ONT-001). Required: title (top-level; defaults to
// externalKey at the producer). Status domain: open | on_hold | filled | closed
// | cancelled. Extra properties pass through.

import { z } from "zod";
import type { CanonicalObjectSchema } from "./types";

export const JOB_STATUS = ["open", "on_hold", "filled", "closed", "cancelled"] as const;

const properties = z.object({}).passthrough();

export const jobSchema: CanonicalObjectSchema = {
  objectType: "Job",
  requireTitle: true,
  status: z.enum(JOB_STATUS),
  properties,
};
