'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCompany } from '@/components/context/company-context';
import { 
  PieChart, 
  Download, 
  Printer, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Folder, 
  FileText, 
  ChevronRight, 
  ChevronDown, 
  BookOpen,
  ArrowRight
} from 'lucide-react';
import { AccountTreeNode } from '@/lib/engine/coa-tree';

export default function BalanceSheetPage() {
  const { activeCompany, activeCompanyId, formatAmount } = useCompany();
  const [data, setData] = useState<any>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    acc_1000: true,
    acc_1100: true,
    acc_1500: true,
    acc_2000: true,
    acc_2100: true,
    acc_3000: true
  });

  const fetchBalanceSheet = async () => {
    if (!activeCompanyId) return;
    try {
      setIsLoading(true);
      let url = `/api/reports?companyId=${activeCompanyId}&type=balance-sheet`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;

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
  }, [activeCompanyId, startDate, endDate]);

  const toggleExpand = (id: string) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const exportCSV = () => {
    if (!data) return;
    const rows = [
      [`Flowbook by Utharam - Balance Sheet`],
      [`Entity: ${activeCompany?.legal_name}`],
      [`As of Date: ${endDate || 'Present'}`],
      [`Base Currency: ${activeCompany?.base_currency}`],
      [],
      ['Category', 'Account Code', 'Account Name', 'Balance'],
      ...data.assets.map((a: AccountTreeNode) => ['Assets', a.code, a.name, a.displayBalance.toFixed(activeCompany?.decimal_places || 2)]),
      ['Total Assets', '', '', data.totals.totalAssets.toFixed(activeCompany?.decimal_places || 2)],
      [],
      ...data.liabilities.map((l: AccountTreeNode) => ['Liabilities', l.code, l.name, l.displayBalance.toFixed(activeCompany?.decimal_places || 2)]),
      ['Total Liabilities', '', '', data.totals.totalLiabilities.toFixed(activeCompany?.decimal_places || 2)],
      [],
      ...data.equity.map((e: AccountTreeNode) => ['Equity', e.code, e.name, e.displayBalance.toFixed(activeCompany?.decimal_places || 2)]),
      ['Current Period Earnings (P&L)', '', '', data.totals.currentPeriodEarnings.toFixed(activeCompany?.decimal_places || 2)],
      ['Total Equity with Earnings', '', '', data.totals.totalEquityWithEarnings.toFixed(activeCompany?.decimal_places || 2)],
      [],
      ['Total Liabilities & Equity', '', '', data.totals.totalLiabilitiesAndEquity.toFixed(activeCompany?.decimal_places || 2)]
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Balance_Sheet_${activeCompany?.legal_name}_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderAccountRow = (node: AccountTreeNode) => {
    const isGroup = node.is_group === 1;
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes[node.id];

    return (
      <React.Fragment key={node.id}>
        <tr className={`hover:bg-slate-850/50 transition-colors group ${isGroup ? 'bg-slate-900/40 font-bold' : ''}`}>
          <td className="py-2.5 px-4" style={{ paddingLeft: `${node.level * 18 + 16}px` }}>
            <div className="flex items-center gap-2">
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggleExpand(node.id)}
                  className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-white"
                >
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              ) : (
                <div className="w-4" />
              )}

              {isGroup ? (
                <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              )}

              <span className="font-mono text-slate-400">{node.code}</span>

              {isGroup ? (
                <span className="text-white">{node.name}</span>
              ) : (
                <Link
                  href={`/ledger?accountId=${node.id}`}
                  className="text-slate-200 hover:text-emerald-400 font-medium hover:underline decoration-dotted flex items-center gap-1.5"
                  title="Click to view detailed Account Ledger"
                >
                  <span>{node.name}</span>
                  <BookOpen className="w-3 h-3 text-slate-500 group-hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              )}
            </div>
          </td>
          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-100 whitespace-nowrap">
            {formatAmount(node.displayBalance)}
          </td>
        </tr>

        {hasChildren && isExpanded && node.children.map(child => renderAccountRow(child))}
      </React.Fragment>
    );
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
            Classified Balance Sheet
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Statement of Financial Position with dynamic Current Period Retained Earnings and inner ledger drilldown.
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
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Statement</span>
          </button>
        </div>
      </div>

      {/* Date Filter & Balancing Bar */}
      <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span>As of Date:</span>
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
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/60 shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Accounting Invariant Balanced: Assets = Liabilities + Equity</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-rose-950 text-rose-300 border border-rose-800/60 shadow-sm">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span>Balance Sheet Out of Balance</span>
            </span>
          )}
        </div>
      </div>

      {/* Report Container */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
        {/* Header */}
        <div className="text-center pb-4 border-b border-slate-800 space-y-1">
          <div className="text-xs uppercase tracking-widest text-emerald-400 font-bold">Flowbook by Utharam</div>
          <h2 className="text-lg font-bold text-white">{activeCompany?.legal_name}</h2>
          <div className="text-xs text-slate-400">
            Statement of Financial Position as of {endDate || new Date().toISOString().substring(0, 10)} | Base Currency: {activeCompany?.base_currency}
          </div>
        </div>

        {/* 2-Column Balance Sheet Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: ASSETS */}
          <div className="space-y-4">
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-inner">
              <div className="p-3 bg-emerald-950/50 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                  1. Assets (Debit Normal)
                </h3>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {formatAmount(totals.totalAssets)}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <tbody className="divide-y divide-slate-800/60">
                    {(data?.assets || []).map((node: AccountTreeNode) => renderAccountRow(node))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Total Assets Summary Box */}
            <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800/80 flex items-center justify-between font-bold text-sm">
              <span className="text-emerald-200">TOTAL ASSETS</span>
              <span className="font-mono text-emerald-300 text-base">
                {formatAmount(totals.totalAssets)}
              </span>
            </div>
          </div>

          {/* RIGHT: LIABILITIES & EQUITY */}
          <div className="space-y-4">
            {/* Liabilities */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-inner">
              <div className="p-3 bg-sky-950/50 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-sky-300">
                  2. Liabilities (Credit Normal)
                </h3>
                <span className="text-xs font-mono font-bold text-sky-400">
                  {formatAmount(totals.totalLiabilities)}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <tbody className="divide-y divide-slate-800/60">
                    {(data?.liabilities || []).map((node: AccountTreeNode) => renderAccountRow(node))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Equity & Retained Earnings */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-inner">
              <div className="p-3 bg-indigo-950/50 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                  3. Equity & Reserves
                </h3>
                <span className="text-xs font-mono font-bold text-indigo-400">
                  {formatAmount(totals.totalEquityWithEarnings)}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <tbody className="divide-y divide-slate-800/60">
                    {(data?.equity || []).map((node: AccountTreeNode) => renderAccountRow(node))}
                    {/* Dynamic P&L Earnings Row */}
                    <tr className="bg-indigo-950/30 font-semibold text-indigo-200">
                      <td className="py-2.5 px-6">
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-indigo-400" />
                          <Link href="/reports/income-statement" className="hover:underline flex items-center gap-1">
                            <span>Current Period Net Earnings (From P&L)</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-indigo-300 whitespace-nowrap">
                        {formatAmount(totals.currentPeriodEarnings)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Total Liabilities & Equity Summary Box */}
            <div className="p-4 rounded-xl bg-sky-950/60 border border-sky-800/80 flex items-center justify-between font-bold text-sm">
              <span className="text-sky-200">TOTAL LIABILITIES & EQUITY</span>
              <span className="font-mono text-sky-300 text-base">
                {formatAmount(totals.totalLiabilitiesAndEquity)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
