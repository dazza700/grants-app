/**
 * Normalize grant data from various sources into our unified schema
 */

import type { Grant } from '@/lib/supabase/types';
import {
  SimplerGrantOpportunity,
  mapApplicantTypes,
  mapCategory,
} from './simpler-grants';

/**
 * Safely parse a date string, returning null if invalid
 */
function safeParseDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}

/**
 * Normalize a Simpler.Grants.gov opportunity to our Grant schema
 */
export function normalizeSimplertGrant(opportunity: SimplerGrantOpportunity): Omit<Grant, 'id' | 'created_at' | 'updated_at'> {
  // Parse deadline - use a far future date if missing (will be filtered out by validator)
  const deadline = safeParseDate(opportunity.close_date) || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  return {
    title: opportunity.opportunity_title || 'Untitled Grant',
    description: opportunity.summary?.summary_description || null,
    source_id: opportunity.opportunity_id || String(Math.random()),
    source: 'grants_gov',
    amount_min: opportunity.award_floor,
    amount_max: opportunity.award_ceiling,
    funding_available: opportunity.estimated_total_program_funding,
    eligible_organization_types: mapApplicantTypes(opportunity.applicant_types || []),
    eligible_states: [], // Federal grants are generally available nationwide
    industry_categories: mapCategory(opportunity.category || ''),
    posted_date: safeParseDate(opportunity.posted_date),
    deadline,
    award_start_date: null,
    expected_award_date: null,
    agency_name: opportunity.agency_name || null,
    agency_code: opportunity.agency_code || null,
    contact_email: null,
    url: opportunity.summary?.additional_info_url || `https://www.grants.gov/search-results-detail/${opportunity.opportunity_id}`,
    cfda_number: opportunity.cfda_numbers?.join(', ') || null,
    competition_id: opportunity.opportunity_number || null,
    raw_data: opportunity as unknown as Record<string, unknown>,
    synced_from_external: new Date().toISOString(),
  };
}

/**
 * Deduplicate grants by source_id
 */
export function deduplicateGrants(
  newGrants: Omit<Grant, 'id' | 'created_at' | 'updated_at'>[],
  existingSourceIds: Set<string>
): Omit<Grant, 'id' | 'created_at' | 'updated_at'>[] {
  return newGrants.filter((grant) => !existingSourceIds.has(grant.source_id));
}

/**
 * Validate grant data
 */
export function validateGrant(grant: Omit<Grant, 'id' | 'created_at' | 'updated_at'>): boolean {
  // Required fields
  if (!grant.title || !grant.source_id || !grant.deadline) {
    return false;
  }

  // Deadline must be in the future
  if (new Date(grant.deadline) < new Date()) {
    return false;
  }

  return true;
}
