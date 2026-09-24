import mongoose from "mongoose";

mongoose.set("bufferCommands", false);

const dbUri: string = process.env.MONGODB_URI ?? process.env.MONGO_URI ?? "";

declare global {
  var mongooseCache: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose | null> | null;
  } | undefined;
}

const cached = globalThis.mongooseCache ?? (globalThis.mongooseCache = { conn: null, promise: null });

export default async function connect_db(): Promise<typeof mongoose | null> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!dbUri) {
    return null;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(dbUri, {
        serverSelectionTimeoutMS: 2000,
        bufferCommands: false,
      })
      .then((m) => m)
      .catch((err) => {
        console.warn("MongoDB connection failed, running in fallback mode:", err?.message || err);
        return null;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch {
    cached.promise = null;
    return null;
  }

  return cached.conn;
}

