/** Repeated session confirmations must not reload every screen. */
export function createAuthRefreshDecision() {
  let currentUserId: string | null = null;
  return (event: string, userId: string | null): boolean => {
    if (event === "INITIAL_SESSION") {
      currentUserId = userId;
      return false;
    }
    if (event === "SIGNED_OUT") {
      currentUserId = null;
      return true;
    }
    if (event === "SIGNED_IN") {
      const changed = currentUserId !== userId;
      currentUserId = userId;
      return changed;
    }
    return event === "USER_UPDATED";
  };
}