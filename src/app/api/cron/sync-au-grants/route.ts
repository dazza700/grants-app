import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { fetchGrantConnectGrants, normalizeAustralianGrant } from '@/lib/grants-api/australian-grants';

export async function GET(request: Request) {
  // Allow localhost requests for development
  const url = new URL(request.url);
  if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const startTime = Date.now();
  const logs: string[] = [];

  const log = (message: string) => {
    const timestamp = new Date().toISOString();
    logs.push(`[${timestamp}] ${message}`);
    console.log(`[sync-au-grants] ${message}`);
  };

  try {
    log('Starting Australian grant sync...');

    const supabase = createAdminSupabaseClient();

    // Get existing grant source IDs to avoid duplicates
    log('Fetching existing grant IDs...');
    const { data: existingGrants } = await supabase
      .from('grants')
      .select('source_id')
      .like('source_id', 'AU-%');

    const existingSourceIds = new Set(existingGrants?.map((g) => g.source_id) || []);
    log(`Found ${existingSourceIds.size} existing Australian grants`);

    // Fetch from GrantConnect RSS
    log('Fetching grants from GrantConnect RSS...');
    let grants;
    try {
      grants = await fetchGrantConnectGrants();
      log(`Fetched ${grants.length} grants from RSS feed`);
    } catch (fetchError) {
      const errorMsg = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error';
      log(`Failed to fetch from GrantConnect: ${errorMsg}`);
      return NextResponse.json({
        success: false,
        error: `Failed to fetch Australian grants: ${errorMsg}. Make sure you can access https://www.grants.gov.au/Rss/Open from your network.`,
        logs,
      }, { status: 500 });
    }

    if (grants.length === 0) {
      log('No grants received from RSS feed - this could mean the feed is empty or inaccessible');
    }

    let totalInserted = 0;
    let totalSkipped = 0;

    for (const grant of grants) {
      const normalized = normalizeAustralianGrant(grant);

      if (existingSourceIds.has(normalized.source_id)) {
        totalSkipped++;
        continue;
      }

      const { error } = await supabase.from('grants').insert(normalized);

      if (error) {
        log(`Error inserting grant "${grant.title}": ${error.message}`);
      } else {
        totalInserted++;
        existingSourceIds.add(normalized.source_id);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    log(`Sync complete in ${duration}s:`);
    log(`  - Fetched: ${grants.length}`);
    log(`  - Inserted: ${totalInserted}`);
    log(`  - Skipped (duplicates): ${totalSkipped}`);

    return NextResponse.json({
      success: true,
      stats: {
        fetched: grants.length,
        inserted: totalInserted,
        skipped: totalSkipped,
        duration: `${duration}s`,
      },
      logs,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`Sync failed: ${errorMessage}`);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        logs,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
