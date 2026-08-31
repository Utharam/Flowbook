'use client';

import React from 'react';
import Link from 'next/link';
import { useCompany } from '../context/company-context';
import { 
  Building2, 
  Calendar, 
  Lock, 
  Unlock, 
  PlusCircle, 
  Coins
} from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function Header() {
  const { companies, activeCompany, activeCompanyId, setActiveCompanyId } = useCompany();

  return (
    <header className="h-16 bg-[#0b1220] border-b border-slate-800/80 px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Entity Selector Dropdown */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-750 rounded-xl px-3 py-1.5 shadow-inner">
          <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <select
            value={activeCompanyId}
            onChange={(e) => setActiveCompanyId(e.target.value)}
            className="bg-transparent text-xs font-semibold text-slate-100 focus:outline-none cursor-pointer pr-2 max-w-xs truncate"
            title="Switch Active Entity Books"
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id} className="bg-slate-900 text-slate-100">
                {c.legal_name} ({c.jurisdiction})
              </option>
            ))}
          </select>
        </div>

        {/* Company Parameters Meta Badges */}
        {activeCompany && (
          <div className="hidden lg:flex items-center gap-2.5 text-[11px]">
            {/* Base Currency Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/60 border border-slate-700/50 text-slate-300">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>Base: <strong className="text-slate-100 font-semibold">{activeCompany.base_currency}</strong></span>
              <span className="text-slate-400">({activeCompany.decimal_places} dec)</span>
            </div>

            {/* Financial Year Start */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/60 border border-slate-700/50 text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-sky-400" />
              <span>FY Start: <strong className="text-slate-100">{MONTH_NAMES[activeCompany.financial_year_start_month - 1]}</strong></span>
            </div>

            {/* Lock Date Status */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/60 border border-slate-700/50 text-slate-300">
              {activeCompany.lock_date ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Locked through: <strong className="text-amber-300">{activeCompany.lock_date}</strong></span>
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-slate-400">Books: <strong className="text-emerald-300 font-normal">Open</strong></span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick Action Button */}
      <div className="flex items-center gap-3">
        <Link
          href="/vouchers/new"
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md shadow-emerald-700/20 transition-all active:scale-[0.98]"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Voucher</span>
        </Link>
      </div>
    </header>
  );
}
