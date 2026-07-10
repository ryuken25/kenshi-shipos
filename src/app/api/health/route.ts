import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    app: 'Kenshi ShipOS',
    productVersion: 'v5',
    storageVersion: 5,
    buildSha: process.env.NEXT_PUBLIC_BUILD_SHA || 'local',
    buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString(),
    analyticsDomain: 'kenshi-shipos.vercel.app',
  });
}
