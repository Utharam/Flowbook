'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Building2, 
  Layers, 
  Receipt, 
  BookOpen,
  Sparkles, 
  Boxes, 
  AlertCircle, 
  BarChart3, 
  FileSpreadsheet, 
  PieChart, 
  FileText, 
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck,
  Columns,
  Database
} from 'lucide-react';
import { clsx } from 'clsx';

const NAV_ITEMS = [
  {
    category: 'Core Ledger',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
      { name: 'Account Ledger', href: '/ledger', icon: BookOpen },
      { name: 'Vouchers & Daybook', href: '/vouchers', icon: Receipt },
      { name: 'Chart of Accounts', href: '/accounts', icon: Layers },
    ]
  },
  {
    category: 'Operations',
    items: [
      { name: 'Flow Templates', href: '/templates', icon: Sparkles },
      { name: 'Asset Clusters', href: '/assets', icon: Boxes },
      { name: 'Action Queue & Scrutiny', href: '/queue', icon: AlertCircle },
    ]
  },
  {
    category: 'Financial Reporting',
    items: [
      { name: 'Trial Balance', href: '/reports/trial-balance', icon: BarChart3 },
      { name: 'Balance Sheet', href: '/reports/balance-sheet', icon: PieChart },
      { name: 'Profit & Loss', href: '/reports/income-statement', icon: FileText },
      { name: 'Multi-Company Compare', href: '/reports/comparison', icon: Columns },
      { name: 'Tag Dimensions (#)', href: '/reports/tag-matrix', icon: FileSpreadsheet },
      { name: 'Custom Pivot Designer', href: '/reports/designer', icon: SlidersHorizontal },
    ]
  },
  {
    category: 'Administration & Governance',
    items: [
      { name: 'Entity Management', href: '/governance', icon: Building2 },
      { name: 'Backup & Audit Trail', href: '/backup', icon: Database },
    ]
  }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-[#0d1527] border-r border-slate-800/80 flex flex-col h-screen select-none sticky top-0">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-bold text-lg">
          F
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-100 tracking-tight text-base">Flowbook</span>
            <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">ERP</span>
          </div>
          <div className="text-[11px] font-medium text-emerald-400/90 tracking-wide">by Utharam</div>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {NAV_ITEMS.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1">
            <div className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              {group.category}
            </div>
            {group.items.map((item, idx) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

              return (
                <Link
                  key={idx}
                  href={item.href}
                  className={clsx(
                    'flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 group',
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={clsx('w-4 h-4 transition-colors', isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-300')} />
                    <span>{item.name}</span>
                  </div>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-emerald-400" />}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bottom Status Card */}
      <div className="p-3 border-t border-slate-800/80 bg-[#090f1d]">
        <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="text-[11px]">
            <div className="text-slate-200 font-medium leading-tight">Audit Immutability</div>
            <div className="text-slate-300 text-[10px]">Zero-Sum Ledger Active</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
