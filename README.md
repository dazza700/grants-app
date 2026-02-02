# GrantMatch - Government Grants Notification App

A web application that helps individuals, small businesses, and nonprofits discover and track government grants. Users input their eligibility criteria and receive email notifications when matching grants are posted.

## Features

- 🔍 **Smart Matching**: Matches grants to your eligibility criteria
- 📧 **Email Notifications**: Get notified when new matching grants are posted
- 🏷️ **Save & Track**: Bookmark grants and track your applications
- 🔐 **Secure Authentication**: Magic link and Google OAuth login

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Email**: Resend
- **Hosting**: Netlify

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase account
- A Resend account (for emails)
- Simpler.Grants.gov API key (optional, for grant data)

### Setup

1. **Clone and install dependencies**
   ```bash
   cd grants-app
   npm install
   ```

2. **Set up Supabase**
   - Create a new Supabase project
   - Run the SQL migration in `supabase/migrations/001_initial_schema.sql`
   - Copy your project URL and API keys

3. **Configure environment variables**
   ```bash
   cp .env.local.example .env.local
   ```
   Then edit `.env.local` with your credentials:
   - `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
   - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
   - `RESEND_API_KEY` - Your Resend API key
   - `SIMPLER_GRANTS_API_KEY` - Your Simpler.Grants.gov API key
   - `CRON_SECRET` - A random secret for cron job authentication

4. **Run the development server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

### Deployment to Netlify

1. Push your code to a Git repository
2. Connect the repository to Netlify
3. Set the environment variables in Netlify dashboard
4. Deploy!

### Setting Up Scheduled Jobs

For automatic grant syncing, set up a cron service to call:
- `/api/cron/sync-grants` - Every 6 hours
- `/api/cron/send-notifications` - Every hour

Use [EasyCron](https://www.easycron.com/) (free tier) or similar, with the Authorization header:
```
Authorization: Bearer YOUR_CRON_SECRET
```

## Project Structure

```
grants-app/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (auth)/             # Auth pages (login, register)
│   │   ├── (dashboard)/        # Dashboard pages
│   │   ├── api/                # API routes
│   │   └── onboarding/         # User onboarding wizard
│   ├── components/             # React components
│   └── lib/                    # Utility libraries
│       ├── supabase/           # Supabase client
│       ├── grants-api/         # Grants.gov API client
│       ├── matching/           # Grant matching algorithm
│       └── email/              # Email utilities
├── supabase/
│   └── migrations/             # Database migrations
└── public/                     # Static assets
```

## API Routes

- `GET /api/cron/sync-grants` - Sync grants from Simpler.Grants.gov
- `GET /api/cron/send-notifications` - Process and send notifications

## License

MIT
