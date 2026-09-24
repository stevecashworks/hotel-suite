import { NextResponse } from "next/server";
import { getDashboardMetricsFromDb } from "@/lib/reservation-db";

export async function GET() {
  const data = await getDashboardMetricsFromDb();
  return NextResponse.json(data);
}
