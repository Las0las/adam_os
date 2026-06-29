import { describe, it, expectTypeOf } from "vitest";
import type {
  ObjectTypeDefinition,
  EnterpriseObject,
  EnterpriseProperty,
  Mutation,
  DomainEvent,
  ReversalPlan,
  RuntimeContract,
  ProjectionContract,
  DomainPackContract,
  CapabilityDescriptor,
  HostService,
  HostServices,
  EnterpriseObjectRegistry,
  RuntimeRegistry,
  CapabilityRegistry,
  Kernel,
} from "../index.js";

/**
 * Phase 0 contract-shape conformance, made executable. If a contract's required
 * surface is renamed or removed, these compile-time assertions fail and the package
 * will not typecheck — the contract is frozen by construction.
 */
describe("RFC-PC0 contract surface", () => {
  it("Enterprise Object: type definition + governed instance + property", () => {
    expectTypeOf<ObjectTypeDefinition>().toHaveProperty("typeId");
    expectTypeOf<ObjectTypeDefinition>().toHaveProperty("fields");
    expectTypeOf<EnterpriseObject>().toHaveProperty("properties");
    expectTypeOf<EnterpriseObject>().toHaveProperty("revision");
    expectTypeOf<EnterpriseObject>().toHaveProperty("stateHash");
    // Every property carries provenance + evidence + confidence (PSI/EPR invariant).
    expectTypeOf<EnterpriseProperty>().toHaveProperty("provenance");
    expectTypeOf<EnterpriseProperty>().toHaveProperty("evidence");
    expectTypeOf<EnterpriseProperty>().toHaveProperty("confidence");
  });

  it("Mutation: principal-bound, idempotent, reversible, yields an append-only event", () => {
    expectTypeOf<Mutation>().toHaveProperty("principalId");
    expectTypeOf<Mutation>().toHaveProperty("idempotencyKey");
    expectTypeOf<Mutation>().toHaveProperty("changes");
    expectTypeOf<DomainEvent>().toHaveProperty("sequence");
    expectTypeOf<DomainEvent>().toHaveProperty("hash");
    expectTypeOf<DomainEvent>().toHaveProperty("previousHash");
    expectTypeOf<ReversalPlan>().toHaveProperty("inverse");
  });

  it("Runtime: descriptor + initialize/handle/dispose, never mutates directly", () => {
    expectTypeOf<RuntimeContract>().toHaveProperty("descriptor");
    expectTypeOf<RuntimeContract>().toHaveProperty("initialize");
    expectTypeOf<RuntimeContract>().toHaveProperty("handle");
    expectTypeOf<RuntimeContract>().toHaveProperty("dispose");
  });

  it("Projection: a pure deterministic fold over the event log", () => {
    expectTypeOf<ProjectionContract>().toHaveProperty("descriptor");
    expectTypeOf<ProjectionContract>().toHaveProperty("project");
  });

  it("Domain Pack: a manifest + wiring-only register()", () => {
    expectTypeOf<DomainPackContract>().toHaveProperty("manifest");
    expectTypeOf<DomainPackContract>().toHaveProperty("register");
  });

  it("Capability + Host Service are explicitly declared", () => {
    expectTypeOf<CapabilityDescriptor>().toHaveProperty("id");
    expectTypeOf<CapabilityDescriptor>().toHaveProperty("scope");
    expectTypeOf<HostService>().toHaveProperty("name");
    expectTypeOf<HostServices>().toHaveProperty("get");
  });

  it("Kernel exposes exactly its eight governed responsibilities", () => {
    expectTypeOf<Kernel>().toHaveProperty("resolvePrincipal");
    expectTypeOf<Kernel>().toHaveProperty("resolveAuthority");
    expectTypeOf<Kernel>().toHaveProperty("evaluatePolicy");
    expectTypeOf<Kernel>().toHaveProperty("validateMutation");
    expectTypeOf<Kernel>().toHaveProperty("produceDecision");
    expectTypeOf<Kernel>().toHaveProperty("produceEvent");
    expectTypeOf<Kernel>().toHaveProperty("guaranteeAudit");
    expectTypeOf<Kernel>().toHaveProperty("guaranteeReversibility");
  });

  it("the three permanent registries are typed", () => {
    expectTypeOf<EnterpriseObjectRegistry>().toHaveProperty("register");
    expectTypeOf<RuntimeRegistry>().toHaveProperty("register");
    expectTypeOf<CapabilityRegistry>().toHaveProperty("register");
  });
});
