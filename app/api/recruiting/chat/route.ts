import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { run, parseBody } from "@/lib/app/route-helpers";
import { runRecruitingChatCommand } from "@/lib/domains/recruiting/recruiting-chat-service";

export const dynamic = "force-dynamic";

const ChatSchema = z.object({
  message: z.string().min(1),
});

// POST /api/recruiting/chat  body: { message }
// Natural-language recruiting command. Routes to a governed action (approval +
// audit enforced) or a draft-to-review; never mutates records directly.
export async function POST(request: Request) {
  const ctx = await appContext();
  return run(async () => {
    const body = await parseBody(request, ChatSchema);
    return runRecruitingChatCommand(ctx, { message: body.message });
  });
}
