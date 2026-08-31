'use client';

import React, { useState, useEffect } from 'react';
import { useCompany } from '@/components/context/company-context';
import { 
  FileSpreadsheet, 
  Tag, 
  Search, 
  ArrowUpRight, 
  Building, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2 
} from 'lucide-react';
import { AccountTreeNode } from '@/lib/engine/coa-tree';

export default function TagMatrixPage() {
  const { activeCompany, activeCompanyId, formatAmount } = useCompany();
  const [data, setData] = useState<any>(null);
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [tagDetails, setTagDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTagMatrix = async () => {
    if (!activeCompanyId) return;
    try {
      setIsLoading(true);
      const res = await fetch(`/api/reports?companyId=${activeCompanyId}&type=tag-matrix`);
      const json = await res.json();
      if (json.success) {
        setData(json);
        if (!selectedTag && json.tags?.length > 0) {
          setSelectedTag(json.tags[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load tag matrix:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTagDetailTree = async (tag: string) => {
    if (!activeCompanyId || !tag) return;
    try {
      const [tbRes, bsRes, isRes] = await Promise.all([
        fetch(`/api/reports?companyId=${activeCompanyId}&type=trial-balance&tag=${encodeURIComponent(tag)}`),
        fetch(`/api/reports?companyId=${activeCompanyId}&type=balance-sheet&tag=${encodeURIComponent(tag)}`),
        fetch(`/api/reports?companyId=${activeCompanyId}&type=income-statement&tag=${encodeURIComponent(tag)}`)
      ]);
      const [tb, bs, isData] = await Promise.all([tbRes.json(), bsRes.json(), isRes.json()]);

      setTagDetails({
        trialBalance: tb,
        balanceSheet: bs,
        incomeStatement: isData
      });
    } catch (err) {
      console.error('Failed to load tag details:', err);
    }
  };

  useEffect(() => {
    fetchTagMatrix();
  }, [activeCompanyId]);

  useEffect(() => {
    if (selectedTag) {
      fetchTagDetailTree(selectedTag);
    }
  }, [selectedTag, activeCompanyId]);

  const summaries = data?.tagSummaries || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
          <FileSpreadsheet className="w-4 h-4" />
          <span>Multidimensional Financial Analytics</span>
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Tag-Level Financial Statements (#)
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Generate dedicated project/property mini-financials, balance sheets, and P&L statements sliced by multidimensional #tags.
        </p>
      </div>

      {/* Tag Summary Matrix Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaries.map((s: any) => {
          const isSelected = selectedTag === s.tag;

          return (
            <button
              key={s.tag}
              type="button"
              onClick={() => setSelectedTag(s.tag)}
              className={`p-5 rounded-2xl border text-left transition-all ${
                isSelected
                  ? 'bg-[#111c33] border-emerald-500/80 shadow-lg shadow-emerald-500/10'
                  : 'bg-[#0f172a] border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono font-bold text-sm text-emerald-400">
                  {s.tag}
                </span>
                {isSelected && <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded">Active</span>}
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Revenue:</span>
                  <span className="text-slate-200 font-mono font-medium">{formatAmount(s.totalRevenue)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Expenses:</span>
                  <span className="text-slate-200 font-mono font-medium">{formatAmount(s.totalExpenses)}</span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-slate-800">
                  <span className="text-slate-300">Net Profit:</span>
                  <span className={`font-mono ${s.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatAmount(s.netProfit)}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Tag Dedicated Mini-Financial Document */}
      {selectedTag && tagDetails && (
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-8 shadow-sm space-y-8">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-white">Mini-Financial Statements for</span>
                <span className="text-lg font-bold font-mono text-emerald-400 px-2.5 py-0.5 rounded-lg bg-emerald-950/80 border border-emerald-800/60">
                  {selectedTag}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Isolated double-entry slice across Balance Sheet and P&L ledger lines tagged with {selectedTag}.
              </p>
            </div>

            <div className="text-right font-mono text-xs">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Net Segment Contribution</span>
              <span className="text-emerald-400 font-bold text-base">
                {formatAmount(tagDetails.incomeStatement?.totals?.netProfit || 0)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Tag P&L */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 pb-2 border-b border-slate-800">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>Segment Profit & Loss ({selectedTag})</span>
              </h3>

              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-emerald-400 uppercase">Revenue Lines</div>
                {(tagDetails.incomeStatement?.revenue || []).map((n: AccountTreeNode) => (
                  <div key={n.id} className="flex justify-between text-xs py-1 px-2 rounded bg-slate-900">
                    <span className="text-slate-300">{n.code} - {n.name}</span>
                    <span className="font-mono font-bold text-emerald-400">{formatAmount(n.displayBalance)}</span>
                  </div>
                ))}

                <div className="text-[11px] font-semibold text-rose-400 uppercase pt-2">Expense Lines</div>
                {(tagDetails.incomeStatement?.expenses || []).map((n: AccountTreeNode) => (
                  <div key={n.id} className="flex justify-between text-xs py-1 px-2 rounded bg-slate-900">
                    <span className="text-slate-300">{n.code} - {n.name}</span>
                    <span className="font-mono font-bold text-rose-300">{formatAmount(n.displayBalance)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tag Balance Sheet / Asset Allocation */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 pb-2 border-b border-slate-800">
                <Building className="w-4 h-4 text-sky-400" />
                <span>Segment Balance Sheet Allocations ({selectedTag})</span>
              </h3>

              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-sky-400 uppercase">Allocated Assets</div>
                {(tagDetails.balanceSheet?.assets || []).map((n: AccountTreeNode) => (
                  <div key={n.id} className="flex justify-between text-xs py-1 px-2 rounded bg-slate-900">
                    <span className="text-slate-300">{n.code} - {n.name}</span>
                    <span className="font-mono font-bold text-slate-100">{formatAmount(n.displayBalance)}</span>
                  </div>
                ))}

                <div className="text-[11px] font-semibold text-amber-400 uppercase pt-2">Allocated Liabilities & Debt</div>
                {(tagDetails.balanceSheet?.liabilities || []).map((n: AccountTreeNode) => (
                  <div key={n.id} className="flex justify-between text-xs py-1 px-2 rounded bg-slate-900">
                    <span className="text-slate-300">{n.code} - {n.name}</span>
                    <span className="font-mono font-bold text-slate-100">{formatAmount(n.displayBalance)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
