'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Save, CheckCircle } from 'lucide-react';
import type { UserProfile, UserCriteria, NotificationPreferences, OrganizationType, BusinessSize, EmailFrequency } from '@/lib/supabase/types';

const INDUSTRIES = [
  'Agriculture', 'Arts & Culture', 'Construction', 'Education', 'Energy & Environment',
  'Healthcare', 'Housing', 'Manufacturing', 'Research & Development', 'Retail & Services',
  'Social Services', 'Technology', 'Transportation', 'Other',
];

const AU_STATES = [
  'Australian Capital Territory',
  'New South Wales',
  'Northern Territory',
  'Queensland',
  'South Australia',
  'Tasmania',
  'Victoria',
  'Western Australia',
];

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [criteria, setCriteria] = useState<UserCriteria | null>(null);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences | null>(null);

  const supabase = createClient();

  useEffect(() => {
    const fetchSettings = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [profileRes, criteriaRes, notifRes] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('id', user.id).single(),
        supabase.from('user_criteria').select('*').eq('user_id', user.id).single(),
        supabase.from('notification_preferences').select('*').eq('user_id', user.id).single(),
      ]);

      setProfile(profileRes.data);
      // Initialize criteria with defaults if not found
      setCriteria(criteriaRes.data || {
        id: '',
        user_id: user.id,
        location_state: '',
        location_city: '',
        industry_categories: [],
        business_size: null,
        annual_revenue_min: null,
        annual_revenue_max: null,
        years_in_business: null,
        tax_exempt_status: false,
        nonprofit_category: null,
        veteran_status: false,
        disability_status: false,
        minority_owned: false,
        women_owned: false,
        created_at: '',
        updated_at: '',
      });
      setNotifPrefs(notifRes.data);
      setIsLoading(false);
    };

    fetchSettings();
  }, [supabase]);

  const handleSave = async () => {
    if (!profile) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      // Update profile
      const { error: profileError } = await (supabase
        .from('user_profiles') as any)
        .update({
          full_name: profile.full_name,
          organization_name: profile.organization_name,
          organization_type: profile.organization_type,
        })
        .eq('id', profile.id);

      if (profileError) {
        console.error('Error saving profile:', profileError);
        throw profileError;
      }

      // Update or insert criteria
      if (criteria) {
        const { error: criteriaError } = await (supabase
          .from('user_criteria') as any)
          .upsert({
            user_id: profile.id,
            location_state: criteria.location_state,
            location_city: criteria.location_city,
            industry_categories: criteria.industry_categories,
            business_size: criteria.business_size,
            years_in_business: criteria.years_in_business,
            tax_exempt_status: criteria.tax_exempt_status,
            veteran_status: criteria.veteran_status,
            disability_status: criteria.disability_status,
            minority_owned: criteria.minority_owned,
            women_owned: criteria.women_owned,
          }, { onConflict: 'user_id' });

        if (criteriaError) {
          console.error('Error saving criteria:', criteriaError);
          throw criteriaError;
        }
      }

      // Update or insert notification preferences
      if (notifPrefs) {
        const { error: notifError } = await (supabase
          .from('notification_preferences') as any)
          .upsert({
            user_id: profile.id,
            email_frequency: notifPrefs.email_frequency,
            min_grant_amount: notifPrefs.min_grant_amount,
          }, { onConflict: 'user_id' });

        if (notifError) {
          console.error('Error saving notification preferences:', notifError);
          throw notifError;
        }
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleIndustry = (industry: string) => {
    if (!criteria) return;
    setCriteria((prev) =>
      prev
        ? {
            ...prev,
            industry_categories: prev.industry_categories.includes(industry)
              ? prev.industry_categories.filter((i) => i !== industry)
              : [...prev.industry_categories, industry],
          }
        : null
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">Manage your profile and notification preferences.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="btn btn-primary flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : saveSuccess ? (
            <>
              <CheckCircle className="w-4 h-4" />
              Saved!
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Changes
            </>
          )}
        </button>
      </div>

      {/* Profile Section */}
      <section className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile Information</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              value={profile?.full_name || ''}
              onChange={(e) => setProfile((prev) => prev ? { ...prev, full_name: e.target.value } : null)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={profile?.email || ''} disabled className="bg-gray-50" />
            <p className="text-sm text-gray-500 mt-1">Email cannot be changed.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organization Type</label>
            <select
              value={profile?.organization_type || 'individual'}
              onChange={(e) =>
                setProfile((prev) =>
                  prev ? { ...prev, organization_type: e.target.value as OrganizationType } : null
                )
              }
            >
              <option value="individual">Individual</option>
              <option value="small_business">Small Business</option>
              <option value="nonprofit">Nonprofit</option>
            </select>
          </div>

          {profile?.organization_type !== 'individual' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
              <input
                type="text"
                value={profile?.organization_name || ''}
                onChange={(e) =>
                  setProfile((prev) => prev ? { ...prev, organization_name: e.target.value } : null)
                }
              />
            </div>
          )}
        </div>
      </section>

      {/* Criteria Section */}
      <section className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Eligibility Criteria</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State/Territory</label>
              <select
                value={criteria?.location_state || ''}
                onChange={(e) =>
                  setCriteria((prev) => prev ? { ...prev, location_state: e.target.value } : null)
                }
              >
                <option value="">All states/territories</option>
                {AU_STATES.map((state) => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                value={criteria?.location_city || ''}
                onChange={(e) =>
                  setCriteria((prev) => prev ? { ...prev, location_city: e.target.value } : null)
                }
                placeholder="Optional"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Industries / Areas of Interest</label>
            <div className="flex flex-wrap gap-2">
              {INDUSTRIES.map((industry) => (
                <button
                  key={industry}
                  type="button"
                  onClick={() => toggleIndustry(industry)}
                  className={`px-3 py-1 rounded-lg text-sm border transition-all ${
                    criteria?.industry_categories.includes(industry)
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {industry}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Special Designations</label>
            <div className="space-y-2">
              {[
                { field: 'veteran_status', label: 'Veteran-owned' },
                { field: 'women_owned', label: 'Women-owned' },
                { field: 'minority_owned', label: 'Minority-owned' },
                { field: 'disability_status', label: 'Disability-owned' },
              ].map((option) => (
                <label key={option.field} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={(criteria?.[option.field as keyof UserCriteria] as boolean) || false}
                    onChange={(e) =>
                      setCriteria((prev) =>
                        prev ? { ...prev, [option.field]: e.target.checked } : null
                      )
                    }
                  />
                  <span className="text-sm text-gray-700">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Notification Section */}
      <section className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Notification Preferences</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email Frequency</label>
            <div className="grid grid-cols-3 gap-4">
              {[
                { value: 'immediate', label: 'Immediate' },
                { value: 'daily', label: 'Daily Digest' },
                { value: 'weekly', label: 'Weekly Digest' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setNotifPrefs((prev) =>
                      prev ? { ...prev, email_frequency: option.value as EmailFrequency } : null
                    )
                  }
                  className={`p-3 rounded-lg border-2 text-center transition-all ${
                    notifPrefs?.email_frequency === option.value
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Minimum Grant Amount
            </label>
            <select
              value={notifPrefs?.min_grant_amount || 0}
              onChange={(e) =>
                setNotifPrefs((prev) =>
                  prev ? { ...prev, min_grant_amount: parseInt(e.target.value) } : null
                )
              }
            >
              <option value="0">No minimum</option>
              <option value="1000">$1,000</option>
              <option value="5000">$5,000</option>
              <option value="10000">$10,000</option>
              <option value="25000">$25,000</option>
              <option value="50000">$50,000</option>
              <option value="100000">$100,000</option>
            </select>
          </div>
        </div>
      </section>
    </div>
  );
}
