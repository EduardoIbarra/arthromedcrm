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
    
    // Call the sync route POST handler
    const response = await syncPost(request);
    
    console.log('[Cron Cotizaciones Sync] Completed sync successfully.');
    return response;
  } catch (error: any) {
    console.error('[Cron Cotizaciones Sync] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
