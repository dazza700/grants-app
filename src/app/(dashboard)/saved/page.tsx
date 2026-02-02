'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Bookmark,
  Trash2,
  ExternalLink,
  Clock,
  DollarSign,
  Building2,
  Loader2,
} from 'lucide-react';
import type { SavedGrantWithDetails } from '@/lib/supabase/types';

export default function SavedGrantsPage() {
  const [savedGrants, setSavedGrants] = useState<SavedGrantWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  const fetchSavedGrants = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('saved_grants')
      .select(`
        *,
        grant:grants(*)
      `)
      .eq('user_id', user.id)
      .order('saved_at', { ascending: false });

    if (error) {
      console.error('Error fetching saved grants:', error);
    } else {
      setSavedGrants(data || []);
    }

    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchSavedGrants();
  }, [fetchSavedGrants]);

  const removeSavedGrant = async (grantId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('saved_grants')
      .delete()
      .eq('user_id', user.id)
      .eq('grant_id', grantId);

    setSavedGrants((prev) => prev.filter((sg) => sg.grant_id !== grantId));
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getDaysUntilDeadline = (deadline: string) => {
    const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return { text: 'Expired', urgent: true, expired: true };
    if (days === 0) return { text: 'Due today', urgent: true, expired: false };
    if (days <= 7) return { text: `${days} days left`, urgent: true, expired: false };
    return { text: `${days} days left`, urgent: false, expired: false };
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Saved Grants</h1>
        <p className="text-gray-600 mt-1">Grants you've saved for later review.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : savedGrants.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Bookmark className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No saved grants yet</h3>
          <p className="text-gray-600">
            Browse grants and click the bookmark icon to save them for later.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{savedGrants.length} saved grants</p>

          {savedGrants.map((savedGrant) => {
            const grant = savedGrant.grant;
            const deadlineInfo = getDaysUntilDeadline(grant.deadline);

            return (
              <div
                key={savedGrant.id}
                className={`bg-white rounded-xl shadow-sm p-6 ${
                  deadlineInfo.expired ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-gray-900 text-lg">{grant.title}</h3>
                        <p className="text-gray-600 mt-1 flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          {grant.agency_name || 'Unknown Agency'}
                        </p>
                      </div>
                      <button
                        onClick={() => removeSavedGrant(grant.id)}
                        className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                        title="Remove from saved"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    {grant.description && (
                      <p className="text-gray-600 mt-3 line-clamp-2">{grant.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 mt-4">
                      <span className="flex items-center gap-1 text-sm bg-green-50 text-green-700 px-3 py-1 rounded-full">
                        <DollarSign className="w-4 h-4" />
                        {formatCurrency(grant.amount_min)}
                        {grant.amount_max && grant.amount_max !== grant.amount_min && (
                          <> - {formatCurrency(grant.amount_max)}</>
                        )}
                      </span>

                      <span
                        className={`flex items-center gap-1 text-sm px-3 py-1 rounded-full ${
                          deadlineInfo.expired
                            ? 'bg-gray-100 text-gray-500'
                            : deadlineInfo.urgent
                            ? 'bg-red-50 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        <Clock className="w-4 h-4" />
                        {deadlineInfo.text}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 mt-4">
                      {grant.url && !deadlineInfo.expired && (
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
                      <span className="text-sm text-gray-500">
                        Saved on {new Date(savedGrant.saved_at).toLocaleDateString()}
                      </span>
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
