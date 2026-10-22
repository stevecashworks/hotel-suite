import type { UserRole } from "@/lib/auth";

export function safeReturnPath(value: unknown, fallback = "/dashboard") {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }

  try {
    const url = new URL(value, "https://hotelier.invalid");
    if (url.origin !== "https://hotelier.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function dashboardPathForRole(role: UserRole) {
  if (role === "staff") return "/admin";
  if (role === "guest") return "/dashboard";
  return "/staff";
}