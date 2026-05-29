/**
 * Map internal mint/claim failures to actionable, user-facing copy; keep a
 * generic fallback for unknowns. Pure string→string so it can be unit-tested
 * without booting the API route.
 */
export function mintErrorForClient(message: string): string {
  if (/Invalid gobbledTokenId|does not match warpletId/i.test(message))
    return "This claim is not valid for that Warplet.";
  if (message.includes("No reservation exists"))
    return "This Warplet isn’t ready to claim yet. Give it a moment and try again.";
  if (message.includes("Source warplet image not found"))
    return "We couldn’t generate the claim artwork for this Warplet yet. Please try again shortly.";
  if (/pinata|PINATA|JWT/i.test(message))
    return "We couldn’t prepare the claim assets right now. Please try again shortly.";
  if (/GEMINI|genai|GoogleGenerativeAI/i.test(message))
    return "We couldn’t prepare the claim artwork right now. Please try again shortly.";
  if (
    /blob|BLOB|vercel.*storage/i.test(message) &&
    /token|auth|401|403/i.test(message)
  )
    return "We couldn’t save the claim assets right now. Please try again shortly.";
  if (
    /HTTP request failed|fetch failed|Fetch failed|ECONNRESET|ETIMEDOUT|timeout|429|503|502/i.test(
      message,
    )
  )
    return "The claim service is having trouble reaching Base right now. Please try again shortly.";
  return "Could not prepare your claim right now. Please try again later.";
}
