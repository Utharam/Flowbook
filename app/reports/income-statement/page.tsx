'use client';

import React, { useState, useEffect } from 'react';
import { useCompany } from '@/components/context/company-context';
import { 
  FileText, 
  Printer, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  DollarSign 
} from 'lucide-react';
import { AccountTreeNode } from '@/lib/engine/coa-tree';

export default function IncomeStatementPage() {
  const { activeCompany, activeCompanyId, formatAmount } = useCompany();
  const [data, setData] = useState<any>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);

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

  const handlePrint = () => {
    window.print();
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
            Statement of Profit & Loss (Income Statement)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Operating revenue, recurring expenses, and net profit margin breakdown.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print P&L</span>
          </button>
        </div>
      </div>

      {/* Date Filter */}
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

        <div className="text-xs text-slate-300">
          Net Profit Margin: <strong className="text-emerald-400 font-bold font-mono text-sm">{totals.marginPercentage.toFixed(1)}%</strong>
        </div>
      </div>

      {/* Income Statement Document */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-8 shadow-sm space-y-8">
        {/* Header */}
        <div className="text-center pb-4 border-b border-slate-800 space-y-1">
          <div className="text-xs uppercase tracking-widest text-emerald-400 font-bold">Flowbook by Utharam</div>
          <h2 className="text-xl font-bold text-white">{activeCompany?.legal_name}</h2>
          <div className="text-xs text-slate-400">
            Income Statement for Period Ended {endDate || new Date().toISOString().substring(0, 10)} | Base: {activeCompany?.base_currency}
          </div>
        </div>

        <div className="space-y-8">
          {/* Revenue Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span>Operating Revenue & Income</span>
              </div>
              <span className="font-mono text-white text-sm">{formatAmount(totals.totalRevenue)}</span>
            </div>

            <div className="space-y-1.5 pl-2">
              {(data?.revenue || []).map((node: AccountTreeNode) => (
                <div key={node.id} className="flex items-center justify-between text-xs py-1.5 hover:bg-slate-800/30 px-2 rounded-lg">
                  <span className="text-slate-200 font-medium">{node.code} - {node.name}</span>
                  <span className="font-mono font-bold text-emerald-400">{formatAmount(node.displayBalance)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Expenses Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-bold uppercase tracking-wider text-rose-400">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4" />
                <span>Operating Expenses & Facilities</span>
              </div>
              <span className="font-mono text-white text-sm">{formatAmount(totals.totalExpenses)}</span>
            </div>

            <div className="space-y-1.5 pl-2">
              {(data?.expenses || []).map((node: AccountTreeNode) => (
                <div key={node.id} className="flex items-center justify-between text-xs py-1.5 hover:bg-slate-800/30 px-2 rounded-lg">
                  <span className="text-slate-200 font-medium">{node.code} - {node.name}</span>
                  <span className="font-mono font-bold text-rose-300">{formatAmount(node.displayBalance)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Net Profit Summary Card */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-between text-base font-bold">
            <div className="space-y-0.5">
              <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Net Operating Profit / Loss</div>
              <div className="text-xs text-slate-500 font-normal">Revenue minus Operational Expenses</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-mono text-emerald-400 font-bold">
                {formatAmount(totals.netProfit)}
              </div>
              <div className="text-xs text-emerald-300/80 font-mono">
                {totals.marginPercentage.toFixed(2)}% Net Margin
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
