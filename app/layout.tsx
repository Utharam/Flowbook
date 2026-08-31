import './globals.css';
import type { Metadata } from 'next';
import { CompanyProvider } from '@/components/context/company-context';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

export const metadata: Metadata = {
  title: 'Flowbook by Utharam | Enterprise Financial ERP & Governance',
  description: 'Enterprise-grade multi-currency double-entry ledger, corporate cap table, asset clusters, and financial reporting suite.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0b0f17] text-slate-100 min-h-screen flex antialiased">
        <CompanyProvider>
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
            <Header />
            <main className="flex-1 overflow-y-auto p-6 bg-[#070b12]">
              {children}
            </main>
          </div>
        </CompanyProvider>
      </body>
    </html>
  );
}
