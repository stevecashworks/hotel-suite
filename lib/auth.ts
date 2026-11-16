import { createHash, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import connect_db from "@/lib/mongodb";

export type UserRole = "guest" | "admin" | "staff" | "kitchen" | "bar" | "room-service";
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
    role: { type: String, enum: ["guest", "admin", "staff", "kitchen", "bar", "room-service"], default: "guest" },
    provider: { type: String, default: "local" },
    providerId: { type: String },
    avatar: { type: String },
  },
  { timestamps: true }
);

const UserModel = mongoose.models.User ?? mongoose.model("User", userSchema);

const sessionSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true, expires: 0 },
});

const SessionModel = mongoose.models.AuthSession ?? mongoose.model("AuthSession", sessionSchema);

const mobileAuthCodeSchema = new mongoose.Schema({
  codeHash: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true, expires: 0 },
});

const MobileAuthCodeModel =
  mongoose.models.MobileAuthCode ?? mongoose.model("MobileAuthCode", mobileAuthCodeSchema);

// In-memory user cache & fallback store
const users: User[] = [];
const sessions = new Map<string, { userId: string; expiresAt: number }>();
const mobileAuthCodes = new Map<string, { userId: string; expiresAt: number }>();
export const sessionLifetime = 60 * 60 * 24 * 7; // 7 days in seconds
export const sessionMaxAge = sessionLifetime;

const adminEmail = (process.env.HOTEL_ADMIN_EMAIL ?? "").trim().toLowerCase();

function roleForAccount(email: string, role: UserRole): UserRole {
  return adminEmail && email.trim().toLowerCase() === adminEmail ? "admin" : role;
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

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function requirePersistentSessionStore() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Session storage is unavailable. Check the MongoDB connection.");
  }
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
  if (role !== "guest") {
    return { error: "Staff and administrator accounts must be created by hotel management." };
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

export async function provisionStaffUser({
  email,
  role,
}: {
  email: string;
  role: Exclude<UserRole, "guest" | "admin" | "staff">;
}) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    return { error: "Enter a valid staff email address." };
  }
  if (normalizedEmail === adminEmail) {
    return { error: "The hotel administrator account cannot be assigned a department role." };
  }

  let user = users.find((item) => item.email === normalizedEmail);
  try {
    const conn = await connect_db();
    if (!conn) {
      return { error: "Staff accounts cannot be added because the database is unavailable." };
    }

    const existing = user || await UserModel.findOne({ email: normalizedEmail }).lean();
    if (existing && (existing.role === "admin" || existing.role === "staff")) {
      return { error: "Administrator accounts cannot be assigned a department role." };
    }
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
  if (user) {
    user.role = roleForAccount(user.email, user.role);
  }

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
            role: roleForAccount(dbDoc.email, (dbDoc.role as UserRole) || "guest"),
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
  if (user) {
    user.role = roleForAccount(user.email, user.role);
  }

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
            role: roleForAccount(dbDoc.email, (dbDoc.role as UserRole) || "guest"),
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
    role: roleForAccount(normalizedEmail, role),
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

export async function createSession(userId: string) {
  const token = randomUUID();
  const expiresAt = Date.now() + sessionLifetime * 1000;
  const connection = await connect_db();
  if (!connection) {
    requirePersistentSessionStore();
    sessions.set(token, { userId, expiresAt });
    return token;
  }

  await SessionModel.create({
    tokenHash: hashSessionToken(token),
    userId,
    expiresAt: new Date(expiresAt),
  });
  sessions.set(token, { userId, expiresAt });
  return token;
}

export async function getSessionUser(token?: string): Promise<PublicUser | null> {
  if (!token) return null;

  const connection = await connect_db();
  if (!connection) {
    requirePersistentSessionStore();
    const session = sessions.get(token);
    if (!session || session.expiresAt < Date.now()) {
      sessions.delete(token);
      return null;
    }
    const user = users.find((item) => item.id === session.userId);
    return user ? publicUser(user) : null;
  }

  const session = await SessionModel.findOne({
    tokenHash: hashSessionToken(token),
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!session) return null;

  const dbDoc = await UserModel.findOne({ userId: session.userId }).lean();
  if (!dbDoc) return null;

  const user: User = {
    id: dbDoc.userId,
    name: dbDoc.name,
    email: dbDoc.email,
    passwordHash: dbDoc.passwordHash,
    role: roleForAccount(dbDoc.email, (dbDoc.role as UserRole) || "guest"),
    provider: dbDoc.provider || "local",
    providerId: dbDoc.providerId,
    avatar: dbDoc.avatar,
  };
  const cachedUserIndex = users.findIndex((item) => item.id === user.id);
  if (cachedUserIndex < 0) users.push(user);
  else users[cachedUserIndex] = user;
  return publicUser(user);
}

export async function findExistingUserByEmail(email: string): Promise<PublicUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  let user = users.find((item) => item.email === normalizedEmail);
  if (user) {
    user.role = roleForAccount(user.email, user.role);
  }

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
      role: roleForAccount(dbDoc.email, (dbDoc.role as UserRole) || "guest"),
      provider: dbDoc.provider || "local",
      providerId: dbDoc.providerId,
      avatar: dbDoc.avatar,
    };
    users.push(user);
  }

  return publicUser(user);
}

export async function createMobileAuthCode(userId: string) {
  const code = randomUUID();
  const expiresAt = Date.now() + 60_000;
  const connection = await connect_db();
  if (!connection) {
    requirePersistentSessionStore();
    mobileAuthCodes.set(code, { userId, expiresAt });
    return code;
  }

  await MobileAuthCodeModel.create({
    codeHash: hashSessionToken(code),
    userId,
    expiresAt: new Date(expiresAt),
  });
  return code;
}

export async function exchangeMobileAuthCode(code: string) {
  const connection = await connect_db();
  let userId: string | undefined;
  if (!connection) {
    requirePersistentSessionStore();
    const entry = mobileAuthCodes.get(code);
    mobileAuthCodes.delete(code);
    if (!entry || entry.expiresAt < Date.now()) return null;
    userId = entry.userId;
  } else {
    const entry = await MobileAuthCodeModel.findOneAndDelete({
      codeHash: hashSessionToken(code),
      expiresAt: { $gt: new Date() },
    }).lean();
    userId = entry?.userId;
  }
  if (!userId) return null;

  const token = await createSession(userId);
  const user = await getSessionUser(token);
  return user ? { token, user } : null;
}

export async function getRequestUser(request: NextRequest | Request): Promise<PublicUser | null> {
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer) return getSessionUser(bearer);

  const cookie = request.headers.get("cookie")?.match(/(?:^|; )hotel_session=([^;]+)/)?.[1];
  return getSessionUser(cookie);
}

export async function deleteSession(token?: string) {
  if (!token) return;
  sessions.delete(token);
  const connection = await connect_db();
  if (!connection) {
    requirePersistentSessionStore();
    return;
  }
  await SessionModel.deleteOne({ tokenHash: hashSessionToken(token) });
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
