// Greenhouse "Candidates / Applications" export as a declarative profile.
//
// A single-sheet export (CSV or XLSX) with Greenhouse's own column vocabulary.
//   - Job keyed on Requisition ID
//   - Candidate keyed on email (fallback name)
//   - one Submission per row
// Detection signature (requisition id + stage) is disjoint from LinkedIn's.

import type { MappingProfile } from "../mapping-profile";

export const greenhouseProfile: MappingProfile = {
  source: "greenhouse",
  detect: {
    requiredHeaders: ["requisition id", "stage"],
  },
  columns: {
    "candidate name": "candidateName",
    "first name": "firstName",
    "last name": "lastName",
    email: "email",
    "email address": "email",
    phone: "phone",
    "phone number": "phone",
    location: "location",
    "job name": "jobName",
    "requisition id": "requisitionId",
    "opening id": "openingId",
    stage: "stage",
    "current stage": "stage",
    "applied at": "appliedAt",
    "application date": "appliedAt",
    source: "sourceName",
    recruiter: "recruiter",
    coordinator: "coordinator",
    "job post url": "jobUrl",
  },
  job: {
    key: ["requisitionId"],
    title: "jobName",
    url: "jobUrl",
    location: "location",
    externalIds: [{ system: "greenhouse", from: "requisitionId" }],
    metadata: { openingId: "openingId" },
  },
  candidate: {
    key: ["email"],
    fullName: ["candidateName"],
    email: "email",
    phone: "phone",
    location: "location",
    metadata: { source: "sourceName" },
  },
  submission: {
    stage: "stage",
    appliedAt: "appliedAt",
    metadata: { recruiter: "recruiter", coordinator: "coordinator", source: "sourceName" },
  },
};
