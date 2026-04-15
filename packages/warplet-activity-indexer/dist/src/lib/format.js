export const zeroAddress = "0x0000000000000000000000000000000000000000";
export function shortAddress(address) {
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
export function formatTokenAmount(value, decimals = 18) {
    if (value == null)
        return "0";
    const base = 10n ** BigInt(decimals);
    const whole = value / base;
    const fraction = value % base;
    if (fraction === 0n)
        return whole.toString();
    const frac = fraction.toString().padStart(decimals, "0").replace(/0+$/, "").slice(0, 4);
    return frac ? `${whole}.${frac}` : whole.toString();
}
export function formatActor(address, profile) {
    if (!address)
        return "unknown";
    const bits = [];
    if (profile?.displayName)
        bits.push(escapeHtml(profile.displayName));
    if (profile?.username)
        bits.push(`@${escapeHtml(profile.username)}`);
    bits.push(`<code>${shortAddress(address)}</code>`);
    return bits.join(" · ");
}
export function escapeHtml(input) {
    return input
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;");
}
//# sourceMappingURL=format.js.map