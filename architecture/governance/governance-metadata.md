# Governance Metadata

| Field | Value |
|-------|-------|
| Identifier | GOV-META |
| Version | 1.0 |
| Status | Active |
| Authority | Governance Reference |
| Owner | LAWRENCE Architecture Council |
| Effective Date | 2026-06-27 |
| Derived From | LAWRENCE Constitution v1.0, AS-001 |

> Defines the metadata every architectural artifact SHALL carry. This metadata is
> **architectural only** — it has NO runtime dependency and is never imported by
> production code. Terminology follows RFC-2119.

## 1. Metadata Schema

Every artifact (Constitution, Standard, Specification, ADR, Contract, Conformance
suite) SHALL declare a metadata header with:

| Field | Required | Meaning |
|-------|----------|---------|
| `identifier` | SHALL | Stable unique id (e.g. `IOS-004`, `AS-001`, `ADR-0001`). |
| `version` | SHALL | Semantic version of the artifact. |
| `status` | SHALL | `Draft` \| `Active` \| `Accepted` \| `Superseded` \| `Frozen`. |
| `authority` | SHALL | The layer that grants this artifact authority. |
| `owner` | SHALL | Accountable owner. |
| `effectiveDate` | SHALL | Date the artifact takes effect. |
| `supersededBy` | SHALL | Successor id, or `—`. |
| `relatedArtifacts` | SHOULD | Bidirectional links (derived-from, derives, ADRs). |

## 2. Status Lifecycle

```
Draft → Active ┬→ Superseded
               └→ Frozen        (Constitution only)
ADR: Proposed → Accepted | Rejected → Superseded
```

A `Superseded` artifact SHALL name its successor in `supersededBy` and SHALL be
retained for traceability (never deleted).

## 3. Identifier Conventions

- Constitution: `CONST-LAWRENCE`
- Architecture Standard: `AS-NNN`
- Normative Specification: `<DOMAIN>-NNN` (e.g. `IOS-NNN`, `ONT-NNN`, `MIS-NNN`)
- Architecture Decision Record: `ADR-NNNN`
- Development Directive: `DD-NNN`
- Public Contract: `CON-NNN` (or `CONTRACT-<spec>-<name>`)
- Conformance Suite: `CONF-<DOMAIN>`

## 4. Authority Field Values (ascending authority)

`Conformance Suite` < `Implementation` < `Public Contract` <
`Normative Specification` < `Architecture Standard` < `Constitution (Supreme)`.

A **Development Directive** (`DD-NNN`) is a process-governance artifact: it governs
*how* development proceeds rather than *what* is built. It derives authority from
the Constitution and an Architecture Standard, and SHALL NOT override a
Specification's normative content.

An artifact SHALL NOT claim authority above the layer that defines it, and SHALL
NOT make a lower layer authoritative over it.

## 5. Non-Runtime Guarantee

Governance metadata SHALL live only under `/architecture` and `/conformance`. It
SHALL NOT be imported by `src/**` production code, and SHALL NOT affect runtime
behavior.
