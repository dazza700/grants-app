import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { SimplerGrantsClient } from '@/lib/grants-api/simpler-grants';
import { normalizeSimplertGrant, validateGrant, deduplicateGrants } from '@/lib/grants-api/normalizer';

// Verify cron secret for security
function verifyCronSecret(request: Request): boolean {
  // Allow localhost requests for development
  const url = new URL(request.url);
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return true;
  }

  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn('CRON_SECRET not set, allowing request');
    return true;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const logs: string[] = [];

  const log = (message: string) => {
    const timestamp = new Date().toISOString();
    logs.push(`[${timestamp}] ${message}`);
    console.log(`[sync-grants] ${message}`);
  };

  try {
    log('Starting grant sync...');

    const supabase = createAdminSupabaseClient();
    const grantsClient = new SimplerGrantsClient();

    // Get existing grant source IDs to avoid duplicates
    log('Fetching existing grant IDs...');
    const { data: existingGrants } = await supabase
      .from('grants')
      .select('source_id')
      .eq('source', 'grants_gov');

    const existingSourceIds = new Set(existingGrants?.map((g: any) => g.source_id) || []);
    log(`Found ${existingSourceIds.size} existing grants`);

    // Fetch posted opportunities from Simpler.Grants.gov
    log('Fetching opportunities from Simpler.Grants.gov...');

    let totalFetched = 0;
    let totalInserted = 0;
    let totalSkipped = 0;
    let totalInvalid = 0;

    // Fetch in batches to handle large datasets
    const pageSize = 100;
    let pageOffset = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await grantsClient.searchOpportunities({
        status: 'posted',
        page_offset: pageOffset,
        page_size: pageSize,
        sort_by: 'posted_date',
        sort_order: 'desc',
      });

      const opportunities = response.data;
      totalFetched += opportunities.length;

      log(`Fetched batch: ${opportunities.length} opportunities (total: ${totalFetched})`);

      // Normalize and validate grants
      const normalizedGrants = opportunities.map(normalizeSimplertGrant);
      const validGrants = normalizedGrants.filter(validateGrant);
      const newGrants = deduplicateGrants(validGrants, existingSourceIds);

      totalInvalid += normalizedGrants.length - validGrants.length;
      totalSkipped += validGrants.length - newGrants.length;

      // Insert new grants in batches
      if (newGrants.length > 0) {
        const { error } = await (supabase.from('grants') as any).insert(newGrants);

        if (error) {
          log(`Error inserting grants: ${error.message}`);
        } else {
          totalInserted += newGrants.length;
          // Add to existing set to prevent duplicates in subsequent batches
          newGrants.forEach((g) => existingSourceIds.add(g.source_id));
        }
      }

      // Check if there are more pages
      const totalRecords = response.pagination?.total_records || (response as any).pagination_info?.total_records || 0;
      if (opportunities.length < pageSize || totalFetched >= totalRecords || totalRecords === 0) {
        hasMore = false;
      } else {
        pageOffset += pageSize;
        // Rate limiting: wait between requests
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Safety limit to prevent infinite loops
      if (totalFetched >= 10000) {
        log('Reached safety limit of 10,000 grants');
        hasMore = false;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    log(`Sync complete in ${duration}s:`);
    log(`  - Fetched: ${totalFetched}`);
    log(`  - Inserted: ${totalInserted}`);
    log(`  - Skipped (duplicates): ${totalSkipped}`);
    log(`  - Invalid: ${totalInvalid}`);

    return NextResponse.json({
      success: true,
      stats: {
        fetched: totalFetched,
        inserted: totalInserted,
        skipped: totalSkipped,
        invalid: totalInvalid,
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

// Also support POST for manual triggers
export async function POST(request: Request) {
  return GET(request);
}
