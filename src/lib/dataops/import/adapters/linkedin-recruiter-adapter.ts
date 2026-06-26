// LinkedIn Recruiter adapter — compiled from a declarative MappingProfile.
// The behavior (detection, IR extraction) is identical to the former
// hand-written adapter; the format is now expressed as data (see the profile).
import { makeProfileAdapter } from "../profile-adapter";
import { linkedinRecruiterProfile } from "../profiles/linkedin-recruiter.profile";

export const linkedinRecruiterAdapter = makeProfileAdapter(linkedinRecruiterProfile);
