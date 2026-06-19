import HomeView from "@/components/HomeView";
import LegacyAuctionPreview from "@/components/LegacyAuctionPreview";

// Root route. No `initialView` → today's scroll-driven behavior, including the
// first-sell-visit localStorage default. Inherits the default `fc:miniapp`
// embed from the root layout (auction image, root launch URL).
export default function Page() {
  if (process.env.NEXT_PUBLIC_LEGACY_AUCTION_ONLY === "true") {
    return <LegacyAuctionPreview />;
  }

  return <HomeView />;
}
