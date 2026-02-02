'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Search,
  Filter,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Clock,
  DollarSign,
  Building2,
  MapPin,
  X,
  Loader2,
  Users,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import type { Grant, UserCriteria } from '@/lib/supabase/types';

const ORGANIZATION_TYPES = [
  { value: 'individual', label: 'Individuals' },
  { value: 'small_business', label: 'Small Businesses' },
  { value: 'nonprofit', label: 'Nonprofits' },
];

const AUSTRALIAN_STATES = [
  { value: '', label: 'All states' },
  { value: 'NSW', label: 'New South Wales' },
  { value: 'VIC', label: 'Victoria' },
  { value: 'QLD', label: 'Queensland' },
  { value: 'WA', label: 'Western Australia' },
  { value: 'SA', label: 'South Australia' },
  { value: 'TAS', label: 'Tasmania' },
  { value: 'ACT', label: 'Australian Capital Territory' },
  { value: 'NT', label: 'Northern Territory' },
];

export default function GrantsPage() {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [savedGrantIds, setSavedGrantIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    orgType: '',
    minAmount: '',
    maxAmount: '',
    state: '',
    industries: [] as string[],
    status: 'open' as 'all' | 'open' | 'closed',
    excludeIndigenous: false,
  });
  const [expandedGrants, setExpandedGrants] = useState<Set<string>>(new Set());
  const [userCriteria, setUserCriteria] = useState<UserCriteria | null>(null);
  const [useMyPreferences, setUseMyPreferences] = useState(true);
  const [criteriaLoaded, setCriteriaLoaded] = useState(false);

  const supabase = createClient();

  const fetchGrants = useCallback(async () => {
    setIsLoading(true);

    let query = supabase
      .from('grants')
      .select('*')
      .order('posted_date', { ascending: false });

    // Filter by status (open/closed based on deadline)
    const now = new Date().toISOString();
    if (filters.status === 'open') {
      query = query.gte('deadline', now);
    } else if (filters.status === 'closed') {
      query = query.lt('deadline', now);
    }
    // 'all' shows everything

    // Apply search
    if (searchQuery) {
      query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,agency_name.ilike.%${searchQuery}%`);
    }

    // Apply filters
    if (filters.orgType) {
      query = query.contains('eligible_organization_types', [filters.orgType]);
    }
    if (filters.minAmount) {
      query = query.gte('amount_min', parseInt(filters.minAmount));
    }
    if (filters.maxAmount) {
      query = query.lte('amount_max', parseInt(filters.maxAmount));
    }
    if (filters.state && useMyPreferences) {
      // Filter by state - include grants for this state OR grants available to all states
      query = query.or(`eligible_states.cs.{${filters.state}},eligible_states.eq.{}`);
    }

    const { data, error } = await query.limit(200);

    if (error) {
      console.error('Error fetching grants:', error);
      setGrants([]);
    } else {
      let filteredGrants = data || [];

      // Filter out Indigenous-specific grants if enabled
      if (filters.excludeIndigenous) {
        const indigenousKeywords = [
          'aboriginal', 'torres strait islander', 'indigenous', 'first nations',
          'atsi', 'first peoples', 'native title', 'closing the gap'
        ];
        filteredGrants = filteredGrants.filter(grant => {
          const searchText = `${grant.title} ${grant.description}`.toLowerCase();
          return !indigenousKeywords.some(keyword => searchText.includes(keyword));
        });
      }

      // Client-side filtering by industry categories if preferences are enabled
      if (useMyPreferences && filters.industries && filters.industries.length > 0) {
        const industryKeywords: Record<string, string[]> = {
          'Agriculture': ['agriculture', 'farming', 'rural', 'livestock', 'crop', 'agri'],
          'Arts & Culture': ['arts', 'culture', 'creative', 'heritage', 'museum', 'gallery', 'music', 'theatre'],
          'Construction': ['construction', 'building', 'infrastructure', 'housing'],
          'Education': ['education', 'training', 'school', 'university', 'learning', 'skills'],
          'Energy & Environment': ['energy', 'environment', 'sustainability', 'renewable', 'climate', 'green', 'carbon'],
          'Healthcare': ['health', 'medical', 'healthcare', 'hospital', 'wellbeing', 'mental health'],
          'Housing': ['housing', 'accommodation', 'homelessness', 'shelter'],
          'Manufacturing': ['manufacturing', 'industrial', 'production', 'factory'],
          'Research & Development': ['research', 'development', 'innovation', 'R&D', 'science', 'technology'],
          'Retail & Services': ['retail', 'services', 'business', 'commerce', 'trade'],
          'Social Services': ['social', 'community', 'welfare', 'support', 'disability', 'aged care', 'youth'],
          'Technology': ['technology', 'tech', 'digital', 'IT', 'software', 'cyber', 'data'],
          'Transportation': ['transport', 'transportation', 'logistics', 'freight', 'road', 'rail'],
          'Other': [],
        };

        filteredGrants = filteredGrants.filter(grant => {
          const searchText = `${grant.title} ${grant.description} ${grant.agency_name}`.toLowerCase();

          // Check if grant matches any of the selected industries
          return filters.industries.some(industry => {
            const keywords = industryKeywords[industry] || [];
            if (keywords.length === 0) return true; // "Other" matches everything
            return keywords.some(keyword => searchText.includes(keyword.toLowerCase()));
          });
        });
      }

      setGrants(filteredGrants);
    }

    setIsLoading(false);
  }, [supabase, searchQuery, filters, useMyPreferences]);

  const fetchSavedGrants = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('saved_grants')
      .select('grant_id')
      .eq('user_id', user.id);

    if (data) {
      setSavedGrantIds(new Set(data.map((sg) => sg.grant_id)));
    }
  }, [supabase]);

  // Fetch user criteria on mount
  useEffect(() => {
    const fetchUserCriteria = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCriteriaLoaded(true);
        return;
      }

      const { data: criteria } = await supabase
        .from('user_criteria')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (criteria) {
        setUserCriteria(criteria);
        // Apply user's criteria as default filters
        setFilters(prev => ({
          ...prev,
          state: criteria.location_state || '',
          industries: criteria.industry_categories || [],
        }));
      }
      setCriteriaLoaded(true);
    };

    fetchUserCriteria();
    fetchSavedGrants();
  }, [supabase, fetchSavedGrants]);

  // Fetch grants when criteria is loaded and filters change
  useEffect(() => {
    if (criteriaLoaded) {
      fetchGrants();
    }
  }, [criteriaLoaded, fetchGrants]);

  const toggleSaveGrant = async (grantId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (savedGrantIds.has(grantId)) {
      // Unsave
      await supabase
        .from('saved_grants')
        .delete()
        .eq('user_id', user.id)
        .eq('grant_id', grantId);

      setSavedGrantIds((prev) => {
        const next = new Set(prev);
        next.delete(grantId);
        return next;
      });
    } else {
      // Save
      await supabase.from('saved_grants').insert({
        user_id: user.id,
        grant_id: grantId,
      });

      setSavedGrantIds((prev) => new Set(prev).add(grantId));
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getDaysUntilDeadline = (deadline: string) => {
    const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return { text: 'Expired', urgent: true };
    if (days === 0) return { text: 'Due today', urgent: true };
    if (days <= 7) return { text: `${days} days left`, urgent: true };
    if (days <= 30) return { text: `${days} days left`, urgent: false };
    return { text: `${days} days left`, urgent: false };
  };

  const clearFilters = () => {
    setFilters({ orgType: '', minAmount: '', maxAmount: '', state: '', industries: [], status: 'open', excludeIndigenous: false });
    setSearchQuery('');
    setUseMyPreferences(false);
  };

  const applyMyPreferences = () => {
    if (userCriteria) {
      setFilters(prev => ({
        ...prev,
        state: userCriteria.location_state || '',
        industries: userCriteria.industry_categories || [],
      }));
      setUseMyPreferences(true);
    }
  };

  const hasActiveFilters = searchQuery || filters.orgType || filters.minAmount || filters.maxAmount || filters.state || filters.industries.length > 0 || filters.status !== 'open' || filters.excludeIndigenous;

  const toggleExpandGrant = (grantId: string) => {
    setExpandedGrants(prev => {
      const next = new Set(prev);
      if (next.has(grantId)) {
        next.delete(grantId);
      } else {
        next.add(grantId);
      }
      return next;
    });
  };

  // Extract eligibility section from description if present
  const parseDescription = (description: string) => {
    const eligibilityMatch = description.match(/Eligibility:\s*([\s\S]*)/i);
    if (eligibilityMatch) {
      const mainDesc = description.replace(/\n\nEligibility:[\s\S]*/, '').trim();
      const eligibility = eligibilityMatch[1].trim();
      return { mainDesc, eligibility };
    }
    return { mainDesc: description, eligibility: null };
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Browse Grants</h1>
        <p className="text-gray-600 mt-1">Search and filter grants that match your needs.</p>
      </div>

      {/* My Preferences Toggle */}
      {userCriteria && (userCriteria.location_state || (userCriteria.industry_categories && userCriteria.industry_categories.length > 0)) && (
        <div className="bg-gradient-to-r from-primary-50 to-blue-50 rounded-xl p-4 mb-6 border border-primary-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">
                  {useMyPreferences ? 'Showing grants matching your preferences' : 'Show grants for your preferences?'}
                </h3>
                <p className="text-sm text-gray-600">
                  {userCriteria.location_state && `State: ${userCriteria.location_state}`}
                  {userCriteria.location_state && userCriteria.industry_categories?.length ? ' • ' : ''}
                  {userCriteria.industry_categories?.length ? `Industries: ${userCriteria.industry_categories.slice(0, 3).join(', ')}${userCriteria.industry_categories.length > 3 ? ` +${userCriteria.industry_categories.length - 3} more` : ''}` : ''}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                if (useMyPreferences) {
                  clearFilters();
                } else {
                  applyMyPreferences();
                }
              }}
              className={`btn ${useMyPreferences ? 'btn-secondary' : 'btn-primary'}`}
            >
              {useMyPreferences ? 'Show All Grants' : 'Apply My Preferences'}
            </button>
          </div>
        </div>
      )}

      {/* Search and filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search grants by title, description, or agency..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchGrants()}
              className="pl-10 w-full"
            />
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn flex items-center gap-2 ${showFilters ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>

          {/* Search button */}
          <button onClick={fetchGrants} className="btn btn-primary">
            Search
          </button>
        </div>

        {/* Quick filter - Indigenous grants */}
        <div className="mt-4 pt-4 border-t flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.excludeIndigenous}
              onChange={(e) => setFilters((prev) => ({ ...prev, excludeIndigenous: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">
              Exclude Indigenous-specific grants
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.status === 'open'}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.checked ? 'open' : 'all' }))}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">
              Open grants only
            </span>
          </label>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Organization Type
              </label>
              <select
                value={filters.orgType}
                onChange={(e) => setFilters((prev) => ({ ...prev, orgType: e.target.value }))}
              >
                <option value="">All types</option>
                {ORGANIZATION_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Amount
              </label>
              <select
                value={filters.minAmount}
                onChange={(e) => setFilters((prev) => ({ ...prev, minAmount: e.target.value }))}
              >
                <option value="">No minimum</option>
                <option value="1000">$1,000</option>
                <option value="10000">$10,000</option>
                <option value="50000">$50,000</option>
                <option value="100000">$100,000</option>
                <option value="500000">$500,000</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Amount
              </label>
              <select
                value={filters.maxAmount}
                onChange={(e) => setFilters((prev) => ({ ...prev, maxAmount: e.target.value }))}
              >
                <option value="">No maximum</option>
                <option value="10000">$10,000</option>
                <option value="50000">$50,000</option>
                <option value="100000">$100,000</option>
                <option value="500000">$500,000</option>
                <option value="1000000">$1,000,000</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State/Territory
              </label>
              <select
                value={filters.state}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, state: e.target.value }));
                  setUseMyPreferences(false);
                }}
              >
                {AUSTRALIAN_STATES.map((state) => (
                  <option key={state.value} value={state.value}>
                    {state.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Grant Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value as 'all' | 'open' | 'closed' }))}
              >
                <option value="open">Open grants only</option>
                <option value="closed">Closed grants only</option>
                <option value="all">All grants</option>
              </select>
            </div>

          </div>
        )}

        {/* Active filters indicator */}
        {hasActiveFilters && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600">Active filters:</span>
            {filters.state && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                {AUSTRALIAN_STATES.find(s => s.value === filters.state)?.label || filters.state}
              </span>
            )}
            {filters.industries.length > 0 && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                {filters.industries.length} {filters.industries.length === 1 ? 'industry' : 'industries'}
              </span>
            )}
            {filters.orgType && (
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                {ORGANIZATION_TYPES.find(t => t.value === filters.orgType)?.label || filters.orgType}
              </span>
            )}
            {searchQuery && (
              <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                Search: {searchQuery}
              </span>
            )}
            {filters.status !== 'open' && (
              <span className={`text-xs px-2 py-1 rounded-full ${filters.status === 'closed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                {filters.status === 'closed' ? 'Closed grants' : 'All grants'}
              </span>
            )}
            {filters.excludeIndigenous && (
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                Excluding Indigenous-specific
              </span>
            )}
            <button
              onClick={clearFilters}
              className="text-sm text-primary-600 hover:underline flex items-center gap-1 ml-2"
            >
              <X className="w-3 h-3" />
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : grants.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No grants found</h3>
          <p className="text-gray-600">
            Try adjusting your search or filters to find more grants.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{grants.length} grants found</p>

          {grants.map((grant) => {
            const deadlineInfo = getDaysUntilDeadline(grant.deadline);
            const isSaved = savedGrantIds.has(grant.id);
            const isExpanded = expandedGrants.has(grant.id);
            const { mainDesc, eligibility } = parseDescription(grant.description || '');
            const isOpen = new Date(grant.deadline) >= new Date();

            return (
              <div
                key={grant.id}
                className={`bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow ${!isOpen ? 'opacity-75' : ''}`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 text-lg">{grant.title}</h3>
                          {!isOpen && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                              Closed
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 mt-1 flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          {grant.agency_name || 'Unknown Agency'}
                        </p>
                      </div>
                      <button
                        onClick={() => toggleSaveGrant(grant.id)}
                        className={`p-2 rounded-lg transition-colors ${
                          isSaved
                            ? 'bg-primary-100 text-primary-600'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        title={isSaved ? 'Remove from saved' : 'Save grant'}
                      >
                        {isSaved ? (
                          <BookmarkCheck className="w-5 h-5" />
                        ) : (
                          <Bookmark className="w-5 h-5" />
                        )}
                      </button>
                    </div>

                    {mainDesc && (
                      <p className={`text-gray-600 mt-3 ${isExpanded ? '' : 'line-clamp-2'}`}>
                        {mainDesc}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 mt-4">
                      <span className="flex items-center gap-1 text-sm bg-green-50 text-green-700 px-3 py-1 rounded-full">
                        <DollarSign className="w-4 h-4" />
                        {formatCurrency(grant.amount_min)}
                        {grant.amount_max && grant.amount_max !== grant.amount_min && (
                          <> - {formatCurrency(grant.amount_max)}</>
                        )}
                      </span>

                      <span
                        className={`flex items-center gap-1 text-sm px-3 py-1 rounded-full ${
                          deadlineInfo.urgent
                            ? 'bg-red-50 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        <Clock className="w-4 h-4" />
                        {deadlineInfo.text}
                      </span>

                      {grant.eligible_states.length > 0 && (
                        <span className="flex items-center gap-1 text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
                          <MapPin className="w-4 h-4" />
                          {grant.eligible_states.length === 1
                            ? grant.eligible_states[0]
                            : `${grant.eligible_states.length} states`}
                        </span>
                      )}
                    </div>

                    {grant.eligible_organization_types.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {grant.eligible_organization_types.map((type) => (
                          <span
                            key={type}
                            className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                          >
                            {type.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Eligibility Section */}
                    {eligibility && (
                      <div className="mt-4 border-t pt-4">
                        <button
                          onClick={() => toggleExpandGrant(grant.id)}
                          className="flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700"
                        >
                          <Users className="w-4 h-4" />
                          {isExpanded ? 'Hide' : 'Show'} Eligibility Details
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                        {isExpanded && (
                          <div className="mt-3 p-4 bg-blue-50 rounded-lg">
                            <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                              <Users className="w-4 h-4" />
                              Who Can Apply
                            </h4>
                            <p className="text-sm text-blue-800 whitespace-pre-line">
                              {eligibility}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-4 mt-4">
                      {grant.url && (
                        <a
                          href={grant.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-primary text-sm flex items-center gap-2"
                        >
                          View Grant
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      {(eligibility || mainDesc.length > 200) && !isExpanded && (
                        <button
                          onClick={() => toggleExpandGrant(grant.id)}
                          className="btn btn-secondary text-sm flex items-center gap-2"
                        >
                          More Details
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
