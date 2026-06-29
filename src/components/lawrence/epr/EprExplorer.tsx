"use client";

/* EPR Runtime Explorer — switch the SCHEMA, watch the SAME runtime project a
   different Enterprise Object. Neither studio re-implements property logic. */

import { useState } from "react";
import { EprStudio } from "./EprStudio";
import { jobSchema, candidateSchema, type ObjectSchema } from "@/lib/epr";

const SCHEMAS: { id: string; schema: ObjectSchema }[] = [
  { id: "Job", schema: jobSchema },
  { id: "Candidate", schema: candidateSchema },
];

export function EprExplorer() {
  const [idx, setIdx] = useState(0);
  const active = SCHEMAS[idx];

  return (
    <div className="lds" style={{ fontFamily: "var(--font, Poppins, Arial, sans-serif)", background: "#dfe7ee", minHeight: "100vh" }}>
      <div style={{ background: "#06223a", color: "#fff", padding: "10px 24px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 13, letterSpacing: 0.3 }}>EPR-001 · Enterprise Property Runtime</strong>
        <span style={{ fontSize: 12, opacity: 0.7 }}>One runtime, any object — the Studio is a projection of a schema.</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, background: "rgba(255,255,255,.08)", padding: 4, borderRadius: 9 }} role="tablist" aria-label="Enterprise Object schema">
          {SCHEMAS.map((s, i) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={i === idx}
              onClick={() => setIdx(i)}
              style={{
                fontSize: 12, fontWeight: 600, padding: "5px 16px", borderRadius: 6, cursor: "pointer", border: "none",
                background: i === idx ? "#44b0b1" : "transparent", color: "#fff", opacity: i === idx ? 1 : 0.72,
              }}
            >
              {s.id}
            </button>
          ))}
        </div>
      </div>
      {/* Remounting on schema change gives each object its own fresh instance state. */}
      <EprStudio key={active.id} schema={active.schema} />
    </div>
  );
}
