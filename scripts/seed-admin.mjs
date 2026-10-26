import { randomUUID, scryptSync } from "node:crypto";
import mongoose from "mongoose";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const email = process.env.HOTEL_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.HOTEL_ADMIN_PASSWORD;
const databaseUri = process.env.MONGODB_URI ?? process.env.MONGO_URI;

if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
  throw new Error("Set HOTEL_ADMIN_EMAIL to a valid email address.");
}
if (!password || password.length < 8) {
  throw new Error("Set HOTEL_ADMIN_PASSWORD to a password of at least 8 characters.");
}
if (!databaseUri) {
  throw new Error("Set MONGODB_URI or MONGO_URI before seeding the administrator.");
}

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
const salt = randomUUID();
const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;

try {
  await mongoose.connect(databaseUri, { serverSelectionTimeoutMS: 5000, bufferCommands: false });
  await UserModel.findOneAndUpdate(
    { email },
    {
      $set: { role: "admin", passwordHash, provider: "local" },
      $setOnInsert: { userId: randomUUID(), name: "Hotel Administrator", email },
    },
    { upsert: true, returnDocument: "after", runValidators: true }
  );
  await UserModel.updateMany({ role: "staff" }, { $set: { role: "admin" } });
  console.info(`Administrator account saved for ${email}.`);
} catch (error) {
  console.error("Could not save the administrator account to MongoDB:", error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
