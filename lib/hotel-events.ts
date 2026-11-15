import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import connect_db from '@/lib/mongodb';

export type HotelEvent = {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
};

const eventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    type: { type: String, required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
  },
  { timestamps: true },
);

const pushDeviceSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    token: { type: String, required: true, unique: true },
    lastSeen: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

const HotelEventModel = mongoose.models.HotelEvent ?? mongoose.model('HotelEvent', eventSchema);
const PushDeviceModel = mongoose.models.HotelPushDevice ?? mongoose.model('HotelPushDevice', pushDeviceSchema);
const memoryEvents: HotelEvent[] = [];

function formatEvent(item: {
  eventId?: string;
  _id?: unknown;
  type: string;
  title: string;
  message: string;
  createdAt?: Date | string;
}): HotelEvent {
  return {
    id: item.eventId || String(item._id || ''),
    type: item.type,
    title: item.title,
    message: item.message,
    createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : String(item.createdAt || new Date().toISOString()),
  };
}

async function sendPushNotifications(event: HotelEvent) {
  try {
    const connection = await connect_db();
    if (!connection) return;
    const devices = await PushDeviceModel.find().select({ token: 1, _id: 0 }).lean();
    if (!devices.length) return;

    for (let index = 0; index < devices.length; index += 100) {
      const batch = devices.slice(index, index + 100).map((device) => ({
        to: String(device.token),
        sound: 'default',
        title: event.title,
        body: event.message,
        data: { eventId: event.id, tab: 'activity' },
        channelId: 'hotel-activity',
      }));
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(5000),
      });
    }
  } catch (error) {
    console.warn('Hotel activity push delivery failed:', error);
  }
}

export async function recordHotelEvent(input: Omit<HotelEvent, 'id' | 'createdAt'>) {
  const event: HotelEvent = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };

  try {
    const connection = await connect_db();
    if (!connection) throw new Error('MongoDB is not connected');
    const saved = await HotelEventModel.create({
      eventId: event.id,
      type: event.type,
      title: event.title,
      message: event.message,
    });
    event.createdAt = saved.createdAt instanceof Date ? saved.createdAt.toISOString() : event.createdAt;
  } catch (error) {
    memoryEvents.unshift(event);
    memoryEvents.splice(100);
    console.warn('Hotel activity stored in memory:', error);
  }

  await sendPushNotifications(event);
  return event;
}

export async function getHotelEvents(since?: string) {
  try {
    const connection = await connect_db();
    if (!connection) throw new Error('MongoDB is not connected');
    const filter = since && !Number.isNaN(Date.parse(since)) ? { createdAt: { $gt: new Date(since) } } : {};
    const events = await HotelEventModel.find(filter).sort({ createdAt: -1 }).limit(50).lean();
    return events.map(formatEvent);
  } catch {
    if (since && !Number.isNaN(Date.parse(since))) {
      const timestamp = Date.parse(since);
      return memoryEvents.filter((item) => Date.parse(item.createdAt) > timestamp).slice(0, 50);
    }
    return memoryEvents.slice(0, 50);
  }
}

export async function registerHotelPushDevice(userId: string, token: string) {
  const connection = await connect_db();
  if (!connection) throw new Error('Push notifications require a database connection.');
  await PushDeviceModel.findOneAndUpdate(
    { token },
    { $set: { userId, lastSeen: new Date() } },
    { upsert: true, new: true },
  );
}

export async function unregisterHotelPushDevice(userId: string, token: string) {
  const connection = await connect_db();
  if (!connection) return;
  await PushDeviceModel.deleteOne({ userId, token });
}