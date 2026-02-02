/**
 * Simpler.Grants.gov API Client
 * Documentation: https://api.simpler.grants.gov/docs
 */

const API_BASE_URL = 'https://api.simpler.grants.gov/v1';

export interface SimplerGrantOpportunity {
  opportunity_id: string;
  opportunity_title: string;
  agency_name: string;
  agency_code: string;
  opportunity_status: string;
  category: string;
  posted_date: string;
  close_date: string;
  archive_date: string | null;
  opportunity_number: string;
  cfda_numbers: string[];
  applicant_types: string[];
  funding_instrument: string;
  award_floor: number | null;
  award_ceiling: number | null;
  expected_number_of_awards: number | null;
  estimated_total_program_funding: number | null;
  summary: {
    summary_description: string;
    additional_info_url: string;
  };
}

export interface SearchResponse {
  data: SimplerGrantOpportunity[];
  pagination: {
    page_offset: number;
    page_size: number;
    total_pages: number;
    total_records: number;
  };
}

export interface SearchParams {
  query?: string;
  status?: 'forecasted' | 'posted' | 'closed' | 'archived';
  agency?: string;
  category?: string;
  applicant_type?: string;
  funding_instrument?: string;
  page_offset?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export class SimplerGrantsClient {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.SIMPLER_GRANTS_API_KEY || '';
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.apiKey && { 'X-Api-Key': this.apiKey }),
    };

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error ${response.status}: ${error}`);
    }

    return response.json();
  }

  /**
   * Search for grant opportunities
   */
  async searchOpportunities(params: SearchParams = {}): Promise<SearchResponse> {
    // Use POST with JSON body as per Simpler.Grants.gov API docs
    const body: Record<string, any> = {
      pagination: {
        page_offset: params.page_offset || 1,
        page_size: params.page_size || 25,
        sort_order: [
          {
            order_by: 'post_date',
            sort_direction: 'descending',
          },
        ],
      },
    };

    // Add filters if specified
    if (params.status) {
      body.filters = {
        opportunity_status: { one_of: [params.status] },
      };
    }

    if (params.query) {
      body.query = params.query;
    }

    return this.request<SearchResponse>('/opportunities/search', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Get a specific opportunity by ID
   */
  async getOpportunity(opportunityId: string): Promise<SimplerGrantOpportunity> {
    return this.request<SimplerGrantOpportunity>(`/opportunities/${opportunityId}`);
  }

  /**
   * Fetch all posted opportunities (paginated)
   */
  async fetchAllPostedOpportunities(
    onBatch?: (batch: SimplerGrantOpportunity[], progress: { current: number; total: number }) => void
  ): Promise<SimplerGrantOpportunity[]> {
    const allOpportunities: SimplerGrantOpportunity[] = [];
    let pageOffset = 0;
    const pageSize = 100;
    let totalRecords = 0;

    do {
      const response = await this.searchOpportunities({
        status: 'posted',
        page_offset: pageOffset,
        page_size: pageSize,
        sort_by: 'posted_date',
        sort_order: 'desc',
      });

      totalRecords = response.pagination.total_records;
      allOpportunities.push(...response.data);

      if (onBatch) {
        onBatch(response.data, {
          current: allOpportunities.length,
          total: totalRecords,
        });
      }

      pageOffset += pageSize;

      // Rate limiting: wait 100ms between requests
      await new Promise((resolve) => setTimeout(resolve, 100));
    } while (allOpportunities.length < totalRecords);

    return allOpportunities;
  }
}

// Map applicant types from Simpler.Grants.gov to our organization types
export function mapApplicantTypes(applicantTypes: string[]): string[] {
  const typeMapping: Record<string, string> = {
    'Individuals': 'individual',
    'For profit organizations other than small businesses': 'small_business',
    'Small businesses': 'small_business',
    'Nonprofits having a 501(c)(3) status with the IRS, other than institutions of higher education': 'nonprofit',
    'Nonprofits that do not have a 501(c)(3) status with the IRS, other than institutions of higher education': 'nonprofit',
    'Private institutions of higher education': 'nonprofit',
    'Public and State controlled institutions of higher education': 'nonprofit',
  };

  const mapped = new Set<string>();

  for (const type of applicantTypes) {
    const mappedType = typeMapping[type];
    if (mappedType) {
      mapped.add(mappedType);
    }
  }

  return Array.from(mapped);
}

// Map categories from Simpler.Grants.gov to our industry categories
export function mapCategory(category: string): string[] {
  const categoryMapping: Record<string, string[]> = {
    'Agriculture': ['Agriculture'],
    'Arts': ['Arts & Culture'],
    'Business and Commerce': ['Retail & Services', 'Manufacturing'],
    'Community Development': ['Social Services', 'Housing'],
    'Consumer Protection': ['Social Services'],
    'Disaster Prevention and Relief': ['Social Services'],
    'Education': ['Education'],
    'Employment, Labor and Training': ['Education', 'Social Services'],
    'Energy': ['Energy & Environment'],
    'Environment': ['Energy & Environment'],
    'Food and Nutrition': ['Agriculture', 'Social Services'],
    'Health': ['Healthcare'],
    'Housing': ['Housing'],
    'Humanities': ['Arts & Culture', 'Education'],
    'Information and Statistics': ['Technology'],
    'Income Security and Social Services': ['Social Services'],
    'Law, Justice and Legal Services': ['Social Services'],
    'Natural Resources': ['Energy & Environment'],
    'Opportunity Zone Benefits': ['Housing', 'Social Services'],
    'Regional Development': ['Housing', 'Social Services'],
    'Science and Technology and other Research and Development': ['Research & Development', 'Technology'],
    'Transportation': ['Transportation'],
  };

  return categoryMapping[category] || ['Other'];
}
