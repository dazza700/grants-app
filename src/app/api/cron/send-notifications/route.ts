import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { scoreGrantForUser } from '@/lib/matching/scorer';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Verify cron secret for security
function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn('CRON_SECRET not set, allowing request');
    return true;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const logs: string[] = [];

  const log = (message: string) => {
    logs.push(`[${new Date().toISOString()}] ${message}`);
    console.log(`[send-notifications] ${message}`);
  };

  try {
    log('Starting notification processing...');

    const supabase = createAdminSupabaseClient();
    const now = new Date();

    // Get grants posted in the last 24 hours that haven't been processed
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const { data: newGrants, error: grantsError } = await supabase
      .from('grants')
      .select('*')
      .gte('posted_date', yesterday.toISOString())
      .gte('deadline', now.toISOString());

    if (grantsError) {
      throw new Error(`Failed to fetch grants: ${grantsError.message}`);
    }

    log(`Found ${newGrants?.length || 0} new grants to process`);

    if (!newGrants || newGrants.length === 0) {
      return NextResponse.json({
        success: true,
        stats: { processed: 0, notifications: 0, emails: 0 },
        logs,
      });
    }

    // Get users with their criteria and preferences
    // Filter by email frequency - for immediate, we process now
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select(`
        *,
        user_criteria(*),
        notification_preferences(*)
      `);

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    log(`Processing ${users?.length || 0} users`);

    let totalNotifications = 0;
    let totalEmails = 0;

    for (const user of (users || []) as any[]) {
      const criteria = user.user_criteria?.[0];
      const preferences = user.notification_preferences?.[0];

      if (!criteria) {
        continue; // Skip users without criteria
      }

      // Skip if not immediate frequency (daily/weekly handled separately)
      if (preferences?.email_frequency !== 'immediate') {
        continue;
      }

      // Find matching grants for this user
      const matchingGrants: Array<{ grant: any; score: any }> = [];

      for (const grant of newGrants as any[]) {
        // Check if we already notified this user about this grant
        const { data: existing } = await supabase
          .from('notification_history')
          .select('id')
          .eq('user_id', user.id)
          .eq('grant_id', grant.id)
          .single();

        if (existing) {
          continue; // Already notified
        }

        const score = scoreGrantForUser(
          grant,
          criteria,
          preferences,
          user.organization_type
        );

        if (score.isEligible) {
          matchingGrants.push({ grant, score });

          // Create notification record
          await (supabase.from('notification_history') as any).insert({
            user_id: user.id,
            grant_id: grant.id,
            match_score: score.totalScore,
            email_sent: false,
          });

          totalNotifications++;
        }
      }

      // Send email if there are matching grants
      if (matchingGrants.length > 0 && process.env.RESEND_API_KEY) {
        try {
          const emailContent = generateEmailContent(matchingGrants, user);

          await resend.emails.send({
            from: 'GrantMatch <notifications@yourdomain.com>',
            to: user.email,
            subject: `${matchingGrants.length} new grant${matchingGrants.length > 1 ? 's' : ''} match your profile`,
            html: emailContent,
          });

          // Update notification records
          for (const { grant } of matchingGrants) {
            await (supabase
              .from('notification_history') as any)
              .update({
                email_sent: true,
                email_sent_at: new Date().toISOString(),
              })
              .eq('user_id', user.id)
              .eq('grant_id', grant.id);
          }

          totalEmails++;
          log(`Sent email to ${user.email} with ${matchingGrants.length} grants`);
        } catch (emailError) {
          log(`Failed to send email to ${user.email}: ${emailError}`);
        }
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    log(`Processing complete in ${duration}s:`);
    log(`  - Notifications created: ${totalNotifications}`);
    log(`  - Emails sent: ${totalEmails}`);

    return NextResponse.json({
      success: true,
      stats: {
        processed: newGrants.length,
        notifications: totalNotifications,
        emails: totalEmails,
        duration: `${duration}s`,
      },
      logs,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`Processing failed: ${errorMessage}`);

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

function generateEmailContent(
  matchingGrants: Array<{ grant: any; score: any }>,
  user: any
): string {
  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'Not specified';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const grantsList = matchingGrants
    .slice(0, 10) // Limit to 10 grants per email
    .map(
      ({ grant, score }) => `
      <tr>
        <td style="padding: 20px; border-bottom: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 8px 0; color: #1f2937; font-size: 18px;">
            ${grant.title}
          </h3>
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">
            ${grant.agency_name || 'Unknown Agency'}
          </p>
          <p style="margin: 0 0 12px 0; color: #4b5563; font-size: 14px; line-height: 1.5;">
            ${grant.description?.substring(0, 200)}${grant.description?.length > 200 ? '...' : ''}
          </p>
          <div style="display: flex; gap: 16px; margin-bottom: 12px;">
            <span style="background: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 9999px; font-size: 14px;">
              ${formatCurrency(grant.amount_min)}${grant.amount_max && grant.amount_max !== grant.amount_min ? ` - ${formatCurrency(grant.amount_max)}` : ''}
            </span>
            <span style="background: #fee2e2; color: #991b1b; padding: 4px 12px; border-radius: 9999px; font-size: 14px;">
              Deadline: ${formatDate(grant.deadline)}
            </span>
          </div>
          <a href="${grant.url || `${process.env.NEXT_PUBLIC_APP_URL}/grants`}"
             style="display: inline-block; background: #2563eb; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 14px;">
            View Grant →
          </a>
        </td>
      </tr>
    `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <div style="background: #2563eb; padding: 24px; text-align: center;">
          <h1 style="margin: 0; color: white; font-size: 24px;">GrantMatch</h1>
        </div>

        <!-- Content -->
        <div style="padding: 24px;">
          <h2 style="margin: 0 0 8px 0; color: #1f2937; font-size: 20px;">
            ${matchingGrants.length} New Grant${matchingGrants.length > 1 ? 's' : ''} Match Your Profile!
          </h2>
          <p style="margin: 0 0 24px 0; color: #6b7280;">
            We found grant opportunities that match your eligibility criteria.
          </p>

          <table style="width: 100%; border-collapse: collapse;">
            ${grantsList}
          </table>

          ${matchingGrants.length > 10 ? `
            <p style="text-align: center; margin: 24px 0; color: #6b7280;">
              And ${matchingGrants.length - 10} more...
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/grants" style="color: #2563eb;">View all on GrantMatch</a>
            </p>
          ` : ''}
        </div>

        <!-- Footer -->
        <div style="background: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">
            You're receiving this because you signed up for grant notifications.
          </p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/settings" style="color: #2563eb; font-size: 14px;">
            Manage notification preferences
          </a>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function POST(request: Request) {
  return GET(request);
}
