'use client';

import React, { useState, useEffect } from 'react';
import { useCompany } from '@/components/context/company-context';
import { 
  SlidersHorizontal, 
  Download, 
  Printer, 
  Filter, 
  Layers, 
  Tag, 
  Calendar, 
  CheckSquare, 
  Square, 
  Sparkles, 
  ChevronRight 
} from 'lucide-react';
import { AccountTreeNode } from '@/lib/engine/coa-tree';

export default function ReportDesignerPage() {
  const { activeCompany, activeCompanyId, formatAmount } = useCompany();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']);
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [groupBy, setGroupBy] = useState<'type' | 'hierarchy' | 'none'>('type');
  const [showZeroBalances, setShowZeroBalances] = useState<boolean>(false);
  const [reportRows, setReportRows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchReportData = async () => {
    if (!activeCompanyId) return;
    try {
      setIsLoading(true);
      let url = `/api/reports?companyId=${activeCompanyId}&type=trial-balance`;
      if (selectedTag) url += `&tag=${encodeURIComponent(selectedTag)}`;

      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setAccounts(json.flattened || []);
      }
    } catch (err) {
      console.error('Failed to load designer data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [activeCompanyId, selectedTag]);

  // Filter & group report rows dynamically
  useEffect(() => {
    let filtered = accounts.filter(a => selectedTypes.includes(a.type));
    if (!showZeroBalances) {
      filtered = filtered.filter(a => Math.abs(a.displayBalance) > 0.001 || a.is_group === 1);
    }
    setReportRows(filtered);
  }, [accounts, selectedTypes, showZeroBalances, groupBy]);

  const toggleType = (t: string) => {
    if (selectedTypes.includes(t)) {
      if (selectedTypes.length > 1) {
        setSelectedTypes(selectedTypes.filter(x => x !== t));
      }
    } else {
      setSelectedTypes([...selectedTypes, t]);
    }
  };

  const exportCustomCSV = () => {
    const rows = [
      ['Account Code', 'Account Name', 'Category Type', 'Materialized Path', 'Debit Leg', 'Credit Leg', 'Calculated Balance'],
      ...reportRows.map(a => [
        a.code,
        a.name,
        a.type,
        a.path,
        a.debitTotal.toFixed(activeCompany?.decimal_places || 2),
        a.creditTotal.toFixed(activeCompany?.decimal_places || 2),
        a.displayBalance.toFixed(activeCompany?.decimal_places || 2)
      ])
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Custom_Financial_Slice_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
            <SlidersHorizontal className="w-4 h-4" />
            <span>Interactive Financial Studio</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Custom Report Designer & Pivot Matrix
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Slice and configure financial dimensions, account categories, and tag filters into tailored reports.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={exportCustomCSV}
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
            <span>Print Layout</span>
          </button>
        </div>
      </div>

      {/* Interactive Controls Bar */}
      <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-2xl space-y-4 no-print shadow-sm">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
          <Filter className="w-4 h-4 text-emerald-400" />
          <span>Dimension & Filter Studio</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          {/* 1. Account Types Filter */}
          <div className="space-y-2">
            <span className="block font-semibold text-slate-400 uppercase text-[10px]">Filter Categories:</span>
            <div className="flex flex-wrap gap-1.5">
              {['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].map((t) => {
                const active = selectedTypes.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleType(t)}
                    className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-semibold border transition-all ${
                      active
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800/80'
                        : 'bg-slate-900 text-slate-500 border-slate-800'
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Tag Dimension */}
          <div className="space-y-2">
            <span className="block font-semibold text-slate-400 uppercase text-[10px]">Slice by Dimensional #Tag:</span>
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl">
              <Tag className="w-3.5 h-3.5 text-emerald-400" />
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none cursor-pointer w-full"
              >
                <option value="">All Transactions (Unfiltered)</option>
                <option value="#1206">#1206 (Commercial Unit)</option>
                <option value="#Advisory">#Advisory</option>
                <option value="#Capital">#Capital</option>
                <option value="#HQ-Rent">#HQ-Rent</option>
                <option value="#SaaS">#SaaS</option>
              </select>
            </div>
          </div>

          {/* 3. Zero Balances Switch */}
          <div className="space-y-2 flex flex-col justify-end">
            <label className="flex items-center gap-2 cursor-pointer bg-slate-900 border border-slate-800 p-2 rounded-xl">
              <input
                type="checkbox"
                checked={showZeroBalances}
                onChange={(e) => setShowZeroBalances(e.target.checked)}
                className="rounded text-emerald-500 focus:ring-emerald-400"
              />
              <span className="text-xs font-semibold text-slate-300">Include Zero-Balance Accounts</span>
            </label>
          </div>
        </div>
      </div>

      {/* Generated Report Pivot Table */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="text-center pb-4 border-b border-slate-800 space-y-1">
          <div className="text-xs uppercase tracking-widest text-emerald-400 font-bold">Flowbook by Utharam</div>
          <h2 className="text-lg font-bold text-white">{activeCompany?.legal_name}</h2>
          <div className="text-xs text-slate-400">
            Custom Pivot Matrix | Dimension Slice: {selectedTag || 'Global Entity'} | Base Currency: {activeCompany?.base_currency}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Account Code & Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Materialized Hierarchy</th>
                <th className="py-3 px-4 text-right">Debit Leg</th>
                <th className="py-3 px-4 text-right">Credit Leg</th>
                <th className="py-3 px-4 text-right">Net Display Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {reportRows.map((row) => {
                const isGroup = row.is_group === 1;

                return (
                  <tr
                    key={row.id}
                    className={`hover:bg-slate-850/40 transition-colors ${
                      isGroup ? 'bg-slate-900/40 font-bold' : ''
                    }`}
                  >
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-300">{row.code}</span>
                        <span className={isGroup ? 'text-white' : 'text-slate-200'}>{row.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[10px] text-slate-400">
                      {row.type}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">
                      {row.path}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-emerald-400">
                      {row.debitTotal > 0 ? formatAmount(row.debitTotal) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-sky-400">
                      {row.creditTotal > 0 ? formatAmount(row.creditTotal) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-100">
                      {formatAmount(row.displayBalance)}
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
