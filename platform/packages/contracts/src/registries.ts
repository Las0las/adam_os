/**
 * The three permanent platform registries. They are how the platform stays "any
 * object / any runtime / any capability over one core": you REGISTER, you never
 * fork. Registries are tenant-agnostic shape definitions; resolution is governed.
 */
import type {
  CapabilityId,
  ObjectTypeId,
  Result,
  RuntimeId,
} from "./common.js";
import type { ObjectTypeDefinition } from "./enterprise-object.js";
import type { RuntimeDescriptor } from "./runtime.js";
import type { CapabilityDescriptor } from "./capability.js";

/** Enterprise Object Registry — the catalog of every registered ObjectType. */
export interface EnterpriseObjectRegistry {
  register(def: ObjectTypeDefinition): Result<void>;
  resolve(typeId: ObjectTypeId): Result<ObjectTypeDefinition>;
  list(): readonly ObjectTypeDefinition[];
  has(typeId: ObjectTypeId): boolean;
}

/** Runtime Registry — the catalog of runtimes available to the platform. */
export interface RuntimeRegistry {
  register(descriptor: RuntimeDescriptor): Result<void>;
  resolve(id: RuntimeId): Result<RuntimeDescriptor>;
  list(): readonly RuntimeDescriptor[];
  has(id: RuntimeId): boolean;
}

/** Capability Registry — the catalog of declared capabilities + their dependencies. */
export interface CapabilityRegistry {
  register(descriptor: CapabilityDescriptor): Result<void>;
  resolve(id: CapabilityId): Result<CapabilityDescriptor>;
  list(): readonly CapabilityDescriptor[];
  has(id: CapabilityId): boolean;
}
