import { describe, expect, it } from "vitest";
import { createAuthRefreshDecision } from "./auth-refresh";

describe("session refresh", () => {
  it("ignores confirmation and refresh of the current session", () => {
    const decide = createAuthRefreshDecision();
    expect(decide("INITIAL_SESSION", "user-a")).toBe(false);
    expect(decide("SIGNED_IN", "user-a")).toBe(false);
    expect(decide("TOKEN_REFRESHED", "user-a")).toBe(false);
  });
  it("preserves real login, account changes, user updates and logout", () => {
    const decide = createAuthRefreshDecision();
    expect(decide("SIGNED_IN", "user-a")).toBe(true);
    expect(decide("USER_UPDATED", "user-a")).toBe(true);
    expect(decide("SIGNED_IN", "user-b")).toBe(true);
    expect(decide("SIGNED_OUT", null)).toBe(true);
    expect(decide("SIGNED_IN", "user-b")).toBe(true);
  });
});