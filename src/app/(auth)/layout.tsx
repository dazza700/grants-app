import Link from 'next/link';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Simple header */}
      <header className="p-4">
        <Link href="/" className="text-2xl font-bold text-primary-700">
          GrantMatch
        </Link>
      </header>

      {/* Auth content */}
      <main className="flex-1 flex items-center justify-center px-4">
        {children}
      </main>

      {/* Simple footer */}
      <footer className="p-4 text-center text-gray-500 text-sm">
        © {new Date().getFullYear()} GrantMatch. All rights reserved.
      </footer>
    </div>
  );
}
