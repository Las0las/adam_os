"use client";

// Phase 6 — Create release bundle dialog. Form with key, name, description,
// releaseType, target environment, and a simple items editor (itemType +
// itemKey + changeType rows). Submit is blocked until name and target are set.

import { useState } from "react";
import type {
  Environment,
  ReleaseType,
  ReleaseItemType,
  ReleaseItemChangeType,
} from "@/lib/mission-control/runtime/mission-control-hardening-types";
import type { CreateReleaseInput } from "@/lib/mission-control/deployments/release-bundle-service";

const RELEASE_TYPES: ReleaseType[] = [
  "pipeline",
  "function",
  "agent",
  "action",
  "config",
  "domain_pack",
  "mixed",
];

const ITEM_TYPES: ReleaseItemType[] = [
  "pipeline",
  "function",
  "agent",
  "action",
  "prompt",
  "model",
  "notification_rule",
  "domain_pack",
  "config",
];

const CHANGE_TYPES: ReleaseItemChangeType[] = [
  "create",
  "update",
  "delete",
  "enable",
  "disable",
];

interface ItemRow {
  itemType: ReleaseItemType;
  itemKey: string;
  changeType: ReleaseItemChangeType;
}

function emptyRow(): ItemRow {
  return { itemType: "function", itemKey: "", changeType: "update" };
}

export function CreateReleaseBundleDialog({
  environments,
  pending,
  onCreate,
  onClose,
}: {
  environments: Environment[];
  pending: boolean;
  onCreate: (input: CreateReleaseInput) => Promise<{ ok: boolean }>;
  onClose: () => void;
}) {
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [releaseType, setReleaseType] = useState<ReleaseType>("mixed");
  const [targetEnvironmentKey, setTargetEnvironmentKey] = useState("");
  const [items, setItems] = useState<ItemRow[]>([emptyRow()]);

  const canSubmit =
    name.trim().length > 0 && targetEnvironmentKey.trim().length > 0 && !pending;

  const updateItem = (index: number, patch: Partial<ItemRow>) => {
    setItems((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const input: CreateReleaseInput = {
      key: key.trim(),
      name: name.trim(),
      description: description.trim() || undefined,
      releaseType,
      targetEnvironmentKey: targetEnvironmentKey.trim(),
      items: items
        .filter((row) => row.itemKey.trim().length > 0)
        .map((row) => ({
          itemType: row.itemType,
          itemKey: row.itemKey.trim(),
          changeType: row.changeType,
        })),
    };
    const result = await onCreate(input);
    if (result.ok) onClose();
  };

  return (
    <div className="card" role="dialog" aria-label="Create release bundle">
      <div className="row">
        <h3>Create release bundle</h3>
        <button type="button" className="btn" onClick={onClose}>
          Close
        </button>
      </div>

      <label className="kv">
        <span className="muted">Key</span>
        <input
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="auto-generated if blank"
        />
      </label>

      <label className="kv">
        <span className="muted">Name *</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <label className="kv">
        <span className="muted">Description</span>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <label className="kv">
        <span className="muted">Release type</span>
        <select
          value={releaseType}
          onChange={(e) => setReleaseType(e.target.value as ReleaseType)}
        >
          {RELEASE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <label className="kv">
        <span className="muted">Target environment *</span>
        <select
          value={targetEnvironmentKey}
          onChange={(e) => setTargetEnvironmentKey(e.target.value)}
        >
          <option value="">Select…</option>
          {environments.map((env) => (
            <option key={env.id} value={env.key}>
              {env.name} ({env.key})
            </option>
          ))}
        </select>
      </label>

      <h4>Items</h4>
      {items.map((row, index) => (
        <div className="btn-row" key={index}>
          <select
            value={row.itemType}
            onChange={(e) =>
              updateItem(index, { itemType: e.target.value as ReleaseItemType })
            }
          >
            {ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={row.itemKey}
            placeholder="item key"
            onChange={(e) => updateItem(index, { itemKey: e.target.value })}
          />
          <select
            value={row.changeType}
            onChange={(e) =>
              updateItem(index, {
                changeType: e.target.value as ReleaseItemChangeType,
              })
            }
          >
            {CHANGE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn"
            onClick={() =>
              setItems((prev) => prev.filter((_, i) => i !== index))
            }
          >
            Remove
          </button>
        </div>
      ))}
      <div className="btn-row">
        <button
          type="button"
          className="btn"
          onClick={() => setItems((prev) => [...prev, emptyRow()])}
        >
          Add item
        </button>
      </div>

      <div className="btn-row">
        <button
          type="button"
          className="btn"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          Create release
        </button>
      </div>
    </div>
  );
}
