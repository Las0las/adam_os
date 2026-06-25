// Recruiting object mapper (§49). Projects normalized candidate-list rows into
// Candidate ontology objects keyed on email.

import type { ObjectMapper } from "./object-mapper-registry";
import { upsertObject } from "./object-service";
import type { ActorContext } from "@/types/platform";
import type { CanonicalRecord, OntologyObject } from "@/types/dataops";

function str(value: unknown): string | null {
  return value == null ? null : String(value);
}

export const recruitingObjectMapper: ObjectMapper = {
  key: "recruiting",
  async map(ctx: ActorContext, record: CanonicalRecord): Promise<OntologyObject[]> {
    const p = record.payload;
    const fullName = str(p.full_name ?? p.name ?? p.fullName);
    const email = str(p.email);
    if (!fullName && !email) return [];

    const candidate = await upsertObject(ctx, {
      objectType: "Candidate",
      externalKey: email ?? fullName,
      title: fullName ?? email,
      status: "new",
      properties: {
        fullName,
        email,
        phone: str(p.phone),
        location: str(p.location),
        summary: str(p.summary),
      },
    });
    return [candidate];
  },
};
