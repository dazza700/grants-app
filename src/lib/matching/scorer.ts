/**
 * Grant Matching Algorithm
 * Scores grants against user criteria to determine relevance
 */

import type { Grant, UserCriteria, NotificationPreferences } from '@/lib/supabase/types';

export interface MatchScore {
  totalScore: number;
  matches: {
    orgType: number;
    location: number;
    industry: number;
    amount: number;
    special: number;
  };
  isEligible: boolean;
  reasons: string[];
}

// Category synonyms for fuzzy matching
const CATEGORY_SYNONYMS: Record<string, string[]> = {
  'Agriculture': ['farming', 'agricultural', 'crop', 'livestock', 'rural'],
  'Arts & Culture': ['arts', 'culture', 'humanities', 'creative', 'museum'],
  'Construction': ['building', 'infrastructure', 'development'],
  'Education': ['school', 'training', 'learning', 'academic', 'research'],
  'Energy & Environment': ['energy', 'environment', 'sustainability', 'green', 'climate', 'natural resources'],
  'Healthcare': ['health', 'medical', 'pharmaceutical', 'biotech', 'wellness'],
  'Housing': ['housing', 'shelter', 'residential', 'community development'],
  'Manufacturing': ['manufacturing', 'industrial', 'production', 'factory'],
  'Research & Development': ['research', 'r&d', 'science', 'innovation', 'technology'],
  'Retail & Services': ['retail', 'commercial', 'business', 'services', 'trade'],
  'Social Services': ['social', 'community', 'nonprofit', 'charity', 'welfare'],
  'Technology': ['technology', 'tech', 'software', 'it', 'digital', 'cyber'],
  'Transportation': ['transportation', 'transit', 'logistics', 'shipping'],
  'Other': [],
};

/**
 * Check if two categories are similar (fuzzy match)
 */
function categoriesMatch(userCategory: string, grantCategory: string): boolean {
  const userLower = userCategory.toLowerCase();
  const grantLower = grantCategory.toLowerCase();

  // Direct match
  if (userLower === grantLower || userLower.includes(grantLower) || grantLower.includes(userLower)) {
    return true;
  }

  // Check synonyms
  const userSynonyms = CATEGORY_SYNONYMS[userCategory] || [];
  const grantSynonyms = CATEGORY_SYNONYMS[grantCategory] || [];

  // Check if grant category matches any user synonyms
  for (const synonym of userSynonyms) {
    if (grantLower.includes(synonym) || synonym.includes(grantLower)) {
      return true;
    }
  }

  // Check if user category matches any grant synonyms
  for (const synonym of grantSynonyms) {
    if (userLower.includes(synonym) || synonym.includes(userLower)) {
      return true;
    }
  }

  return false;
}

/**
 * Score a grant for a specific user based on their criteria
 */
export function scoreGrantForUser(
  grant: Grant,
  userCriteria: UserCriteria,
  preferences: NotificationPreferences | null,
  userOrgType: string
): MatchScore {
  const matches = {
    orgType: 0,
    location: 0,
    industry: 0,
    amount: 0,
    special: 0,
  };
  const reasons: string[] = [];

  // 1. Organization type matching (hard requirement)
  if (grant.eligible_organization_types.length === 0) {
    // Grant doesn't specify org types, assume all eligible
    matches.orgType = 80;
    reasons.push('Open to all organization types');
  } else if (grant.eligible_organization_types.includes(userOrgType)) {
    matches.orgType = 100;
    reasons.push(`Eligible for ${userOrgType.replace('_', ' ')}s`);
  } else {
    // Not eligible based on org type
    return {
      totalScore: 0,
      matches,
      isEligible: false,
      reasons: [`Not eligible for ${userOrgType.replace('_', ' ')}s`],
    };
  }

  // 2. Location matching
  if (grant.eligible_states.length === 0) {
    // Grant is available nationwide
    matches.location = 100;
    reasons.push('Available nationwide');
  } else if (!userCriteria.location_state) {
    // User hasn't specified location, partial match
    matches.location = 70;
    reasons.push('State-specific grant (user location not specified)');
  } else if (grant.eligible_states.includes(userCriteria.location_state)) {
    matches.location = 100;
    reasons.push(`Available in ${userCriteria.location_state}`);
  } else {
    // Not available in user's state
    return {
      totalScore: 0,
      matches,
      isEligible: false,
      reasons: [`Not available in ${userCriteria.location_state}`],
    };
  }

  // 3. Industry matching (fuzzy)
  if (grant.industry_categories.length === 0) {
    // Grant doesn't specify industries
    matches.industry = 70;
    reasons.push('Open to all industries');
  } else if (userCriteria.industry_categories.length === 0) {
    // User hasn't specified industries
    matches.industry = 60;
    reasons.push('Industry-specific grant');
  } else {
    // Check for overlapping industries
    let industryMatchCount = 0;
    const matchedIndustries: string[] = [];

    for (const userIndustry of userCriteria.industry_categories) {
      for (const grantIndustry of grant.industry_categories) {
        if (categoriesMatch(userIndustry, grantIndustry)) {
          industryMatchCount++;
          matchedIndustries.push(grantIndustry);
          break;
        }
      }
    }

    if (industryMatchCount > 0) {
      matches.industry = Math.min(100, 60 + (industryMatchCount * 20));
      reasons.push(`Matches ${matchedIndustries.join(', ')}`);
    } else {
      matches.industry = 30; // Low score but not disqualifying
      reasons.push('Industry mismatch');
    }
  }

  // 4. Grant amount filtering
  const minGrantAmount = preferences?.min_grant_amount || 0;
  if (grant.amount_min && grant.amount_min >= minGrantAmount) {
    matches.amount = 100;
    if (grant.amount_min >= 100000) {
      reasons.push('Significant funding available');
    }
  } else if (!grant.amount_min && !grant.amount_max) {
    matches.amount = 60;
    reasons.push('Funding amount not specified');
  } else {
    matches.amount = 50;
    reasons.push('Below minimum amount preference');
  }

  // 5. Special status bonuses
  let specialBonus = 0;
  const specialMatches: string[] = [];

  if (userCriteria.veteran_status) {
    specialBonus += 10;
    specialMatches.push('veteran preference available');
  }
  if (userCriteria.women_owned) {
    specialBonus += 10;
    specialMatches.push('women-owned preference available');
  }
  if (userCriteria.minority_owned) {
    specialBonus += 10;
    specialMatches.push('minority-owned preference available');
  }
  if (userCriteria.disability_status) {
    specialBonus += 5;
    specialMatches.push('disability preference available');
  }

  matches.special = Math.min(100, specialBonus * 2);
  if (specialMatches.length > 0) {
    reasons.push(`Special status: ${specialMatches.join(', ')}`);
  }

  // Calculate weighted total score
  const totalScore =
    (matches.orgType * 0.30) +
    (matches.location * 0.25) +
    (matches.industry * 0.20) +
    (matches.amount * 0.15) +
    (matches.special * 0.10);

  return {
    totalScore,
    matches,
    isEligible: totalScore >= 50, // Threshold for notification
    reasons,
  };
}

/**
 * Find all users who match a specific grant
 */
export interface UserMatchResult {
  userId: string;
  score: MatchScore;
}

/**
 * Filter grants for a specific user based on their criteria
 */
export function filterGrantsForUser(
  grants: Grant[],
  userCriteria: UserCriteria,
  preferences: NotificationPreferences | null,
  userOrgType: string
): Array<{ grant: Grant; score: MatchScore }> {
  const results: Array<{ grant: Grant; score: MatchScore }> = [];

  for (const grant of grants) {
    const score = scoreGrantForUser(grant, userCriteria, preferences, userOrgType);
    if (score.isEligible) {
      results.push({ grant, score });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score.totalScore - a.score.totalScore);

  return results;
}
