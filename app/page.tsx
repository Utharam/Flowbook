'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCompany } from '@/components/context/company-context';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Building, 
  Receipt, 
  AlertTriangle, 
  ArrowRight, 
  RotateCcw, 
  Sparkles, 
  ShieldCheck, 
  Globe2, 
  CheckCircle2 
} from 'lucide-react';

export default function DashboardPage() {
  const { activeCompany, activeCompanyId, formatAmount, formatSignedAmount } = useCompany();
  const [balanceSheet, setBalanceSheet] = useState<any>(null);
  const [incomeStatement, setIncomeStatement] = useState<any>(null);
  const [recentEntries, setRecentEntries] = useState<any[]>([]);
  const [queueItems, setQueueItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [reversingId, setReversingId] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    if (!activeCompanyId) return;
    try {
      setIsLoading(true);
      const [bsRes, isRes, jvRes, qRes] = await Promise.all([
        fetch(`/api/reports?companyId=${activeCompanyId}&type=balance-sheet`),
        fetch(`/api/reports?companyId=${activeCompanyId}&type=income-statement`),
        fetch(`/api/journal?companyId=${activeCompanyId}`),
        fetch(`/api/queue?companyId=${activeCompanyId}&status=PENDING`)
      ]);

      const [bsData, isData, jvData, qData] = await Promise.all([
        bsRes.json(),
        isRes.json(),
        jvRes.json(),
        qRes.json()
      ]);

      if (bsData.success) setBalanceSheet(bsData);
      if (isData.success) setIncomeStatement(isData);
      if (jvData.success) setRecentEntries(jvData.entries.slice(0, 6));
      if (qData.success) setQueueItems(qData.items);
    } catch (err) {
      console.error('Error fetching dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [activeCompanyId]);

  const handleMirrorReversal = async (entryId: string, entryNumber: string) => {
    if (!confirm(`Are you sure you want to post a 1-Click Mirror Reversal for ${entryNumber}? This will create an exact offsetting balancing voucher.`)) {
      return;
    }
    try {
      setReversingId(entryId);
      const res = await fetch('/api/journal/reverse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: activeCompanyId,
          entryId,
          reversalDate: new Date().toISOString().substring(0, 10),
          reversalMemo: `Mirror Reversal of ${entryNumber}`
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Mirror Reversal posted successfully: ${data.entry.entry_number}`);
        fetchDashboardData();
      } else {
        alert(`Reversal failed: ${data.errors?.join(', ') || data.error}`);
      }
    } catch (err: any) {
      alert(`Error reversing entry: ${err.message}`);
    } finally {
      setReversingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 gap-3">
        <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <span>Loading Flowbook financials...</span>
      </div>
    );
  }

  const bsTotals = balanceSheet?.totals || { totalAssets: 0, totalLiabilities: 0, totalEquityWithEarnings: 0 };
  const isTotals = incomeStatement?.totals || { totalRevenue: 0, totalExpenses: 0, netProfit: 0, marginPercentage: 0 };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome & Entity Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-[#0d1627] to-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {activeCompany?.company_type}
            </span>
            <span className="text-xs text-slate-400">• Jurisdiction: <strong className="text-slate-200">{activeCompany?.jurisdiction}</strong></span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {activeCompany?.legal_name}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Registration No: <span className="text-slate-300 font-mono">{activeCompany?.registration_number}</span> | Tax Identifier: <span className="text-slate-300 font-mono">{activeCompany?.tax_identifier || 'N/A'}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/vouchers/new"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-lg shadow-emerald-600/25 transition-all"
          >
            <Receipt className="w-4 h-4" />
            <span>Post Voucher</span>
          </Link>
          <Link
            href="/reports/trial-balance"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition-all"
          >
            <span>Trial Balance</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Action Queue Alert Banner (If pending alerts) */}
      {queueItems.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-800/50 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="text-xs font-semibold text-amber-200">
                {queueItems.length} Action Queue Items Require Review
              </div>
              <div className="text-[11px] text-amber-300/80">
                Inactivity Scrutiny scanner detected missing recurring bills or pending intercompany mirror vouchers.
              </div>
            </div>
          </div>
          <Link
            href="/queue"
            className="text-xs font-medium text-amber-400 hover:text-amber-300 bg-amber-900/40 hover:bg-amber-900/60 px-3 py-1.5 rounded-lg border border-amber-700/50 transition-colors"
          >
            Review Queue
          </Link>
        </div>
      )}

      {/* Financial Core KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Assets */}
        <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-2xl shadow-sm hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">Total Assets</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {formatAmount(bsTotals.totalAssets)}
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
            <span className="text-emerald-400 font-medium">Balanced:</span>
            <span>Single-Column Storage Active</span>
          </div>
        </div>

        {/* Total Liabilities */}
        <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-2xl shadow-sm hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">Liabilities & Debt</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {formatAmount(bsTotals.totalLiabilities)}
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            Accounts Payable & Long-Term Debt
          </div>
        </div>

        {/* Net Equity */}
        <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-2xl shadow-sm hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">Total Equity</span>
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {formatAmount(bsTotals.totalEquityWithEarnings)}
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            Share Capital + Period Retained
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-2xl shadow-sm hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">Net Margin (P&L)</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-400 tracking-tight">
            {formatAmount(isTotals.netProfit)}
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
            <span className="text-slate-300 font-semibold">{isTotals.marginPercentage.toFixed(1)}%</span>
            <span>Margin on Revenue</span>
          </div>
        </div>
      </div>

      {/* Operational Highlights & Templates Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Flow Templates Launchpad */}
        <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">Flow Templates</h2>
            </div>
            <Link href="/templates" className="text-[11px] text-emerald-400 hover:underline">
              View All
            </Link>
          </div>
          <p className="text-xs text-slate-400">
            One-click pre-configured blueprints with fixed accounts and auto-tagging.
          </p>

          <div className="space-y-2">
            <Link
              href="/vouchers/new?template=tpl_rent"
              className="block p-3 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 group-hover:text-emerald-300">Monthly HQ Office Rent</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">RENT</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Pre-fills Rent Expense & Bank tags</div>
            </Link>

            <Link
              href="/vouchers/new?template=tpl_billing"
              className="block p-3 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 group-hover:text-emerald-300">SaaS Subscription Invoicing</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">SALES</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Direct AR & Subscription Revenue allocation</div>
            </Link>
          </div>
        </div>

        {/* Multi-Currency Treasury Status */}
        <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-sky-400" />
              <h2 className="text-sm font-bold text-white">Multi-Currency FX Engine</h2>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800/60 font-semibold">
              Live Triangulation
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Normalized base currency with automatic Realized FX Gain/Loss settlements.
          </p>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-slate-400 text-[10px]">EUR / USD</div>
              <div className="text-slate-100 font-mono font-semibold text-sm mt-0.5">1.0850</div>
              <div className="text-[10px] text-emerald-400 mt-0.5">Normalized: $1.085</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-slate-400 text-[10px]">AED / USD</div>
              <div className="text-slate-100 font-mono font-semibold text-sm mt-0.5">0.2723</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Pegged: 3.6725</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-slate-400 text-[10px]">GBP / USD</div>
              <div className="text-slate-100 font-mono font-semibold text-sm mt-0.5">1.2850</div>
              <div className="text-[10px] text-emerald-400 mt-0.5">Benchmark Active</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-slate-400 text-[10px]">INR / USD</div>
              <div className="text-slate-100 font-mono font-semibold text-sm mt-0.5">0.0118</div>
              <div className="text-[10px] text-slate-400 mt-0.5">~84.75 INR</div>
            </div>
          </div>
        </div>

        {/* Corporate Governance Quick Summary */}
        <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white">Governance & Cap Table</h2>
            </div>
            <Link href="/governance" className="text-[11px] text-amber-400 hover:underline">
              Manage
            </Link>
          </div>
          <p className="text-xs text-slate-400">
            Officers, UBO classifications, and shareholding equity ownership registry.
          </p>

          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">K. Utharam (MD)</span>
              <span className="text-xs font-bold text-emerald-400">60.00% Equity</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden flex">
              <div className="bg-emerald-500 h-full" style={{ width: '60%' }}></div>
              <div className="bg-sky-500 h-full" style={{ width: '40%' }}></div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>UBO: Direct Voting Rights</span>
              <span>40% Family Trust</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Journal Vouchers Table with 1-Click Mirror Reversals */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Recent Journal Vouchers & Audit Trail</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Append-only immutable ledger. Closed periods protected by lock date barriers.
            </p>
          </div>
          <Link
            href="/vouchers"
            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
          >
            <span>View Full Daybook</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Voucher No</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Particulars / Memo</th>
                <th className="py-3 px-4">Tags (#)</th>
                <th className="py-3 px-4 text-right">Debit / Credit Legs</th>
                <th className="py-3 px-4 text-center">Audit Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {recentEntries.map((entry) => {
                const isReversal = entry.is_reversal === 1;
                const isNonFinancial = entry.is_non_financial === 1;
                const totalDebit = (entry.lines || [])
                  .filter((l: any) => l.amount < 0)
                  .reduce((sum: number, l: any) => sum + Math.abs(l.amount), 0);

                return (
                  <tr key={entry.id} className="hover:bg-slate-850/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-200">
                      {entry.entry_number}
                    </td>
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                      {entry.entry_date}
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-medium text-slate-200 truncate">{entry.memo || 'Voucher entry'}</div>
                      {entry.reference && (
                        <div className="text-[10px] text-slate-500 font-mono">Ref: {entry.reference}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {(entry.lines || []).flatMap((l: any) => {
                          try { return JSON.parse(l.tags || '[]'); } catch { return []; }
                        }).filter((v: any, i: number, a: any[]) => a.indexOf(v) === i).map((tag: string, tIdx: number) => (
                          <span key={tIdx} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-slate-200">
                      {isNonFinancial ? (
                        <span className="text-slate-500 italic">Zero-Value Attestation</span>
                      ) : (
                        formatAmount(totalDebit)
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {isNonFinancial ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-950 text-sky-400 border border-sky-800/50">
                          <CheckCircle2 className="w-3 h-3" /> Attestation
                        </span>
                      ) : isReversal ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950 text-amber-400 border border-amber-800/50">
                          <RotateCcw className="w-3 h-3" /> Reversal
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                          <ShieldCheck className="w-3 h-3" /> Posted
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {!isReversal && !isNonFinancial && (
                        <button
                          onClick={() => handleMirrorReversal(entry.id, entry.entry_number)}
                          disabled={reversingId === entry.id}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-rose-950/50 hover:text-rose-300 text-slate-300 text-[11px] font-medium border border-slate-700 hover:border-rose-800/50 transition-all"
                        >
                          {reversingId === entry.id ? 'Reversing...' : '1-Click Reverse'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
