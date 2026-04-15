import { env, neynarEnabled } from "../env.js";
export async function getNeynarUserByAddress(address) {
    if (!neynarEnabled)
        return null;
    const url = new URL("https://api.neynar.com/v2/farcaster/user/bulk-by-address/");
    url.searchParams.set("addresses", address.toLowerCase());
    url.searchParams.set("address_types", "custody_address,verified_address");
    const headers = {
        accept: "application/json",
        api_key: env.neynarApiKey,
    };
    if (env.neynarClientId)
        headers["x-neynar-client-id"] = env.neynarClientId;
    const response = await fetch(url, { headers });
    if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Neynar lookup failed (${response.status}): ${text.slice(0, 200)}`);
    }
    const json = (await response.json());
    const users = extractUsersForAddress(json, address.toLowerCase());
    const first = users[0];
    if (!first || typeof first !== "object")
        return null;
    const profile = getObject(first, "profile");
    const bio = getObject(profile, "bio");
    const pfp = getObject(profile, "pfp");
    return {
        fid: getNumber(first, "fid"),
        username: getString(first, "username"),
        displayName: getString(first, "display_name") ?? getString(first, "displayName"),
        pfpUrl: getString(pfp, "url") ?? getString(first, "pfp_url"),
        bio: getString(bio, "text") ?? getString(first, "bio"),
        followerCount: getNumber(first, "follower_count") ?? getNumber(first, "followerCount"),
        followingCount: getNumber(first, "following_count") ?? getNumber(first, "followingCount"),
    };
}
function extractUsersForAddress(json, address) {
    const result = getObject(json, "result");
    const byAddress = getObject(result, "address") ?? getObject(json, "address") ?? getObject(json, "resultByAddress");
    if (byAddress && Array.isArray(byAddress[address])) {
        return Array.from(byAddress[address] ?? []);
    }
    const users = getArray(result, "users") ?? getArray(json, "users");
    return users ? Array.from(users) : [];
}
function getObject(value, key) {
    if (!value || typeof value !== "object")
        return undefined;
    const child = value[key];
    return child && typeof child === "object" ? child : undefined;
}
function getArray(value, key) {
    if (!value || typeof value !== "object")
        return undefined;
    const child = value[key];
    return Array.isArray(child) ? child : undefined;
}
function getString(value, key) {
    if (!value || typeof value !== "object")
        return undefined;
    const child = value[key];
    return typeof child === "string" ? child : undefined;
}
function getNumber(value, key) {
    if (!value || typeof value !== "object")
        return undefined;
    const child = value[key];
    return typeof child === "number" ? child : undefined;
}
//# sourceMappingURL=neynar.js.map