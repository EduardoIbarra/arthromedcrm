import { NextRequest, NextResponse } from 'next/server';
import { POST as syncPost } from '@/app/api/cotizaciones/sync/route';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}

async function handleCron(request: NextRequest) {
  try {
    // Prevent running cron job logic on non-production environments (e.g., develop or preview)
    if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
      console.log(`[Cron Cotizaciones Sync] Skipped: Cron jobs are disabled on non-production environments (current: ${process.env.VERCEL_ENV})`);
      return NextResponse.json({ message: `Cron jobs are disabled on non-production environments (current: ${process.env.VERCEL_ENV})` });
    }

    // 1. Authorization check using CRON_SECRET (standard for Vercel Cron Jobs)
    const authHeader = request.headers.get('Authorization');
    let isAuthorized = false;

    if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      console.warn('[Cron Cotizaciones Sync] Unauthorized access attempt.');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Cron Cotizaciones Sync] Starting automated synchronization...');
    
    // Call the sync route POST handler with recent=true query param to fetch only the first page
    const syncUrl = new URL(request.url);
    syncUrl.searchParams.set('recent', 'true');
    const syncRequest = new NextRequest(syncUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
      duplex: 'half'
    });

    const response = await syncPost(syncRequest);
    
    console.log('[Cron Cotizaciones Sync] Completed sync successfully.');
    return response;
  } catch (error: any) {
    console.error('[Cron Cotizaciones Sync] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
