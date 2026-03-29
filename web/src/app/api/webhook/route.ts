import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // TODO: verify Farcaster webhook signature before processing
  const { event } = body;

  switch (event) {
    case "miniapp_added":
      console.log("Mini app added:", body);
      break;
    case "miniapp_removed":
      console.log("Mini app removed:", body);
      break;
    case "notifications_enabled":
      console.log("Notifications enabled:", body);
      break;
    case "notifications_disabled":
      console.log("Notifications disabled:", body);
      break;
    default:
      console.log("Unknown webhook event:", event);
  }

  return NextResponse.json({ success: true });
}
