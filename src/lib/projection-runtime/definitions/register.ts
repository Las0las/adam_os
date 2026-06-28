// Definition registration — self-registers every enterprise object and its
// projections into the ProjectionRegistry on import. Mirrors the action-engine
// builtin pattern (side-effect import). Adding a new object/surface is a metadata
// change here, requiring no renderer changes.

import {
  registerEnterpriseObject,
  registerProjection,
} from "../registry/projection-registry";
import { candidateObject } from "./candidate.object";
import { candidateProjections } from "./candidate.projections";

let registered = false;

function registerAll(): void {
  if (registered) return;
  registered = true;
  registerEnterpriseObject(candidateObject);
  for (const projection of candidateProjections) registerProjection(projection);
}

registerAll();

export { registerAll };
