import { Session, User } from "@supabase/supabase-js";
import { createClient } from "./server";
import { getLocalMockSession, getLocalMockUser } from "@/lib/mock/local-ui";
import { isLocalOrMockAuthMode } from "./runtime";

export async function verifyUserAuthenticated(): Promise<
  { user: User; session: Session } | undefined
> {
  if (isLocalOrMockAuthMode()) {
    const user = getLocalMockUser();
    const session = getLocalMockSession(user);
    return { user, session };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!user || !session) {
    return undefined;
  }
  return { user, session };
}
