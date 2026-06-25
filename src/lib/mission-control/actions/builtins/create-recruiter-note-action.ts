// Builtin action: create a recruiter note and (optionally) link it to a candidate.

import { registerAction } from "@/lib/mission-control/actions/action-service";
import { id } from "@/lib/lawrence-core/utils/ids";
import { upsertObject, linkObjects } from "@/lib/dataops/ontology/object-service";

registerAction({
  key: "create_recruiter_note",
  requiresApproval: false,
  precondition(_ctx, input) {
    return input.body != null ? null : "missing body";
  },
  async run(ctx, input) {
    const note = await upsertObject(ctx, {
      objectType: "RecruiterNote",
      externalKey: `note-${id("n")}`,
      title: String(input.title ?? "Note"),
      properties: { body: String(input.body ?? ""), candidateId: input.candidateId },
    });
    if (input.candidateId) {
      await linkObjects(ctx, {
        linkType: "about",
        from: { objectType: "RecruiterNote", objectId: note.id },
        to: { objectType: "Candidate", objectId: String(input.candidateId) },
      });
    }
    return { noteId: note.id };
  },
});
