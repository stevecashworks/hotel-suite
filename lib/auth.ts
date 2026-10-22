import { randomUUID, scryptSync, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import connect_db from "@/lib/mongodb";

export type UserRole = "guest" | "staff" | "kitchen" | "bar" | "room-service";
export type AuthProvider = "local" | "google";

export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash?: string;
  role: UserRole;
  provider: AuthProvider | string;
  providerId?: string;
  avatar?: string;
  createdAt?: Date | string;
};

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  provider: AuthProvider | string;
  avatar?: string;
};

// Mongoose User Schema for persistent MongoDB storage
const userSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    passwordHash: { type: String },
    role: { type: String, enum: ["guest", "staff", "kitchen", "bar", "room-service"], default: "guest" },
    provider: { type: String, default: "local" },
    providerId: { type: String },
    avatar: { type: String },
  },
  { timestamps: true }
);

const UserModel = mongoose.models.User ?? mongoose.model("User", userSchema);

// In-memory user cache & fallback store
const users: User[] = [];
const sessions = new Map<string, { userId: string; expiresAt: number }>();
const mobileAuthCodes = new Map<string, { userId: string; expiresAt: number }>();
export const sessionLifetime = 60 * 60 * 24 * 7; // 7 days in seconds
export const sessionMaxAge = sessionLifetime;

const staffEmail = (process.env.HOTEL_STAFF_EMAIL ?? "admin@hotel-suite.local").trim().toLowerCase();
const staffPassword = process.env.HOTEL_STAFF_PASSWORD ?? "HotelSuiteAdmin123";

if (staffEmail && staffPassword) {
  users.push({
    id: "hotel-manager",
    name: "Hotel Manager",
    email: staffEmail,
    passwordHash: hashPassword(staffPassword),
    role: "staff",
    provider: "local",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
  });
}

function hashPassword(password: string) {
  const salt = randomUUID();
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function passwordMatches(password: string, stored: string) {
  try {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return false;
    const candidate = scryptSync(password, salt, 64).toString("hex");
    return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(candidate, "hex"));
  } catch {
    return false;
  }
}

export function publicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    provider: user.provider || "local",
    avatar: user.avatar,
  };
}

/**
 * Register a new user with email and password
 */
export async function createUser({
  name,
  email,
  password,
  role,
}: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!name.trim() || !/^\S+@\S+\.\S+$/.test(normalizedEmail) || password.length < 8) {
    return { error: "Enter your name, a valid email address, and a password of at least 8 characters." };
  }
  if (role === "staff") {
    return { error: "Staff accounts must be created by hotel management." };
  }

  // Check in-memory first
  if (users.some((user) => user.email === normalizedEmail)) {
    return { error: "An account already exists with this email address." };
  }

  // Check MongoDB if connected
  try {
    const conn = await connect_db();
    if (conn) {
      const existing = await UserModel.findOne({ email: normalizedEmail }).lean();
      if (existing) {
        return { error: "An account already exists with this email address." };
      }
    }
  } catch (err) {
    console.warn("MongoDB check skipped:", err);
  }

  const hashedPassword = hashPassword(password);
  const newUser: User = {
    id: randomUUID(),
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: hashedPassword,
    role,
    provider: "local",
    createdAt: new Date(),
  };

  users.push(newUser);

  // Persist to MongoDB if available
  try {
    const conn = await connect_db();
    if (conn) {
      await UserModel.create({
        userId: newUser.id,
        name: newUser.name,
        email: newUser.email,
        passwordHash: newUser.passwordHash,
        role: newUser.role,
        provider: "local",
      });
    }
  } catch (err) {
    console.warn("Could not persist user to MongoDB, kept in-memory:", err);
  }

  return { user: publicUser(newUser) };
}

export async function provisionStaffUser({ email, role }: { email: string; role: Exclude<UserRole, "guest"> }) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    return { error: "Enter a valid staff email address." };
  }
  if (normalizedEmail === staffEmail && role !== "staff") {
    return { error: "The hotel administrator account cannot be assigned a department role." };
  }

  let user = users.find((item) => item.email === normalizedEmail);
  try {
    const conn = await connect_db();
    if (!conn) {
      return { error: "Staff accounts cannot be added because the database is unavailable." };
    }

    const existing = user || await UserModel.findOne({ email: normalizedEmail }).lean();
    const userId = existing ? ("id" in existing ? existing.id : existing.userId) : randomUUID();
    const name = existing?.name || normalizedEmail.split("@")[0];
    const provider = existing?.provider || "local";

    await UserModel.findOneAndUpdate(
      { email: normalizedEmail },
      {
        $set: { role },
        $setOnInsert: { userId, name, email: normalizedEmail, provider },
      },
      { upsert: true, new: true }
    );

    if (!user) {
      user = existing
        ? {
            id: "id" in existing ? existing.id : existing.userId,
            name: existing.name,
            email: existing.email,
            passwordHash: existing.passwordHash,
            role,
            provider: existing.provider || provider,
            providerId: existing.providerId,
            avatar: existing.avatar,
          }
        : { id: userId, name, email: normalizedEmail, role, provider };
      users.push(user);
    } else {
      user.role = role;
    }
  } catch (error) {
    console.error("Staff account database update failed:", error);
    return { error: "The staff account could not be saved to the database." };
  }

  if (!user) {
    user = {
      id: randomUUID(),
      name: normalizedEmail.split("@")[0],
      email: normalizedEmail,
      role,
      provider: "local",
    };
    users.push(user);
  }

  return { user: publicUser(user) };
}

/**
 * Authenticate existing user with email and password
 */
export async function authenticate(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  // Try in-memory first
  let user = users.find((item) => item.email === normalizedEmail);

  // If not found in memory, check MongoDB
  if (!user) {
    try {
      const conn = await connect_db();
      if (conn) {
        const dbDoc = await UserModel.findOne({ email: normalizedEmail }).lean();
        if (dbDoc) {
          user = {
            id: dbDoc.userId,
            name: dbDoc.name,
            email: dbDoc.email,
            passwordHash: dbDoc.passwordHash,
            role: (dbDoc.role as UserRole) || "guest",
            provider: dbDoc.provider || "local",
            avatar: dbDoc.avatar,
          };
          users.push(user);
        }
      }
    } catch (err) {
      console.warn("Error looking up user in MongoDB:", err);
    }
  }

  if (!user || !user.passwordHash || !passwordMatches(password, user.passwordHash)) {
    return { error: "Incorrect email address or password." };
  }

  return { user: publicUser(user) };
}

/**
 * Find or create a user authenticated via Social Auth (Google)
 */
export async function findOrCreateSocialUser({
  provider,
  providerId,
  email,
  name,
  avatar,
  role = "guest",
}: {
  provider: AuthProvider | string;
  providerId?: string;
  email: string;
  name: string;
  avatar?: string;
  role?: UserRole;
}) {
  const normalizedEmail = email.trim().toLowerCase();
  const cleanName = name.trim() || normalizedEmail.split("@")[0] || "Guest";

  // Check if user exists in memory
  let user = users.find((item) => item.email === normalizedEmail);

  // Check MongoDB if not found in memory
  if (!user) {
    try {
      const conn = await connect_db();
      if (conn) {
        const dbDoc = await UserModel.findOne({ email: normalizedEmail }).lean();
        if (dbDoc) {
          user = {
            id: dbDoc.userId,
            name: dbDoc.name,
            email: dbDoc.email,
            passwordHash: dbDoc.passwordHash,
            role: (dbDoc.role as UserRole) || "guest",
            provider: dbDoc.provider || provider,
            providerId: dbDoc.providerId || providerId,
            avatar: dbDoc.avatar || avatar,
          };
          users.push(user);
        }
      }
    } catch (err) {
      console.warn("MongoDB social user search error:", err);
    }
  }

  if (user) {
    // User already exists, enrich profile details if missing
    if (!user.avatar && avatar) {
      user.avatar = avatar;
    }
    if (provider && user.provider === "local") {
      user.provider = provider;
    }
    if (providerId && !user.providerId) {
      user.providerId = providerId;
    }

    // Update in MongoDB
    try {
      const conn = await connect_db();
      if (conn) {
        await UserModel.updateOne(
          { userId: user.id },
          {
            $set: {
              ...(user.avatar ? { avatar: user.avatar } : {}),
              ...(providerId ? { providerId } : {}),
            },
          }
        );
      }
    } catch (err) {
      console.warn("Could not update social user in MongoDB:", err);
    }

    return { user: publicUser(user) };
  }

  // Create new social user
  const newUser: User = {
    id: randomUUID(),
    name: cleanName,
    email: normalizedEmail,
    role,
    provider,
    providerId,
    avatar:
      avatar ||
      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}&backgroundColor=ead8bf&textColor=5d402a`,
    createdAt: new Date(),
  };

  users.push(newUser);

  // Persist to MongoDB
  try {
    const conn = await connect_db();
    if (conn) {
      await UserModel.create({
        userId: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        provider: newUser.provider,
        providerId: newUser.providerId,
        avatar: newUser.avatar,
      });
    }
  } catch (err) {
    console.warn("Could not save new social user to MongoDB:", err);
  }

  return { user: publicUser(newUser) };
}

export function createSession(userId: string) {
  const token = randomUUID();
  sessions.set(token, { userId, expiresAt: Date.now() + sessionLifetime * 1000 });
  return token;
}

export function getSessionUser(token?: string): PublicUser | null {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  const user = users.find((item) => item.id === session.userId);
  return user ? publicUser(user) : null;
}

export async function findExistingUserByEmail(email: string): Promise<PublicUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  let user = users.find((item) => item.email === normalizedEmail);

  if (!user) {
    const conn = await connect_db();
    if (!conn) return null;

    const dbDoc = await UserModel.findOne({ email: normalizedEmail }).lean();
    if (!dbDoc) return null;

    user = {
      id: dbDoc.userId,
      name: dbDoc.name,
      email: dbDoc.email,
      passwordHash: dbDoc.passwordHash,
      role: (dbDoc.role as UserRole) || "guest",
      provider: dbDoc.provider || "local",
      providerId: dbDoc.providerId,
      avatar: dbDoc.avatar,
    };
    users.push(user);
  }

  return publicUser(user);
}

export function createMobileAuthCode(userId: string) {
  const code = randomUUID();
  mobileAuthCodes.set(code, { userId, expiresAt: Date.now() + 60_000 });
  return code;
}

export function exchangeMobileAuthCode(code: string) {
  const entry = mobileAuthCodes.get(code);
  mobileAuthCodes.delete(code);
  if (!entry || entry.expiresAt < Date.now()) return null;

  const token = createSession(entry.userId);
  const user = getSessionUser(token);
  return user ? { token, user } : null;
}

export function getRequestUser(request: NextRequest | Request): PublicUser | null {
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer) return getSessionUser(bearer);

  const cookie = request.headers.get("cookie")?.match(/(?:^|; )hotel_session=([^;]+)/)?.[1];
  return getSessionUser(cookie);
}

export function deleteSession(token?: string) {
  if (token) sessions.delete(token);
}

/**
 * Returns whether real OAuth environment variables are set for Google
 */
export function getSocialAuthConfig() {
  const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || "";

  return {
    google: {
      configured: Boolean(googleClientId && googleClientSecret),
      clientId: googleClientId ? `${googleClientId.substring(0, 12)}...` : null,
    },
  };
}
