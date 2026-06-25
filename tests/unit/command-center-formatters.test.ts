// Phase 5 (Part N) — unit tests for the presentation formatters. All pure, so a
// fixed referenceTime keeps relative-age and overdue math deterministic.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  domainLabel,
  statusLabel,
  severityLabel,
  formatRelativeAge,
  isOverdue,
} from "@/lib/domains/command-center/command-center-formatters";

test("domainLabel humanizes known domains", () => {
  assert.equal(domainLabel("executive"), "Executive");
  assert.equal(domainLabel("recruiting"), "Recruiting");
  assert.equal(domainLabel("mission_control"), "Mission Control");
});

test("statusLabel humanizes statuses", () => {
  assert.equal(statusLabel("awaiting_review"), "Awaiting review");
  assert.equal(statusLabel("in_progress"), "In progress");
  assert.equal(statusLabel("blocked"), "Blocked");
});

test("severityLabel capitalizes severity, em-dash for null", () => {
  assert.equal(severityLabel("high"), "High");
  assert.equal(severityLabel(null), "—");
  assert.equal(severityLabel(undefined), "—");
});

test("formatRelativeAge with a referenceTime 3h after createdAt is '3h'", () => {
  const createdAt = "2026-06-25T09:00:00.000Z";
  const referenceTime = "2026-06-25T12:00:00.000Z"; // +3h
  assert.equal(formatRelativeAge(createdAt, referenceTime), "3h");
});

test("formatRelativeAge formats minutes and days", () => {
  const createdAt = "2026-06-25T12:00:00.000Z";
  assert.equal(
    formatRelativeAge(createdAt, "2026-06-25T12:05:00.000Z"),
    "5m",
    "minutes under an hour",
  );
  assert.equal(
    formatRelativeAge(createdAt, "2026-06-27T12:00:00.000Z"),
    "2d",
    "two whole days",
  );
});

test("isOverdue is true when due before reference, false otherwise", () => {
  const referenceTime = "2026-06-25T12:00:00.000Z";
  assert.equal(isOverdue("2026-06-25T11:00:00.000Z", referenceTime), true, "past due");
  assert.equal(isOverdue("2026-06-25T13:00:00.000Z", referenceTime), false, "future due");
  assert.equal(isOverdue(null, referenceTime), false, "no due date is never overdue");
});
