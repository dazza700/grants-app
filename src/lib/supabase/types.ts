// Database types generated from schema
// These should be regenerated if schema changes

export type OrganizationType = 'individual' | 'small_business' | 'nonprofit';
export type BusinessSize = 'solo' | '1-10' | '11-50' | '51-250' | '250+';
export type EmailFrequency = 'immediate' | 'daily' | 'weekly';
export type GrantSource = 'grants_gov' | 'sam_gov' | 'state' | 'foundation';
export type ApplicationStatus = 'interested' | 'applied' | 'awarded' | 'rejected';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  organization_name: string | null;
  organization_type: OrganizationType;
  created_at: string;
  updated_at: string;
}

export interface UserCriteria {
  id: string;
  user_id: string;
  location_state: string | null;
  location_city: string | null;
  industry_categories: string[];
  business_size: BusinessSize | null;
  annual_revenue_min: number | null;
  annual_revenue_max: number | null;
  years_in_business: number | null;
  tax_exempt_status: boolean;
  nonprofit_category: string | null;
  veteran_status: boolean;
  disability_status: boolean;
  minority_owned: boolean;
  women_owned: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferences {
  id: string;
  user_id: string;
  email_frequency: EmailFrequency;
  max_daily_emails: number;
  categories_filter: string[];
  min_grant_amount: number;
  created_at: string;
  updated_at: string;
}

export interface Grant {
  id: string;
  title: string;
  description: string | null;
  source_id: string;
  source: GrantSource;
  amount_min: number | null;
  amount_max: number | null;
  funding_available: number | null;
  eligible_organization_types: string[];
  eligible_states: string[];
  industry_categories: string[];
  posted_date: string | null;
  deadline: string;
  award_start_date: string | null;
  expected_award_date: string | null;
  agency_name: string | null;
  agency_code: string | null;
  contact_email: string | null;
  url: string | null;
  cfda_number: string | null;
  competition_id: string | null;
  raw_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  synced_from_external: string | null;
}

export interface NotificationHistory {
  id: string;
  user_id: string;
  grant_id: string;
  match_score: number | null;
  notified_at: string;
  email_sent: boolean;
  email_sent_at: string | null;
  email_bounced: boolean;
}

export interface SavedGrant {
  id: string;
  user_id: string;
  grant_id: string;
  saved_at: string;
  notes: string | null;
}

export interface GrantApplication {
  id: string;
  user_id: string;
  grant_id: string;
  status: ApplicationStatus;
  applied_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Join types for queries
export interface SavedGrantWithDetails extends SavedGrant {
  grant: Grant;
}

export interface GrantApplicationWithDetails extends GrantApplication {
  grant: Grant;
}

export interface NotificationWithGrant extends NotificationHistory {
  grant: Grant;
}

// Database type for Supabase client
export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: UserProfile;
        Insert: Omit<UserProfile, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>>;
      };
      user_criteria: {
        Row: UserCriteria;
        Insert: Omit<UserCriteria, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<UserCriteria, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;
      };
      notification_preferences: {
        Row: NotificationPreferences;
        Insert: Omit<NotificationPreferences, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<NotificationPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;
      };
      grants: {
        Row: Grant;
        Insert: Omit<Grant, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Grant, 'id' | 'created_at' | 'updated_at'>>;
      };
      notification_history: {
        Row: NotificationHistory;
        Insert: Omit<NotificationHistory, 'id' | 'notified_at'>;
        Update: Partial<Omit<NotificationHistory, 'id' | 'user_id' | 'grant_id' | 'notified_at'>>;
      };
      saved_grants: {
        Row: SavedGrant;
        Insert: Omit<SavedGrant, 'id' | 'saved_at'>;
        Update: Partial<Omit<SavedGrant, 'id' | 'user_id' | 'grant_id' | 'saved_at'>>;
      };
      grant_applications: {
        Row: GrantApplication;
        Insert: Omit<GrantApplication, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<GrantApplication, 'id' | 'user_id' | 'grant_id' | 'created_at' | 'updated_at'>>;
      };
    };
  };
}
