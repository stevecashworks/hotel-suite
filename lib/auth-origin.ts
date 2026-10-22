import type { NextRequest } from "next/server";

export function getAuthAppOrigin(request: NextRequest): string | null {
  const configuredOrigin = process.env.APP_URL?.trim();
  if (configuredOrigin) {
    try {
      const configuredUrl = new URL(configuredOrigin);
      if (configuredUrl.protocol !== "https:" && configuredUrl.hostname !== "localhost" && configuredUrl.hostname !== "127.0.0.1") {
        return null;
      }
      return configuredUrl.origin;
    } catch {
      return null;
    }
  }

  const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim()
    || request.headers.get("host");
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const protocol = forwardedProtocol ? `${forwardedProtocol.replace(/:$/, "")}:` : request.nextUrl.protocol;
  if (!host || /^(?:0\.0\.0\.0|\[::\])(?::\d+)?$/i.test(host)) return null;

  try {
    const origin = new URL(`${protocol}//${host}`);
    if (origin.protocol !== "https:" && origin.hostname !== "localhost" && origin.hostname !== "127.0.0.1") {
      return null;
    }
    return origin.origin;
  } catch {
    return null;
  }
}