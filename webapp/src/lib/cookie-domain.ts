// Returns the cookie domain to use for session cookies.
//
// We deploy across multiple hosts (admin.menusanjuan.com, www.menusanjuan.com,
// menusanjuan.com). Without a domain, each host has its own independent cookie
// jar — so logging out on one host can't clear the cookie on another. We set
// every session cookie on the apex domain (".menusanjuan.com") so all three
// hosts share the same cookie, and a single Set-Cookie can create, update, or
// delete it everywhere at once.
//
// For localhost and Vercel preview deploys (*.vercel.app), we return undefined
// so the cookie stays host-only — setting a domain the browser doesn't match
// would silently drop the cookie.
import { headers } from "next/headers";

export async function cookieDomain(): Promise<string | undefined> {
  try {
    const h = await headers();
    const host = (h.get("host") || "").toLowerCase().split(":")[0];
    if (host.endsWith("menusanjuan.com")) return ".menusanjuan.com";
    return undefined;
  } catch {
    return undefined;
  }
}
