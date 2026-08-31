'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCompany } from '@/components/context/company-context';
import { 
  FileText, 
  Download, 
  Printer, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Folder, 
  ChevronRight, 
  ChevronDown,
  BookOpen
} from 'lucide-react';
import { AccountTreeNode } from '@/lib/engine/coa-tree';

export default function IncomeStatementPage() {
  const { activeCompany, activeCompanyId, formatAmount } = useCompany();
  const [data, setData] = useState<any>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    acc_4000: true,
    acc_5000: true
  });

  const fetchIncomeStatement = async () => {
    if (!activeCompanyId) return;
    try {
      setIsLoading(true);
      let url = `/api/reports?companyId=${activeCompanyId}&type=income-statement`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;

      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load Income Statement:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIncomeStatement();
  }, [activeCompanyId, startDate, endDate]);

  const toggleExpand = (id: string) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const exportCSV = () => {
    if (!data) return;
    const rows = [
      [`Flowbook by Utharam - Profit & Loss Statement (Income Statement)`],
      [`Entity: ${activeCompany?.legal_name}`],
      [`Period: ${startDate || 'Inception'} to ${endDate || 'Present'}`],
      [`Base Currency: ${activeCompany?.base_currency}`],
      [],
      ['Category', 'Account Code', 'Account Name', 'Amount'],
      ...data.revenue.map((r: AccountTreeNode) => ['Operating Revenue', r.code, r.name, r.displayBalance.toFixed(activeCompany?.decimal_places || 2)]),
      ['Total Operating Revenue', '', '', data.totals.totalRevenue.toFixed(activeCompany?.decimal_places || 2)],
      [],
      ...data.expenses.map((e: AccountTreeNode) => ['Operating Expenses', e.code, e.name, e.displayBalance.toFixed(activeCompany?.decimal_places || 2)]),
      ['Total Operating Expenses', '', '', data.totals.totalExpenses.toFixed(activeCompany?.decimal_places || 2)],
      [],
      ['Net Operating Profit / (Loss)', '', '', data.totals.netProfit.toFixed(activeCompany?.decimal_places || 2)]
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Income_Statement_${activeCompany?.legal_name}_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderAccountRow = (node: AccountTreeNode, isExpense: boolean = false) => {
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
                <FileText className={`w-3.5 h-3.5 shrink-0 ${isExpense ? 'text-amber-400' : 'text-emerald-400'}`} />
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

        {hasChildren && isExpanded && node.children.map(child => renderAccountRow(child, isExpense))}
      </React.Fragment>
    );
  };

  const totals = data?.totals || { totalRevenue: 0, totalExpenses: 0, netProfit: 0, marginPercentage: 0 };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
            <FileText className="w-4 h-4" />
            <span>Financial Statements</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Profit & Loss (Income Statement)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Statement of Financial Performance with margin analytics and inner ledger drilldown.
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

        {/* Profit Margin KPI Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-900 border border-slate-800 text-slate-200">
            <span>Net Margin:</span>
            <strong className={`font-mono ${totals.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totals.marginPercentage.toFixed(1)}%
            </strong>
          </div>
        </div>
      </div>

      {/* Report Container */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
        {/* Header */}
        <div className="text-center pb-4 border-b border-slate-800 space-y-1">
          <div className="text-xs uppercase tracking-widest text-emerald-400 font-bold">Flowbook by Utharam</div>
          <h2 className="text-lg font-bold text-white">{activeCompany?.legal_name}</h2>
          <div className="text-xs text-slate-400">
            Income Statement for the period {startDate || 'Inception'} to {endDate || new Date().toISOString().substring(0, 10)} | Base Currency: {activeCompany?.base_currency}
          </div>
        </div>

        {/* 1. OPERATING REVENUE SECTION */}
        <div className="space-y-3">
          <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
              1. Operating Revenue & Income
            </h3>
            <span className="text-xs font-mono font-bold text-emerald-400">
              {formatAmount(totals.totalRevenue)}
            </span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-inner">
            <table className="w-full text-left text-xs">
              <tbody className="divide-y divide-slate-800/60">
                {(data?.revenue || []).map((node: AccountTreeNode) => renderAccountRow(node, false))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 2. OPERATING EXPENSES SECTION */}
        <div className="space-y-3">
          <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
              2. Operating Expenses & Overheads
            </h3>
            <span className="text-xs font-mono font-bold text-amber-400">
              {formatAmount(totals.totalExpenses)}
            </span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-inner">
            <table className="w-full text-left text-xs">
              <tbody className="divide-y divide-slate-800/60">
                {(data?.expenses || []).map((node: AccountTreeNode) => renderAccountRow(node, true))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. NET PROFIT / (LOSS) SUMMARY FOOTER */}
        <div className="pt-4 border-t-2 border-slate-700">
          <div className={`p-5 rounded-2xl border flex items-center justify-between shadow-xl ${
            totals.netProfit >= 0
              ? 'bg-emerald-950/70 border-emerald-700/80 text-emerald-100'
              : 'bg-rose-950/70 border-rose-700/80 text-rose-100'
          }`}>
            <div className="flex items-center gap-3">
              {totals.netProfit >= 0 ? (
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                  <TrendingDown className="w-6 h-6" />
                </div>
              )}
              <div>
                <span className="text-xs font-bold uppercase tracking-wider block">
                  {totals.netProfit >= 0 ? 'NET OPERATING PROFIT' : 'NET OPERATING LOSS'}
                </span>
                <span className="text-[11px] opacity-80">
                  Revenue ({formatAmount(totals.totalRevenue)}) - Expenses ({formatAmount(totals.totalExpenses)})
                </span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-2xl font-bold font-mono tracking-tight">
                {formatAmount(totals.netProfit)}
              </div>
              <div className="text-xs font-bold mt-0.5">
                Margin: {totals.marginPercentage.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
