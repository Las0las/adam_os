// LinkedIn Recruiter "Job Applicant Report" as a declarative profile.
//
// A 2-tab XLSX: an "Overview" key/value tab (report metadata) and a "Job
// Applicants" tab (one row per applicant carrying both candidate and job fields).
//   - Job keyed on LinkedIn Job ID (ATS Job ID kept as an external reference)
//   - Candidate keyed on email (fallback profile URL, then name)
//   - one Submission per row

import type { MappingProfile } from "../mapping-profile";

export const linkedinRecruiterProfile: MappingProfile = {
  source: "linkedin_recruiter",
  detect: {
    sheetName: "Job Applicants",
    requiredHeaders: ["first name", "email address", "job id"],
  },
  overviewSheet: "Overview",
  columns: {
    "first name": "firstName",
    "last name": "lastName",
    "email address": "email",
    "phone number": "phone",
    "general location": "location",
    "zip code": "zipCode",
    headline: "headline",
    "current title": "currentTitle",
    "current company": "currentCompany",
    "current position start date": "currentPositionStartDate",
    "education degree": "educationDegree",
    "education institution": "educationInstitution",
    "profile url": "profileUrl",
    "date applied": "dateApplied",
    "current stage": "currentStage",
    "job id": "jobId",
    "job title": "jobTitle",
    "job url": "jobUrl",
    "ats job id": "atsJobId",
    "minimum salary": "minSalary",
    "maximum salary": "maxSalary",
    "currency code": "currencyCode",
    "compensation period": "compensationPeriod",
    "hiring project id": "hiringProjectId",
    "hiring project title": "hiringProjectTitle",
    "contract id": "contractId",
    "contract name": "contractName",
    "screening questions": "screeningQuestions",
  },
  job: {
    key: ["jobId", "atsJobId"], // canonical = LinkedIn Job ID
    title: "jobTitle",
    url: "jobUrl",
    location: "location",
    externalIds: [
      { system: "linkedin", from: "jobId" },
      { system: "ats", from: "atsJobId" },
    ],
    compensation: { min: "minSalary", max: "maxSalary", currency: "currencyCode", period: "compensationPeriod" },
    hiringProject: { id: "hiringProjectId", title: "hiringProjectTitle" },
    contract: { id: "contractId", name: "contractName" },
    metadata: { atsJobId: "atsJobId" },
  },
  candidate: {
    key: ["email", "profileUrl"],
    fullName: ["firstName", "lastName"],
    email: "email",
    phone: "phone",
    location: "location",
    headline: "headline",
    currentTitle: "currentTitle",
    currentCompany: "currentCompany",
    profileUrl: "profileUrl",
    education: { degree: "educationDegree", institution: "educationInstitution" },
    metadata: { zipCode: "zipCode", currentPositionStartDate: "currentPositionStartDate" },
  },
  submission: {
    stage: "currentStage",
    appliedAt: "dateApplied",
    screening: "screeningQuestions",
  },
};
