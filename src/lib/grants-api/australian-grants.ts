/**
 * Australian Grants API Client
 * Sources: GrantConnect RSS, business.gov.au
 */

export interface AustralianGrant {
  title: string;
  description: string;
  source_id: string;
  agency_name: string;
  url: string;
  published_date: string;
  closing_date?: string;
  amount_min?: number;
  amount_max?: number;
  state?: string;
  categories?: string[];
}

// GrantConnect RSS feed URL
const GRANT_CONNECT_RSS = 'https://www.grants.gov.au/Rss/Open';

/**
 * Extract content from an XML tag using regex (Node.js compatible)
 */
function extractTag(xml: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tagName}>|<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i');
  const match = xml.match(regex);
  if (!match) return '';
  return (match[1] || match[2] || '').trim();
}

/**
 * Parse RSS XML to extract grant data
 */
function parseRSSItem(itemXml: string): AustralianGrant | null {
  try {
    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const description = extractTag(itemXml, 'description');
    const pubDate = extractTag(itemXml, 'pubDate');
    const guid = extractTag(itemXml, 'guid') || link;

    if (!title || !link) return null;

    // Try to extract closing date from description
    const closingMatch = description.match(/(?:closes?|closing|deadline)[:\s]*(\d{1,2}[\s\/\-]\w+[\s\/\-]\d{2,4})/i);
    const closingDate = closingMatch ? parseAustralianDate(closingMatch[1]) : null;

    // Try to extract amount from description
    const amountMatch = description.match(/\$[\d,]+(?:\s*-\s*\$[\d,]+)?/);
    let amountMin: number | undefined;
    let amountMax: number | undefined;

    if (amountMatch) {
      const amounts = amountMatch[0].match(/\$[\d,]+/g);
      if (amounts) {
        amountMin = parseInt(amounts[0].replace(/[$,]/g, ''));
        amountMax = amounts[1] ? parseInt(amounts[1].replace(/[$,]/g, '')) : amountMin;
      }
    }

    // Try to extract agency from title or description
    const agencyMatch = title.match(/^([^-–]+)[-–]/) || description.match(/(?:from|by)\s+([^.]+(?:Department|Agency|Government|Council))/i);
    const agencyName = agencyMatch ? agencyMatch[1].trim() : 'Australian Government';

    return {
      title: title.trim(),
      description: cleanHTML(description),
      source_id: `AU-GC-${hashString(guid)}`,
      agency_name: agencyName,
      url: link,
      published_date: pubDate,
      closing_date: closingDate || undefined,
      amount_min: amountMin,
      amount_max: amountMax,
    };
  } catch (error) {
    console.error('Error parsing RSS item:', error);
    return null;
  }
}

/**
 * Parse Australian date format (e.g., "15 March 2026" or "15/03/2026")
 */
function parseAustralianDate(dateStr: string): string | null {
  try {
    // Try various formats
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }

    // Try DD/MM/YYYY format
    const ddmmyyyy = dateStr.match(/(\d{1,2})[\s\/\-](\d{1,2})[\s\/\-](\d{2,4})/);
    if (ddmmyyyy) {
      const [, day, month, year] = ddmmyyyy;
      const fullYear = year.length === 2 ? `20${year}` : year;
      const parsed = new Date(`${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Clean HTML tags from text
 */
function cleanHTML(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Simple hash function for creating IDs
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Fetch grants from GrantConnect RSS feed
 */
export async function fetchGrantConnectGrants(): Promise<AustralianGrant[]> {
  try {
    const response = await fetch(GRANT_CONNECT_RSS, {
      headers: {
        'User-Agent': 'GrantMatch/1.0 (Australian Grant Aggregator)',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch RSS: ${response.status}`);
    }

    const xml = await response.text();

    // Parse XML using regex (Node.js compatible)
    const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
    const grants: AustralianGrant[] = [];

    for (const itemXml of itemMatches) {
      const grant = parseRSSItem(itemXml);
      if (grant) {
        grants.push(grant);
      }
    }

    return grants;
  } catch (error) {
    console.error('Error fetching GrantConnect RSS:', error);
    return [];
  }
}

/**
 * Normalize Australian grant to our database schema
 */
export function normalizeAustralianGrant(grant: AustralianGrant): Record<string, any> {
  // Default deadline to 90 days from now if not specified
  const deadline = grant.closing_date || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  return {
    title: grant.title,
    description: grant.description,
    source_id: grant.source_id,
    source: 'grants_gov', // Using grants_gov enum value for now
    amount_min: grant.amount_min || null,
    amount_max: grant.amount_max || null,
    funding_available: null,
    eligible_organization_types: ['small_business', 'nonprofit', 'individual'],
    eligible_states: grant.state ? [grant.state] : [],
    industry_categories: grant.categories || ['Other'],
    posted_date: grant.published_date ? new Date(grant.published_date).toISOString() : new Date().toISOString(),
    deadline,
    award_start_date: null,
    expected_award_date: null,
    agency_name: grant.agency_name,
    agency_code: null,
    contact_email: null,
    url: grant.url,
    cfda_number: null,
    competition_id: null,
    raw_data: grant,
    synced_from_external: new Date().toISOString(),
  };
}
