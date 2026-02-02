'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, ArrowRight, Loader2, Building2, MapPin, Briefcase, User, Bell } from 'lucide-react';
import type { OrganizationType, BusinessSize, EmailFrequency } from '@/lib/supabase/types';

const STEPS = [
  { id: 'organization', title: 'Organization Type', icon: Building2 },
  { id: 'location', title: 'Location', icon: MapPin },
  { id: 'details', title: 'Details', icon: Briefcase },
  { id: 'special', title: 'Special Status', icon: User },
  { id: 'notifications', title: 'Notifications', icon: Bell },
];

const INDUSTRIES = [
  'Agriculture',
  'Arts & Culture',
  'Construction',
  'Education',
  'Energy & Environment',
  'Healthcare',
  'Housing',
  'Manufacturing',
  'Research & Development',
  'Retail & Services',
  'Social Services',
  'Technology',
  'Transportation',
  'Other',
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

interface FormData {
  organizationType: OrganizationType;
  organizationName: string;
  locationState: string;
  locationCity: string;
  industryCategories: string[];
  businessSize: BusinessSize | '';
  yearsInBusiness: number | null;
  taxExemptStatus: boolean;
  veteranStatus: boolean;
  disabilityStatus: boolean;
  minorityOwned: boolean;
  womenOwned: boolean;
  emailFrequency: EmailFrequency;
  minGrantAmount: number;
}

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    organizationType: 'individual',
    organizationName: '',
    locationState: '',
    locationCity: '',
    industryCategories: [],
    businessSize: '',
    yearsInBusiness: null,
    taxExemptStatus: false,
    veteranStatus: false,
    disabilityStatus: false,
    minorityOwned: false,
    womenOwned: false,
    emailFrequency: 'daily',
    minGrantAmount: 0,
  });

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUserId(user.id);

      // Check if user already has criteria set up
      const { data: criteria } = await supabase
        .from('user_criteria')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (criteria) {
        // User already has criteria, redirect to dashboard
        router.push('/dashboard');
        return;
      }

      setIsLoading(false);
    };

    checkUser();
  }, [router, supabase]);

  const updateFormData = (field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleIndustry = (industry: string) => {
    setFormData((prev) => ({
      ...prev,
      industryCategories: prev.industryCategories.includes(industry)
        ? prev.industryCategories.filter((i) => i !== industry)
        : [...prev.industryCategories, industry],
    }));
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!userId) return;

    setIsSaving(true);

    try {
      // Update user profile
      await supabase
        .from('user_profiles')
        .update({
          organization_name: formData.organizationName || null,
          organization_type: formData.organizationType,
        })
        .eq('id', userId);

      // Insert user criteria
      await supabase.from('user_criteria').insert({
        user_id: userId,
        location_state: formData.locationState || null,
        location_city: formData.locationCity || null,
        industry_categories: formData.industryCategories,
        business_size: formData.businessSize || null,
        years_in_business: formData.yearsInBusiness,
        tax_exempt_status: formData.taxExemptStatus,
        veteran_status: formData.veteranStatus,
        disability_status: formData.disabilityStatus,
        minority_owned: formData.minorityOwned,
        women_owned: formData.womenOwned,
      });

      // Update notification preferences
      await supabase
        .from('notification_preferences')
        .update({
          email_frequency: formData.emailFrequency,
          min_grant_amount: formData.minGrantAmount,
        })
        .eq('user_id', userId);

      router.push('/dashboard');
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  const CurrentStepIcon = STEPS[currentStep].icon;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.id}
                  className={`flex items-center ${index <= currentStep ? 'text-primary-600' : 'text-gray-400'}`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      index <= currentStep ? 'bg-primary-100' : 'bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="h-2 bg-gray-200 rounded-full">
            <div
              className="h-full bg-primary-600 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Step content */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <CurrentStepIcon className="w-7 h-7 text-primary-600" />
            {STEPS[currentStep].title}
          </h2>

          {/* Step 1: Organization Type */}
          {currentStep === 0 && (
            <div className="space-y-6 mt-6">
              <p className="text-gray-600">What type of organization are you?</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { value: 'individual', label: 'Individual', desc: 'Personal grants' },
                  { value: 'small_business', label: 'Small Business', desc: 'Business funding' },
                  { value: 'nonprofit', label: 'Nonprofit', desc: 'Charitable org' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateFormData('organizationType', option.value as OrganizationType)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      formData.organizationType === option.value
                        ? 'border-primary-600 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-semibold">{option.label}</div>
                    <div className="text-sm text-gray-500">{option.desc}</div>
                  </button>
                ))}
              </div>

              {formData.organizationType !== 'individual' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    value={formData.organizationName}
                    onChange={(e) => updateFormData('organizationName', e.target.value)}
                    placeholder="Your organization name"
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 2: Location */}
          {currentStep === 1 && (
            <div className="space-y-6 mt-6">
              <p className="text-gray-600">Where are you located? This helps us find state-specific grants.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State/Territory</label>
                <select
                  value={formData.locationState}
                  onChange={(e) => updateFormData('locationState', e.target.value)}
                >
                  <option value="">Select a state/territory (optional)</option>
                  {AU_STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City (optional)</label>
                <input
                  type="text"
                  value={formData.locationCity}
                  onChange={(e) => updateFormData('locationCity', e.target.value)}
                  placeholder="Your city"
                />
              </div>
            </div>
          )}

          {/* Step 3: Details */}
          {currentStep === 2 && (
            <div className="space-y-6 mt-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Industries / Areas of Interest
                </label>
                <p className="text-sm text-gray-500 mb-3">Select all that apply</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {INDUSTRIES.map((industry) => (
                    <button
                      key={industry}
                      type="button"
                      onClick={() => toggleIndustry(industry)}
                      className={`px-3 py-2 rounded-lg text-sm border transition-all ${
                        formData.industryCategories.includes(industry)
                          ? 'border-primary-600 bg-primary-50 text-primary-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {industry}
                    </button>
                  ))}
                </div>
              </div>

              {formData.organizationType !== 'individual' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Organization Size
                    </label>
                    <select
                      value={formData.businessSize}
                      onChange={(e) => updateFormData('businessSize', e.target.value as BusinessSize)}
                    >
                      <option value="">Select size (optional)</option>
                      <option value="solo">Solo / 1 employee</option>
                      <option value="1-10">1-10 employees</option>
                      <option value="11-50">11-50 employees</option>
                      <option value="51-250">51-250 employees</option>
                      <option value="250+">250+ employees</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Years in Operation
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.yearsInBusiness ?? ''}
                      onChange={(e) =>
                        updateFormData('yearsInBusiness', e.target.value ? parseInt(e.target.value) : null)
                      }
                      placeholder="e.g., 5"
                    />
                  </div>
                </>
              )}

              {formData.organizationType === 'nonprofit' && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="taxExempt"
                    checked={formData.taxExemptStatus}
                    onChange={(e) => updateFormData('taxExemptStatus', e.target.checked)}
                  />
                  <label htmlFor="taxExempt" className="text-sm text-gray-700">
                    501(c)(3) Tax-exempt status
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Special Status */}
          {currentStep === 3 && (
            <div className="space-y-6 mt-6">
              <p className="text-gray-600">
                Do any of these special designations apply? These can help match you with specific grant programs.
              </p>
              <div className="space-y-4">
                {[
                  { field: 'veteranStatus', label: 'Veteran-owned or veteran', desc: 'Military veteran or veteran-owned business' },
                  { field: 'womenOwned', label: 'Women-owned', desc: 'Women-owned business or led by women' },
                  { field: 'minorityOwned', label: 'Minority-owned', desc: 'Minority-owned business or organization' },
                  { field: 'disabilityStatus', label: 'Disability-owned or individual with disability', desc: 'Disability-owned business or person with a disability' },
                ].map((option) => (
                  <label
                    key={option.field}
                    className="flex items-start gap-3 p-4 rounded-xl border cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={formData[option.field as keyof FormData] as boolean}
                      onChange={(e) => updateFormData(option.field as keyof FormData, e.target.checked)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-gray-900">{option.label}</div>
                      <div className="text-sm text-gray-500">{option.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-sm text-gray-500">
                These are optional and won't limit your results - they help prioritize grants with specific preferences.
              </p>
            </div>
          )}

          {/* Step 5: Notifications */}
          {currentStep === 4 && (
            <div className="space-y-6 mt-6">
              <p className="text-gray-600">How would you like to receive grant notifications?</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Frequency
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { value: 'immediate', label: 'Immediate', desc: 'As soon as matched' },
                    { value: 'daily', label: 'Daily Digest', desc: 'Once per day' },
                    { value: 'weekly', label: 'Weekly Digest', desc: 'Once per week' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateFormData('emailFrequency', option.value as EmailFrequency)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        formData.emailFrequency === option.value
                          ? 'border-primary-600 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-semibold">{option.label}</div>
                      <div className="text-sm text-gray-500">{option.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Minimum Grant Amount
                </label>
                <p className="text-sm text-gray-500 mb-2">
                  Only notify me about grants of at least this amount
                </p>
                <select
                  value={formData.minGrantAmount}
                  onChange={(e) => updateFormData('minGrantAmount', parseInt(e.target.value))}
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
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 0}
              className="btn btn-secondary flex items-center gap-2 disabled:opacity-50"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            {currentStep < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                className="btn btn-primary flex items-center gap-2"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSaving}
                className="btn btn-primary flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Complete Setup
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
