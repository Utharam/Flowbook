'use client';

import React, { useState, useEffect } from 'react';
import { useCompany } from '@/components/context/company-context';
import { 
  PieChart, 
  Download, 
  Printer, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Building, 
  ShieldCheck, 
  TrendingDown 
} from 'lucide-react';
import { AccountTreeNode } from '@/lib/engine/coa-tree';

export default function BalanceSheetPage() {
  const { activeCompany, activeCompanyId, formatAmount } = useCompany();
  const [data, setData] = useState<any>(null);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().substring(0, 10));
  const [isLoading, setIsLoading] = useState(true);

  const fetchBalanceSheet = async () => {
    if (!activeCompanyId) return;
    try {
      setIsLoading(true);
      let url = `/api/reports?companyId=${activeCompanyId}&type=balance-sheet`;
      if (asOfDate) url += `&endDate=${asOfDate}`;
      
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load Balance Sheet:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBalanceSheet();
  }, [activeCompanyId, asOfDate]);

  const handlePrint = () => {
    window.print();
  };

  const totals = data?.totals || {
    totalAssets: 0,
    totalLiabilities: 0,
    totalEquityBase: 0,
    currentPeriodEarnings: 0,
    totalEquityWithEarnings: 0,
    totalLiabilitiesAndEquity: 0,
    isBalanced: true
  };

  const renderSection = (title: string, nodes: AccountTreeNode[], total: number, icon: any) => {
    const Icon = icon;
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-300">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-emerald-400" />
            <span>{title}</span>
          </div>
          <span className="font-mono text-white text-sm">{formatAmount(total)}</span>
        </div>

        <div className="space-y-1.5 pl-2">
          {nodes.map(node => (
            <div key={node.id} className="flex items-center justify-between text-xs py-1 hover:bg-slate-800/30 px-2 rounded-lg">
              <span className="text-slate-300 font-medium">
                {node.code} - {node.name}
              </span>
              <span className="font-mono font-semibold text-slate-100">
                {formatAmount(node.displayBalance)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
            <PieChart className="w-4 h-4" />
            <span>Financial Statements</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Statement of Financial Position (Balance Sheet)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Assets = Liabilities + Equity invariant verified with dynamic retained earnings integration.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Statement</span>
          </button>
        </div>
      </div>

      {/* Date Filter & Balancing Status */}
      <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <Calendar className="w-4 h-4 text-emerald-400" />
          <span>Statement As Of:</span>
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
          />
        </div>

        <div>
          {totals.isBalanced ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/60">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Balance Sheet Invariant Balanced: Assets = Liabilities + Equity</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-950 text-rose-300 border border-rose-800/60">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>Imbalance Variance: {formatAmount(totals.balanceCheck)}</span>
            </span>
          )}
        </div>
      </div>

      {/* Balance Sheet Statement Document */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-8 shadow-sm space-y-8">
        {/* Title */}
        <div className="text-center pb-4 border-b border-slate-800 space-y-1">
          <div className="text-xs uppercase tracking-widest text-emerald-400 font-bold">Flowbook by Utharam</div>
          <h2 className="text-xl font-bold text-white">{activeCompany?.legal_name}</h2>
          <div className="text-xs text-slate-400">
            Balance Sheet as of {asOfDate} | Currency: {activeCompany?.base_currency}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Assets */}
          <div className="space-y-6">
            {renderSection('Assets', data?.assets || [], totals.totalAssets, Building)}

            {/* Total Assets Callout */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-sm font-bold text-emerald-400 font-mono">
              <span className="text-white uppercase text-xs">Total Assets</span>
              <span>{formatAmount(totals.totalAssets)}</span>
            </div>
          </div>

          {/* Right Column: Liabilities & Equity */}
          <div className="space-y-6">
            {renderSection('Liabilities', data?.liabilities || [], totals.totalLiabilities, TrendingDown)}
            {renderSection('Equity & Capital', data?.equity || [], totals.totalEquityBase, ShieldCheck)}

            {/* Retained Period Earnings */}
            <div className="flex items-center justify-between text-xs py-1 px-4 bg-slate-900/60 rounded-lg border border-slate-800">
              <span className="text-slate-300 font-medium italic">Current Period Net Earnings (P&L Integration)</span>
              <span className="font-mono font-bold text-emerald-400">{formatAmount(totals.currentPeriodEarnings)}</span>
            </div>

            {/* Total Liabilities & Equity Callout */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-sm font-bold text-sky-400 font-mono">
              <span className="text-white uppercase text-xs">Total Liabilities & Equity</span>
              <span>{formatAmount(totals.totalLiabilitiesAndEquity)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
