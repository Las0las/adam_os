// Greenhouse adapter — compiled from a declarative MappingProfile. Behavior is
// identical to the former hand-written adapter; the format is now data.
import { makeProfileAdapter } from "../profile-adapter";
import { greenhouseProfile } from "../profiles/greenhouse.profile";

export const greenhouseAdapter = makeProfileAdapter(greenhouseProfile);
