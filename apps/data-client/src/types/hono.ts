import type { Session, User } from "better-auth/types";
import type { Bindings } from "./env";

export interface AuthVariables {
  user: User | null;
  session: Session | null;
}

// Shared Hono generic - use this instead of `Hono<{ Bindings }>` wherever a
// route needs to read the session (populated by middleware/session.ts).
export interface AppEnv {
  Bindings: Bindings;
  Variables: AuthVariables;
}
