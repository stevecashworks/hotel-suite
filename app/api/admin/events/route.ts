import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { isAdminRole } from '@/lib/auth-routing';
import { getHotelEvents, registerHotelPushDevice, unregisterHotelPushDevice } from '@/lib/hotel-events';

export async function GET(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user || !isAdminRole(user.role)) {
    return NextResponse.json({ error: 'Administrator access is required.' }, { status: 403 });
  }

  const since = request.nextUrl.searchParams.get('since') || undefined;
  const events = await getHotelEvents(since);
  return NextResponse.json({ events }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user || !isAdminRole(user.role)) {
    return NextResponse.json({ error: 'Administrator access is required.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const token = typeof body?.payload?.token === 'string' ? body.payload.token.trim() : '';
    if (!/^(Expo|Exponent)PushToken\[[^\]]+\]$/.test(token)) {
      return NextResponse.json({ error: 'A valid Expo push token is required.' }, { status: 400 });
    }
    if (body?.action === 'register-push-token') {
      await registerHotelPushDevice(user.id, token);
    } else if (body?.action === 'unregister-push-token') {
      await unregisterHotelPushDevice(user.id, token);
    } else {
      return NextResponse.json({ error: 'Unsupported notification action.' }, { status: 400 });
    }
    return NextResponse.json({ status: 'success' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Push registration could not be saved.';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}