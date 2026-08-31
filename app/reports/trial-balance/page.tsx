'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCompany } from '@/components/context/company-context';
import { 
  BarChart3, 
  Download, 
  Printer, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Folder, 
  FileText,
  BookOpen
} from 'lucide-react';
import { AccountTreeNode } from '@/lib/engine/coa-tree';

export default function TrialBalancePage() {
  const { activeCompany, activeCompanyId, formatAmount } = useCompany();
  const [data, setData] = useState<any>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchTrialBalance = async () => {
    if (!activeCompanyId) return;
    try {
      setIsLoading(true);
      let url = `/api/reports?companyId=${activeCompanyId}&type=trial-balance`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;
      
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load Trial Balance:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrialBalance();
  }, [activeCompanyId, startDate, endDate]);

  const exportCSV = () => {
    if (!data?.flattened) return;
    const rows = [
      ['Account Code', 'Account Name', 'Type', 'Debit Amount', 'Credit Amount', 'Net Balance'],
      ...data.flattened.map((a: AccountTreeNode) => [
        a.code,
        a.name,
        a.type,
        a.debitTotal.toFixed(activeCompany?.decimal_places || 2),
        a.creditTotal.toFixed(activeCompany?.decimal_places || 2),
        a.displayBalance.toFixed(activeCompany?.decimal_places || 2)
      ])
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Trial_Balance_${activeCompany?.legal_name}_${new Date().toISOString().substring(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const totals = data?.totals || { totalDebits: 0, totalCredits: 0, isBalanced: true };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
            <BarChart3 className="w-4 h-4" />
            <span>Financial Statements</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Hierarchical Trial Balance
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Recursive Chart of Accounts ledger aggregation with single-column signed validation.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span>From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span>To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>
        </div>

        <div>
          {totals.isBalanced ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/60">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Trial Balance Invariant Verified: Debits = Credits</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-950 text-rose-300 border border-rose-800/60">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>Unbalanced Variance: {formatAmount(totals.variance)}</span>
            </span>
          )}
        </div>
      </div>

      {/* Printable Report Card */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
        {/* Report Statutory Header */}
        <div className="text-center pb-4 border-b border-slate-800 space-y-1">
          <div className="text-xs uppercase tracking-widest text-emerald-400 font-bold">Flowbook by Utharam</div>
          <h2 className="text-lg font-bold text-white">{activeCompany?.legal_name}</h2>
          <div className="text-xs text-slate-400">
            Trial Balance as of {endDate || new Date().toISOString().substring(0, 10)} | Base Currency: {activeCompany?.base_currency}
          </div>
        </div>

        {/* Tabular Matrix */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Account Code & Name</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4 text-right">Debit Leg ({activeCompany?.base_currency})</th>
                <th className="py-3 px-4 text-right">Credit Leg ({activeCompany?.base_currency})</th>
                <th className="py-3 px-4 text-right">Net Closing Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {(data?.flattened || []).map((acc: AccountTreeNode) => {
                const isGroup = acc.is_group === 1;

                return (
                  <tr
                    key={acc.id}
                    className={`hover:bg-slate-850/40 transition-colors ${
                      isGroup ? 'bg-slate-900/40 font-bold' : ''
                    }`}
                  >
                    <td className="py-2.5 px-4" style={{ paddingLeft: `${acc.level * 18 + 16}px` }}>
                      <div className="flex items-center gap-2">
                        {isGroup ? (
                          <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        )}
                        <span className="font-mono text-slate-300">{acc.code}</span>
                        {isGroup ? (
                          <span className="text-white">{acc.name}</span>
                        ) : (
                          <Link
                            href={`/ledger?accountId=${acc.id}`}
                            className="text-slate-200 hover:text-emerald-400 hover:underline decoration-dotted"
                            title="Click to view Account Ledger"
                          >
                            {acc.name}
                          </Link>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 font-mono text-[10px]">
                      {acc.type}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-emerald-400">
                      {acc.debitTotal > 0 ? formatAmount(acc.debitTotal) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-sky-400">
                      {acc.creditTotal > 0 ? formatAmount(acc.creditTotal) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-100">
                      {formatAmount(acc.displayBalance)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Grand Totals Footer */}
            <tfoot className="bg-slate-900 font-bold border-t-2 border-slate-700 text-xs">
              <tr>
                <td colSpan={2} className="py-3 px-4 text-slate-200 uppercase">
                  Grand Summary Totals
                </td>
                <td className="py-3 px-4 text-right font-mono text-emerald-400 text-sm">
                  {formatAmount(totals.totalDebits)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-sky-400 text-sm">
                  {formatAmount(totals.totalCredits)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-white text-sm">
                  {formatAmount(totals.totalDebits - totals.totalCredits)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
