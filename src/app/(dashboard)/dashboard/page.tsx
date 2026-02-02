'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Search, Bookmark, Bell, TrendingUp, Clock, DollarSign, ArrowRight, Sparkles } from 'lucide-react';
import type { Grant, UserProfile, NotificationHistory, UserCriteria } from '@/lib/supabase/types';

interface DashboardStats {
  totalGrants: number;
  savedGrants: number;
  recentMatches: number;
  matchingGrants: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({ totalGrants: 0, savedGrants: 0, recentMatches: 0, matchingGrants: 0 });
  const [recentGrants, setRecentGrants] = useState<Grant[]>([]);
  const [matchingGrants, setMatchingGrants] = useState<Grant[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userCriteria, setUserCriteria] = useState<UserCriteria | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  // Industry keyword mapping for filtering
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

  useEffect(() => {
    const fetchDashboardData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch user profile and criteria in parallel
      const [profileResult, criteriaResult] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('id', user.id).single(),
        supabase.from('user_criteria').select('*').eq('user_id', user.id).single(),
      ]);

      setUserProfile(profileResult.data);
      setUserCriteria(criteriaResult.data);

      // Fetch stats
      const [grantsCount, savedCount, matchesCount] = await Promise.all([
        supabase.from('grants').select('id', { count: 'exact', head: true }).gte('deadline', new Date().toISOString()),
        supabase.from('saved_grants').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('notification_history').select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('notified_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      // Fetch all active grants for filtering
      const { data: allGrants } = await supabase
        .from('grants')
        .select('*')
        .gte('deadline', new Date().toISOString())
        .order('posted_date', { ascending: false });

      const grants = allGrants || [];

      // Filter grants based on user criteria
      let filtered = grants;
      if (criteriaResult.data) {
        const criteria = criteriaResult.data;

        // Filter by state
        if (criteria.location_state) {
          filtered = filtered.filter(grant =>
            grant.eligible_states.length === 0 || // Available to all states
            grant.eligible_states.includes(criteria.location_state)
          );
        }

        // Filter by industries
        if (criteria.industry_categories && criteria.industry_categories.length > 0) {
          filtered = filtered.filter(grant => {
            const searchText = `${grant.title} ${grant.description} ${grant.agency_name}`.toLowerCase();
            return criteria.industry_categories!.some((industry: string) => {
              const keywords = industryKeywords[industry] || [];
              if (keywords.length === 0) return true; // "Other" matches everything
              return keywords.some(keyword => searchText.includes(keyword.toLowerCase()));
            });
          });
        }
      }

      setStats({
        totalGrants: grantsCount.count || 0,
        savedGrants: savedCount.count || 0,
        recentMatches: matchesCount.count || 0,
        matchingGrants: filtered.length,
      });

      // Set matching grants (top 5)
      setMatchingGrants(filtered.slice(0, 5));

      // Set recent grants (top 5 of all grants)
      setRecentGrants(grants.slice(0, 5));
      setIsLoading(false);
    };

    fetchDashboardData();
  }, [supabase]);

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getDaysUntilDeadline = (deadline: string) => {
    const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return 'Expired';
    if (days === 0) return 'Today';
    if (days === 1) return '1 day';
    return `${days} days`;
  };

  return (
    <div>
      {/* Welcome header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back{userProfile?.full_name ? `, ${userProfile.full_name.split(' ')[0]}` : ''}!
        </h1>
        <p className="text-gray-600 mt-1">Here's what's happening with your grant matches.</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Search className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Available Grants</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalGrants.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl p-6 shadow-sm text-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-primary-100">Matching Your Criteria</p>
              <p className="text-2xl font-bold">{stats.matchingGrants.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Bell className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Notified This Week</p>
              <p className="text-2xl font-bold text-gray-900">{stats.recentMatches}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Bookmark className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Saved Grants</p>
              <p className="text-2xl font-bold text-gray-900">{stats.savedGrants}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Link
          href="/grants"
          className="bg-primary-600 text-white rounded-xl p-6 hover:bg-primary-700 transition-colors group"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Browse All Grants</h3>
              <p className="text-primary-100 mt-1">Search and filter grants that match your criteria</p>
            </div>
            <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link
          href="/settings"
          className="bg-white rounded-xl p-6 hover:shadow-md transition-shadow group border"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Update Profile</h3>
              <p className="text-gray-600 mt-1">Refine your criteria for better matches</p>
            </div>
            <ArrowRight className="w-6 h-6 text-gray-400 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>

      {/* Matching grants - show when user has criteria */}
      {userCriteria && (userCriteria.location_state || (userCriteria.industry_categories && userCriteria.industry_categories.length > 0)) && (
        <div className="bg-white rounded-xl shadow-sm mb-8">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900">Grants Matching Your Criteria</h2>
            </div>
            <Link href="/grants" className="text-primary-600 hover:underline text-sm font-medium">
              View all matches
            </Link>
          </div>

          {isLoading ? (
            <div className="p-6 text-center text-gray-500">Loading...</div>
          ) : matchingGrants.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <p>No grants match your current criteria.</p>
              <Link href="/settings" className="text-primary-600 hover:underline mt-2 inline-block">
                Update your preferences
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {matchingGrants.map((grant) => (
                <div key={grant.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{grant.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">{grant.agency_name || 'Unknown Agency'}</p>
                      <div className="flex items-center gap-4 mt-3 text-sm">
                        <span className="flex items-center gap-1 text-gray-600">
                          <DollarSign className="w-4 h-4" />
                          {formatCurrency(grant.amount_min)}
                          {grant.amount_max && grant.amount_max !== grant.amount_min && (
                            <> - {formatCurrency(grant.amount_max)}</>
                          )}
                        </span>
                        <span className="flex items-center gap-1 text-gray-600">
                          <Clock className="w-4 h-4" />
                          {getDaysUntilDeadline(grant.deadline)} left
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/grants/${grant.id}`}
                      className="btn btn-outline text-sm px-4 py-2"
                    >
                      View
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent grants */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recently Posted Grants</h2>
          <Link href="/grants" className="text-primary-600 hover:underline text-sm font-medium">
            View all
          </Link>
        </div>

        {isLoading ? (
          <div className="p-6 text-center text-gray-500">Loading...</div>
        ) : recentGrants.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No grants available yet. Check back soon!
          </div>
        ) : (
          <div className="divide-y">
            {recentGrants.map((grant) => (
              <div key={grant.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{grant.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">{grant.agency_name || 'Unknown Agency'}</p>
                    <div className="flex items-center gap-4 mt-3 text-sm">
                      <span className="flex items-center gap-1 text-gray-600">
                        <DollarSign className="w-4 h-4" />
                        {formatCurrency(grant.amount_min)}
                        {grant.amount_max && grant.amount_max !== grant.amount_min && (
                          <> - {formatCurrency(grant.amount_max)}</>
                        )}
                      </span>
                      <span className="flex items-center gap-1 text-gray-600">
                        <Clock className="w-4 h-4" />
                        {getDaysUntilDeadline(grant.deadline)} left
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/grants/${grant.id}`}
                    className="btn btn-outline text-sm px-4 py-2"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
