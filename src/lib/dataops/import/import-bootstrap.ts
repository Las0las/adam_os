// Import adapter bootstrap. Registering an adapter here is the only step needed
// to teach LAWRENCE a new recruiting source — the parser detects it and the
// ontology projection is shared. Idempotent and safe to import for side effect.

import { registerImportAdapter } from "./import-adapter";
import { linkedinRecruiterAdapter } from "./adapters/linkedin-recruiter-adapter";

registerImportAdapter(linkedinRecruiterAdapter);
