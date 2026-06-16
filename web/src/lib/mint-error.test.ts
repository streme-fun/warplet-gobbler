import { describe, it, expect } from "vitest";
import { mintErrorForClient } from "./mint-error";

describe("mintErrorForClient", () => {
  it("maps invalid-id validation errors to the 'not valid' copy", () => {
    expect(mintErrorForClient("Invalid gobbledTokenId")).toBe(
      "This claim is not valid for that Warplet.",
    );
    expect(
      mintErrorForClient("gobbledTokenId does not match warpletId"),
    ).toBe("This claim is not valid for that Warplet.");
  });

  it("maps a missing reservation to the 'not ready yet' copy", () => {
    expect(
      mintErrorForClient(
        "No reservation exists for this warplet — has the auction settled?",
      ),
    ).toMatch(/isn’t ready to claim yet/);
    // The gobbledTokenId variant also contains "No reservation exists" and
    // intentionally falls into the same bucket (the reservation isn't there yet).
    expect(
      mintErrorForClient(
        "No reservation exists for this gobbledTokenId — has the auction settled?",
      ),
    ).toMatch(/isn’t ready to claim yet/);
  });

  it("maps infra failures (pinata / gemini / blob auth / network) to their buckets", () => {
    expect(mintErrorForClient("PINATA upload failed: JWT expired")).toMatch(
      /prepare the claim assets/,
    );
    expect(mintErrorForClient("GoogleGenerativeAI error")).toMatch(
      /prepare the claim artwork/,
    );
    expect(mintErrorForClient("Image generation failed after fallback")).toMatch(
      /prepare the claim artwork/,
    );
    expect(
      mintErrorForClient("GOBBLED_TOKEN_URI_SETTER_PRIVATE_KEY not configured"),
    ).toMatch(/Claim signing is not configured/);
    expect(
      mintErrorForClient("vercel blob storage returned 403 auth error"),
    ).toMatch(/save the claim assets/);
    expect(mintErrorForClient("fetch failed: ETIMEDOUT")).toMatch(
      /trouble reaching Base/,
    );
  });

  it("falls back to generic copy for unknown errors", () => {
    expect(mintErrorForClient("kaboom")).toBe(
      "Could not prepare your claim right now. Please try again later.",
    );
  });
});
