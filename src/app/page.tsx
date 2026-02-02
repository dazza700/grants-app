import Link from 'next/link';
import { ArrowRight, Bell, Search, Users, DollarSign, CheckCircle } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-primary-50">
      {/* Navigation */}
      <nav className="px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/" className="text-2xl font-bold text-primary-700">
          GrantMatch
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-gray-600 hover:text-gray-900">
            Sign In
          </Link>
          <Link href="/register" className="btn btn-primary">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-6 py-20 max-w-7xl mx-auto text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Find Australian Government Grants
          <span className="block text-primary-600">That Match Your Needs</span>
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
          Stop spending hours searching GrantConnect and state portals. Tell us about your
          organisation and we'll notify you when matching opportunities are posted.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/register" className="btn btn-primary inline-flex items-center justify-center gap-2 px-8 py-3 text-lg">
            Start Free <ArrowRight className="w-5 h-5" />
          </Link>
          <Link href="#how-it-works" className="btn btn-outline px-8 py-3 text-lg">
            How It Works
          </Link>
        </div>
      </section>

      {/* Stats Section */}
      <section className="px-6 py-16 bg-white">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-4xl font-bold text-primary-600">$5B+</div>
            <div className="text-gray-600 mt-2">Australian Grants Available Annually</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-primary-600">130+</div>
            <div className="text-gray-600 mt-2">Active Grant Opportunities</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-primary-600">Federal + State</div>
            <div className="text-gray-600 mt-2">Commonwealth & State Grants</div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="px-6 py-20 max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center p-6">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-primary-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">1. Create Your Profile</h3>
            <p className="text-gray-600">
              Tell us about your organization type, location, industry, and special qualifications.
            </p>
          </div>
          <div className="text-center p-6">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-primary-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">2. We Find Matches</h3>
            <p className="text-gray-600">
              Our system scans GrantConnect and state government portals across NSW, VIC, QLD
              and more to find opportunities that match your criteria.
            </p>
          </div>
          <div className="text-center p-6">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8 text-primary-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">3. Get Notified</h3>
            <p className="text-gray-600">
              Receive email alerts when new grants match your profile. Never miss an opportunity again.
            </p>
          </div>
        </div>
      </section>

      {/* Who We Serve */}
      <section className="px-6 py-20 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Who We Serve</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="border rounded-xl p-8 hover:shadow-lg transition-shadow">
              <DollarSign className="w-10 h-10 text-primary-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Small Businesses</h3>
              <p className="text-gray-600 mb-4">
                Find grants for startups, R&D, export development, and business growth across Australia.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  R&D Tax Incentive programs
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Export Market Development Grants
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  State business grants
                </li>
              </ul>
            </div>
            <div className="border rounded-xl p-8 hover:shadow-lg transition-shadow">
              <Users className="w-10 h-10 text-primary-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Nonprofits</h3>
              <p className="text-gray-600 mb-4">
                Discover grants for charities, community organisations, and social service providers.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Community grants
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Commonwealth funding programs
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Social services funding
                </li>
              </ul>
            </div>
            <div className="border rounded-xl p-8 hover:shadow-lg transition-shadow">
              <Search className="w-10 h-10 text-primary-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Individuals</h3>
              <p className="text-gray-600 mb-4">
                Find personal grants for education, research, arts, and regional development.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Research & scholarships
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Arts & culture funding
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Regional assistance
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20 bg-primary-600 text-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Find Your Grants?</h2>
          <p className="text-primary-100 text-lg mb-8">
            Stop missing out on Australian government funding. Set up your profile in minutes
            and start receiving matches from Commonwealth and state grants today.
          </p>
          <Link href="/register" className="inline-flex items-center gap-2 bg-white text-primary-600 px-8 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors">
            Create Free Account <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-12 bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-2xl font-bold text-white">GrantMatch</div>
          <div className="flex gap-6 text-sm">
            <Link href="/about" className="hover:text-white">About</Link>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/contact" className="hover:text-white">Contact</Link>
          </div>
          <div className="text-sm">
            © {new Date().getFullYear()} GrantMatch. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
