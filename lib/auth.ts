import { randomUUID, scryptSync, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

export type UserRole = "guest" | "staff";
type User = { id: string; name: string; email: string; passwordHash: string; role: UserRole };
export type PublicUser = Pick<User, "id" | "name" | "email" | "role">;

const users: User[] = [];
const sessions = new Map<string, { userId: string; expiresAt: number }>();
const sessionLifetime = 60 * 60 * 24 * 7;

const staffEmail = (process.env.HOTEL_STAFF_EMAIL ?? "admin@hotel-suite.local").trim().toLowerCase();
const staffPassword = process.env.HOTEL_STAFF_PASSWORD ?? "HotelSuiteAdmin123";

if (staffEmail && staffPassword) {
  users.push({ id: "hotel-manager", name: "Hotel Manager", email: staffEmail, passwordHash: hashPassword(staffPassword), role: "staff" });
}

function hashPassword(password: string) {
  const salt = randomUUID();
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function passwordMatches(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  const candidate = scryptSync(password, salt, 64).toString("hex");
  return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(candidate, "hex"));
}

export function publicUser(user: User): PublicUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export function createUser({ name, email, password, role }: { name: string; email: string; password: string; role: UserRole }) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!name.trim() || !/^\S+@\S+\.\S+$/.test(normalizedEmail) || password.length < 8) return { error: "Enter your name, a valid email address, and a password of at least 8 characters." };
  if (role === "staff") return { error: "Staff accounts must be created by hotel management." };
  if (users.some((user) => user.email === normalizedEmail)) return { error: "An account already exists with this email address." };
  const user = { id: randomUUID(), name: name.trim(), email: normalizedEmail, passwordHash: hashPassword(password), role };
  users.push(user);
  return { user: publicUser(user) };
}

export function authenticate(email: string, password: string) {
  const user = users.find((item) => item.email === email.trim().toLowerCase());
  if (!user || !passwordMatches(password, user.passwordHash)) return { error: "Incorrect email address or password." };
  return { user: publicUser(user) };
}

export function createSession(userId: string) {
  const token = randomUUID();
  sessions.set(token, { userId, expiresAt: Date.now() + sessionLifetime * 1000 });
  return token;
}

export function getSessionUser(token?: string): PublicUser | null {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) { sessions.delete(token); return null; }
  const user = users.find((item) => item.id === session.userId);
  return user ? publicUser(user) : null;
}

export function getRequestUser(request: NextRequest | Request): PublicUser | null {
  const cookie = request.headers.get("cookie")?.match(/(?:^|; )hotel_session=([^;]+)/)?.[1];
  return getSessionUser(cookie);
}

export function deleteSession(token?: string) { if (token) sessions.delete(token); }
export const sessionMaxAge = sessionLifetime;
