// Error taxonomy + redaction: typed errors map to status codes; unexpected
// errors are redacted (generic message + correlation id) so internal detail
// never reaches the client.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveError,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from "@/lib/app/errors";
import { PermissionError } from "@/lib/lawrence-core/permissions/permissions";

test("typed app errors map to their status and expose their message", () => {
  assert.deepEqual(resolveError(new ValidationError("bad field")).body, {
    ok: false,
    error: "bad field",
    code: "validation_error",
  });
  assert.equal(resolveError(new NotFoundError("no such action")).status, 404);
  assert.equal(resolveError(new ForbiddenError()).status, 403);
  assert.equal(resolveError(new ConflictError()).status, 409);
});

test("permission errors map to 403 and expose which permission was missing", () => {
  const r = resolveError(new PermissionError("dataops.admin"));
  assert.equal(r.status, 403);
  assert.equal(r.body.code, "forbidden");
  assert.match(r.body.error, /dataops\.admin/);
});

test("unexpected errors are redacted to a generic 500 with a correlation id in production", () => {
  const r = resolveError(new Error("DB connection string postgres://secret@host failed"), {
    NODE_ENV: "production",
  });
  assert.equal(r.status, 500);
  assert.equal(r.body.error, "Internal server error");
  assert.equal(r.body.code, "internal_error");
  assert.match(r.body.correlationId ?? "", /^err_/);
  // The real message is preserved for server-side logging, never in the client body.
  assert.match(r.internalMessage, /postgres:\/\/secret/);
  assert.equal(r.body.error.includes("secret"), false);
});

test("outside production, the real message is shown to aid debugging (still 500 + correlation id)", () => {
  const r = resolveError(new Error("boom"), { NODE_ENV: "test" });
  assert.equal(r.status, 500);
  assert.equal(r.body.error, "boom");
  assert.match(r.body.correlationId ?? "", /^err_/);
});
