import mongoose from "mongoose";

const dbUri: string = process.env.MONGODB_URI ?? process.env.MONGO_URI ?? "";

if (!dbUri) {
  throw new Error("Please define MONGODB_URI (or MONGO_URI) in your .env.local file.");
}

declare global {
  var mongooseCache: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  } | undefined;
}

const cached = globalThis.mongooseCache ?? (globalThis.mongooseCache = { conn: null, promise: null });

export default async function connect_db(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(dbUri, {
      serverSelectionTimeoutMS: 5000,
      bufferCommands: false,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}
