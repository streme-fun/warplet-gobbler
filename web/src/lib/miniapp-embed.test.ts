import { describe, it, expect } from "vitest";
import {
  appUrl,
  AUCTION_EMBED_IMAGE,
  SELL_EMBED_IMAGE,
  buildMiniappEmbed,
} from "./miniapp-embed";

describe("buildMiniappEmbed", () => {
  it("covers R7: reproduces the original layout embed for the auction image + root launch URL (full blob, incl. splash fields)", () => {
    // This is the exact shape layout.tsx hardcoded before the helper was
    // extracted — a regression guard so the layout refactor changes nothing.
    expect(
      buildMiniappEmbed({ imageUrl: AUCTION_EMBED_IMAGE, launchUrl: appUrl }),
    ).toEqual({
      version: "1",
      imageUrl:
        "https://api.warpletgobbler.xyz/api/gobbler/frimg/mini/auction.png",
      button: {
        title: "Launch",
        action: {
          type: "launch_miniapp",
          name: "WarpletGobbler",
          url: appUrl,
          splashImageUrl: `${appUrl}/splash.png`,
          splashBackgroundColor: "#13111C",
        },
      },
    });
  });

  it("covers R5: builds a /buy embed with the buy launch URL and all sub-fields carried through", () => {
    const embed = buildMiniappEmbed({
      imageUrl: AUCTION_EMBED_IMAGE,
      launchUrl: `${appUrl}/buy`,
    });
    // Full-blob assertion — guards against the helper dropping splash fields
    // its { imageUrl, launchUrl } signature doesn't take.
    expect(embed).toEqual({
      version: "1",
      imageUrl: AUCTION_EMBED_IMAGE,
      button: {
        title: "Launch",
        action: {
          type: "launch_miniapp",
          name: "WarpletGobbler",
          url: `${appUrl}/buy`,
          splashImageUrl: `${appUrl}/splash.png`,
          splashBackgroundColor: "#13111C",
        },
      },
    });
    expect(embed.button.action.url.endsWith("/buy")).toBe(true);
  });

  it("appUrl falls back to the production domain when NEXT_PUBLIC_APP_URL is unset", () => {
    // Pins the fallback so the R7 splashImageUrl assertion (built from appUrl)
    // actually guards the production URL instead of being self-referential.
    expect(appUrl).toBe("https://warpletgobbler.xyz");
  });

  it("SELL_EMBED_IMAGE is still the auction-image placeholder", () => {
    // Enforces the rollout caveat: /sell previews with the auction image until
    // the real sell asset is hosted. Delete this test when SELL_EMBED_IMAGE is
    // switched to the real sell URL.
    expect(SELL_EMBED_IMAGE).toBe(AUCTION_EMBED_IMAGE);
  });
});
