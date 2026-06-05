import HomeView from "@/components/HomeView";

// Root route. No `initialView` → today's scroll-driven behavior, including the
// first-sell-visit localStorage default. Inherits the default `fc:miniapp`
// embed from the root layout (auction image, root launch URL).
export default function Page() {
  return <HomeView />;
}
