'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCompany } from '@/components/context/company-context';
import { 
  BarChart3, 
  Building2, 
  Download, 
  Printer, 
  Calendar, 
  CheckCircle2, 
  PieChart, 
  FileText, 
  TrendingUp, 
  Layers, 
  Columns,
  ChevronDown,
  ChevronRight,
  Folder,
  BookOpen
} from 'lucide-react';

export default function MultiCompanyComparisonPage() {
  const { companies, formatAmount } = useCompany();
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'BS' | 'PL' | 'TB' | 'RATIOS'>('BS');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [comparativeData, setComparativeData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Expandable Heads State
  const [expandedHeads, setExpandedHeads] = useState<Record<string, boolean>>({
    ASSETS: true,
    LIABILITIES: true,
    EQUITY: true,
    REVENUE: true,
    EXPENSES: true,
    TB_ALL: true
  });

  // Initialize selected companies (up to 3 by default)
  useEffect(() => {
    if (companies.length > 0 && selectedCompanyIds.length === 0) {
      setSelectedCompanyIds(companies.slice(0, 3).map(c => c.id));
    }
  }, [companies]);

  const fetchComparativeData = async () => {
    if (selectedCompanyIds.length === 0) return;
    try {
      setIsLoading(true);
      let url = `/api/reports?type=comparative&companyIds=${selectedCompanyIds.join(',')}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;

      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setComparativeData(json.comparativeData || []);
      }
    } catch (err) {
      console.error('Failed to load comparative financials:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchComparativeData();
  }, [selectedCompanyIds, startDate, endDate]);

  const toggleCompanySelection = (id: string) => {
    if (selectedCompanyIds.includes(id)) {
      if (selectedCompanyIds.length <= 1) return; // Keep at least 1
      setSelectedCompanyIds(selectedCompanyIds.filter(c => c !== id));
    } else {
      if (selectedCompanyIds.length >= 5) {
        alert('Maximum 5 companies can be compared simultaneously.');
        return;
      }
      setSelectedCompanyIds([...selectedCompanyIds, id]);
    }
  };

  const toggleHead = (headKey: string) => {
    setExpandedHeads(prev => ({ ...prev, [headKey]: !prev[headKey] }));
  };

  const toggleAllHeads = (expand: boolean) => {
    setExpandedHeads({
      ASSETS: expand,
      LIABILITIES: expand,
      EQUITY: expand,
      REVENUE: expand,
      EXPENSES: expand,
      TB_ALL: expand
    });
  };

  // Helper to collect union of accounts across all compared companies for a category
  const getUnifiedAccountsForCategory = (categoryKey: 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses') => {
    const accountMap = new Map<string, { code: string; name: string; is_group: number }>();

    for (const compData of comparativeData) {
      const accountsList = compData.category_accounts?.[categoryKey] || [];
      for (const acc of accountsList) {
        if (!accountMap.has(acc.code)) {
          accountMap.set(acc.code, { code: acc.code, name: acc.name, is_group: acc.is_group });
        }
      }
    }

    return Array.from(accountMap.values()).sort((a, b) => a.code.localeCompare(b.code));
  };

  const exportCSV = () => {
    if (comparativeData.length === 0) return;
    const headerRow = ['Metric / Account Code & Name', ...comparativeData.map(d => `${d.company.legal_name} (${d.company.base_currency})`)];
    
    const rows = [
      [`Flowbook by Utharam - Multi-Company Comparative Statement`],
      [`Generated as of: ${endDate || new Date().toISOString().substring(0, 10)}`],
      [],
      headerRow
    ];

    if (activeTab === 'BS') {
      rows.push(['TOTAL ASSETS', ...comparativeData.map(d => d.balance_sheet.totalAssets.toFixed(2))]);
      const assetsList = getUnifiedAccountsForCategory('assets');
      for (const a of assetsList) {
        rows.push([
          `  ${a.code} - ${a.name}`,
          ...comparativeData.map(d => {
            const found = (d.category_accounts?.assets || []).find((acc: any) => acc.code === a.code);
            return found ? found.displayBalance.toFixed(2) : '0.00';
          })
        ]);
      }

      rows.push(['TOTAL LIABILITIES', ...comparativeData.map(d => d.balance_sheet.totalLiabilities.toFixed(2))]);
      const liabList = getUnifiedAccountsForCategory('liabilities');
      for (const l of liabList) {
        rows.push([
          `  ${l.code} - ${l.name}`,
          ...comparativeData.map(d => {
            const found = (d.category_accounts?.liabilities || []).find((acc: any) => acc.code === l.code);
            return found ? found.displayBalance.toFixed(2) : '0.00';
          })
        ]);
      }

      rows.push(['TOTAL EQUITY & RESERVES', ...comparativeData.map(d => d.balance_sheet.totalEquityWithEarnings.toFixed(2))]);
      rows.push(['TOTAL LIABILITIES & EQUITY', ...comparativeData.map(d => d.balance_sheet.totalLiabilitiesAndEquity.toFixed(2))]);
    } else if (activeTab === 'PL') {
      rows.push(['TOTAL OPERATING REVENUE', ...comparativeData.map(d => d.income_statement.totalRevenue.toFixed(2))]);
      const revList = getUnifiedAccountsForCategory('revenue');
      for (const r of revList) {
        rows.push([
          `  ${r.code} - ${r.name}`,
          ...comparativeData.map(d => {
            const found = (d.category_accounts?.revenue || []).find((acc: any) => acc.code === r.code);
            return found ? found.displayBalance.toFixed(2) : '0.00';
          })
        ]);
      }

      rows.push(['TOTAL OPERATING EXPENSES', ...comparativeData.map(d => d.income_statement.totalExpenses.toFixed(2))]);
      const expList = getUnifiedAccountsForCategory('expenses');
      for (const e of expList) {
        rows.push([
          `  ${e.code} - ${e.name}`,
          ...comparativeData.map(d => {
            const found = (d.category_accounts?.expenses || []).find((acc: any) => acc.code === e.code);
            return found ? found.displayBalance.toFixed(2) : '0.00';
          })
        ]);
      }

      rows.push(['NET OPERATING PROFIT', ...comparativeData.map(d => d.income_statement.netProfit.toFixed(2))]);
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Multi_Company_Comparative_${new Date().toISOString().substring(0, 10)}.csv`);
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
            <Columns className="w-4 h-4" />
            <span>Group Accounting & Multi-Entity Workspace</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Multi-Company Comparative Financials
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Compare Balance Sheets, Profit & Loss, and Trial Balances side-by-side with expandable account heads.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Comparison</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Matrix</span>
          </button>
        </div>
      </div>

      {/* Entity Selection Pills & Controls */}
      <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-2xl space-y-4 no-print shadow-sm">
        <div>
          <label className="block text-[11px] uppercase font-bold text-slate-400 mb-2">
            Select Entities to Compare ({selectedCompanyIds.length} / 5 Selected)
          </label>
          <div className="flex flex-wrap gap-2">
            {companies.map((c) => {
              const isSelected = selectedCompanyIds.includes(c.id);

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCompanySelection(c.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border flex items-center gap-2 ${
                    isSelected
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700 font-bold shadow-md shadow-emerald-950/40'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{c.legal_name}</span>
                  <span className="text-[10px] font-mono opacity-80 uppercase px-1.5 py-0.5 rounded bg-slate-800">
                    {c.base_currency}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* View Mode Tabs, Expand/Collapse & Date Filter */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-800 text-xs">
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('BS')}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'BS'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <PieChart className="w-3.5 h-3.5" />
              <span>Balance Sheet</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('PL')}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'PL'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Profit & Loss</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('TB')}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'TB'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Trial Balance</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('RATIOS')}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'RATIOS'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>KPI & Ratios</span>
            </button>
          </div>

          <div className="flex items-center gap-4">
            {/* Expand / Collapse Master Buttons */}
            {activeTab !== 'RATIOS' && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleAllHeads(true)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-750 text-[11px] font-semibold"
                >
                  Expand All Heads
                </button>
                <button
                  type="button"
                  onClick={() => toggleAllHeads(false)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 text-[11px]"
                >
                  Collapse All
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 text-slate-300">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>Period As Of:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Comparative Matrix Table Container */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <span>Side-by-Side Comparison: {activeTab === 'BS' ? 'Balance Sheet' : activeTab === 'PL' ? 'Profit & Loss' : activeTab === 'TB' ? 'Trial Balance' : 'Key Performance Indicators'}</span>
            <span className="text-[10px] text-emerald-400 font-normal lowercase">(click arrows to expand/collapse inner ledgers)</span>
          </div>
          <div className="text-xs text-slate-400">
            {comparativeData.length} Entities Loaded
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-300 border-b border-slate-800 text-[11px] uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4 w-80">Financial Head & Account Taxonomy</th>
                {comparativeData.map((d) => (
                  <th key={d.company.id} className="py-3 px-4 text-right">
                    <div className="font-bold text-white text-xs">{d.company.legal_name}</div>
                    <div className="text-[10px] text-emerald-400 font-mono font-normal">
                      Base: {d.company.base_currency} ({d.company.jurisdiction})
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {/* TAB 1: BALANCE SHEET COMPARATIVE WITH EXPANDABLE HEADS */}
              {activeTab === 'BS' && (
                <>
                  {/* 1. ASSETS HEAD */}
                  <tr
                    onClick={() => toggleHead('ASSETS')}
                    className="bg-emerald-950/30 font-bold text-emerald-300 cursor-pointer hover:bg-emerald-950/50 transition-colors select-none"
                  >
                    <td className="py-3 px-4 flex items-center gap-2">
                      {expandedHeads.ASSETS ? <ChevronDown className="w-4 h-4 text-emerald-400" /> : <ChevronRight className="w-4 h-4 text-emerald-400" />}
                      <span className="text-sm tracking-tight uppercase">1. TOTAL ASSETS</span>
                    </td>
                    {comparativeData.map((d) => (
                      <td key={d.company.id} className="py-3 px-4 text-right font-mono text-emerald-400 text-sm">
                        {d.balance_sheet.totalAssets.toLocaleString(undefined, { minimumFractionDigits: d.company.decimal_places })} {d.company.base_currency}
                      </td>
                    ))}
                  </tr>

                  {/* Expanded Asset Accounts */}
                  {expandedHeads.ASSETS && getUnifiedAccountsForCategory('assets').map((acc) => (
                    <tr key={acc.code} className="hover:bg-slate-850/40 text-xs">
                      <td className="py-2 px-4 pl-10 text-slate-300 font-mono">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">{acc.code}</span>
                          <span className="text-slate-200">{acc.name}</span>
                        </div>
                      </td>
                      {comparativeData.map((d) => {
                        const found = (d.category_accounts?.assets || []).find((a: any) => a.code === acc.code);
                        return (
                          <td key={d.company.id} className="py-2 px-4 text-right font-mono">
                            {found && found.displayBalance > 0 ? (
                              <Link
                                href={`/ledger?accountId=${found.id}`}
                                className="text-slate-100 hover:text-emerald-400 hover:underline font-bold"
                                title={`Click to view ${acc.name} ledger for ${d.company.legal_name}`}
                              >
                                {found.displayBalance.toLocaleString(undefined, { minimumFractionDigits: d.company.decimal_places })}
                              </Link>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  {/* 2. LIABILITIES HEAD */}
                  <tr
                    onClick={() => toggleHead('LIABILITIES')}
                    className="bg-sky-950/30 font-bold text-sky-300 cursor-pointer hover:bg-sky-950/50 transition-colors select-none"
                  >
                    <td className="py-3 px-4 flex items-center gap-2">
                      {expandedHeads.LIABILITIES ? <ChevronDown className="w-4 h-4 text-sky-400" /> : <ChevronRight className="w-4 h-4 text-sky-400" />}
                      <span className="text-sm tracking-tight uppercase">2. TOTAL LIABILITIES</span>
                    </td>
                    {comparativeData.map((d) => (
                      <td key={d.company.id} className="py-3 px-4 text-right font-mono text-sky-400 text-sm">
                        {d.balance_sheet.totalLiabilities.toLocaleString(undefined, { minimumFractionDigits: d.company.decimal_places })} {d.company.base_currency}
                      </td>
                    ))}
                  </tr>

                  {/* Expanded Liability Accounts */}
                  {expandedHeads.LIABILITIES && getUnifiedAccountsForCategory('liabilities').map((acc) => (
                    <tr key={acc.code} className="hover:bg-slate-850/40 text-xs">
                      <td className="py-2 px-4 pl-10 text-slate-300 font-mono">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">{acc.code}</span>
                          <span className="text-slate-200">{acc.name}</span>
                        </div>
                      </td>
                      {comparativeData.map((d) => {
                        const found = (d.category_accounts?.liabilities || []).find((a: any) => a.code === acc.code);
                        return (
                          <td key={d.company.id} className="py-2 px-4 text-right font-mono">
                            {found && found.displayBalance > 0 ? (
                              <Link
                                href={`/ledger?accountId=${found.id}`}
                                className="text-slate-100 hover:text-sky-400 hover:underline font-bold"
                                title={`Click to view ${acc.name} ledger for ${d.company.legal_name}`}
                              >
                                {found.displayBalance.toLocaleString(undefined, { minimumFractionDigits: d.company.decimal_places })}
                              </Link>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  {/* 3. EQUITY & RESERVES HEAD */}
                  <tr
                    onClick={() => toggleHead('EQUITY')}
                    className="bg-indigo-950/30 font-bold text-indigo-300 cursor-pointer hover:bg-indigo-950/50 transition-colors select-none"
                  >
                    <td className="py-3 px-4 flex items-center gap-2">
                      {expandedHeads.EQUITY ? <ChevronDown className="w-4 h-4 text-indigo-400" /> : <ChevronRight className="w-4 h-4 text-indigo-400" />}
                      <span className="text-sm tracking-tight uppercase">3. TOTAL EQUITY & RESERVES</span>
                    </td>
                    {comparativeData.map((d) => (
                      <td key={d.company.id} className="py-3 px-4 text-right font-mono text-indigo-300 text-sm">
                        {d.balance_sheet.totalEquityWithEarnings.toLocaleString(undefined, { minimumFractionDigits: d.company.decimal_places })} {d.company.base_currency}
                      </td>
                    ))}
                  </tr>

                  {/* Expanded Equity Accounts */}
                  {expandedHeads.EQUITY && (
                    <>
                      {getUnifiedAccountsForCategory('equity').map((acc) => (
                        <tr key={acc.code} className="hover:bg-slate-850/40 text-xs">
                          <td className="py-2 px-4 pl-10 text-slate-300 font-mono">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400">{acc.code}</span>
                              <span className="text-slate-200">{acc.name}</span>
                            </div>
                          </td>
                          {comparativeData.map((d) => {
                            const found = (d.category_accounts?.equity || []).find((a: any) => a.code === acc.code);
                            return (
                              <td key={d.company.id} className="py-2 px-4 text-right font-mono">
                                {found && found.displayBalance > 0 ? (
                                  <Link
                                    href={`/ledger?accountId=${found.id}`}
                                    className="text-slate-100 hover:text-indigo-400 hover:underline font-bold"
                                  >
                                    {found.displayBalance.toLocaleString(undefined, { minimumFractionDigits: d.company.decimal_places })}
                                  </Link>
                                ) : (
                                  <span className="text-slate-600">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {/* Current Period Earnings Row */}
                      <tr className="bg-indigo-950/20 text-xs font-semibold text-indigo-200">
                        <td className="py-2 px-4 pl-10">
                          <span>Current Period Net Earnings (From P&L)</span>
                        </td>
                        {comparativeData.map((d) => (
                          <td key={d.company.id} className="py-2 px-4 text-right font-mono font-bold text-indigo-300">
                            {d.balance_sheet.currentPeriodEarnings.toLocaleString(undefined, { minimumFractionDigits: d.company.decimal_places })}
                          </td>
                        ))}
                      </tr>
                    </>
                  )}

                  {/* GRAND TOTAL */}
                  <tr className="bg-slate-900 font-bold border-t-2 border-slate-700 text-slate-100">
                    <td className="py-3 px-4 uppercase">TOTAL LIABILITIES & EQUITY</td>
                    {comparativeData.map((d) => (
                      <td key={d.company.id} className="py-3 px-4 text-right font-mono text-white text-sm">
                        {d.balance_sheet.totalLiabilitiesAndEquity.toLocaleString(undefined, { minimumFractionDigits: d.company.decimal_places })} {d.company.base_currency}
                      </td>
                    ))}
                  </tr>
                </>
              )}

              {/* TAB 2: PROFIT & LOSS COMPARATIVE WITH EXPANDABLE HEADS */}
              {activeTab === 'PL' && (
                <>
                  {/* 1. OPERATING REVENUE HEAD */}
                  <tr
                    onClick={() => toggleHead('REVENUE')}
                    className="bg-emerald-950/30 font-bold text-emerald-300 cursor-pointer hover:bg-emerald-950/50 transition-colors select-none"
                  >
                    <td className="py-3 px-4 flex items-center gap-2">
                      {expandedHeads.REVENUE ? <ChevronDown className="w-4 h-4 text-emerald-400" /> : <ChevronRight className="w-4 h-4 text-emerald-400" />}
                      <span className="text-sm tracking-tight uppercase">1. OPERATING REVENUE</span>
                    </td>
                    {comparativeData.map((d) => (
                      <td key={d.company.id} className="py-3 px-4 text-right font-mono text-emerald-400 text-sm">
                        {d.income_statement.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: d.company.decimal_places })} {d.company.base_currency}
                      </td>
                    ))}
                  </tr>

                  {/* Expanded Revenue Accounts */}
                  {expandedHeads.REVENUE && getUnifiedAccountsForCategory('revenue').map((acc) => (
                    <tr key={acc.code} className="hover:bg-slate-850/40 text-xs">
                      <td className="py-2 px-4 pl-10 text-slate-300 font-mono">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">{acc.code}</span>
                          <span className="text-slate-200">{acc.name}</span>
                        </div>
                      </td>
                      {comparativeData.map((d) => {
                        const found = (d.category_accounts?.revenue || []).find((a: any) => a.code === acc.code);
                        return (
                          <td key={d.company.id} className="py-2 px-4 text-right font-mono">
                            {found && found.displayBalance > 0 ? (
                              <Link
                                href={`/ledger?accountId=${found.id}`}
                                className="text-slate-100 hover:text-emerald-400 hover:underline font-bold"
                              >
                                {found.displayBalance.toLocaleString(undefined, { minimumFractionDigits: d.company.decimal_places })}
                              </Link>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  {/* 2. OPERATING EXPENSES HEAD */}
                  <tr
                    onClick={() => toggleHead('EXPENSES')}
                    className="bg-amber-950/30 font-bold text-amber-300 cursor-pointer hover:bg-amber-950/50 transition-colors select-none"
                  >
                    <td className="py-3 px-4 flex items-center gap-2">
                      {expandedHeads.EXPENSES ? <ChevronDown className="w-4 h-4 text-amber-400" /> : <ChevronRight className="w-4 h-4 text-amber-400" />}
                      <span className="text-sm tracking-tight uppercase">2. OPERATING EXPENSES</span>
                    </td>
                    {comparativeData.map((d) => (
                      <td key={d.company.id} className="py-3 px-4 text-right font-mono text-amber-400 text-sm">
                        {d.income_statement.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: d.company.decimal_places })} {d.company.base_currency}
                      </td>
                    ))}
                  </tr>

                  {/* Expanded Expense Accounts */}
                  {expandedHeads.EXPENSES && getUnifiedAccountsForCategory('expenses').map((acc) => (
                    <tr key={acc.code} className="hover:bg-slate-850/40 text-xs">
                      <td className="py-2 px-4 pl-10 text-slate-300 font-mono">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">{acc.code}</span>
                          <span className="text-slate-200">{acc.name}</span>
                        </div>
                      </td>
                      {comparativeData.map((d) => {
                        const found = (d.category_accounts?.expenses || []).find((a: any) => a.code === acc.code);
                        return (
                          <td key={d.company.id} className="py-2 px-4 text-right font-mono">
                            {found && found.displayBalance > 0 ? (
                              <Link
                                href={`/ledger?accountId=${found.id}`}
                                className="text-slate-100 hover:text-amber-400 hover:underline font-bold"
                              >
                                {found.displayBalance.toLocaleString(undefined, { minimumFractionDigits: d.company.decimal_places })}
                              </Link>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  {/* NET OPERATING PROFIT FOOTER */}
                  <tr className="bg-slate-900 font-bold border-t-2 border-slate-700">
                    <td className="py-3.5 px-4 text-slate-100 uppercase">NET OPERATING PROFIT / (LOSS)</td>
                    {comparativeData.map((d) => (
                      <td key={d.company.id} className={`py-3.5 px-4 text-right font-mono text-base font-bold ${
                        d.income_statement.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {d.income_statement.netProfit.toLocaleString(undefined, { minimumFractionDigits: d.company.decimal_places })} {d.company.base_currency}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 text-slate-400 pl-8">Net Profit Margin (%)</td>
                    {comparativeData.map((d) => (
                      <td key={d.company.id} className="py-2.5 px-4 text-right font-mono font-bold text-slate-200">
                        {d.income_statement.marginPercentage.toFixed(1)}%
                      </td>
                    ))}
                  </tr>
                </>
              )}

              {/* TAB 3: TRIAL BALANCE COMPARATIVE */}
              {activeTab === 'TB' && (
                <>
                  <tr className="bg-emerald-950/20 font-bold text-emerald-300">
                    <td className="py-3 px-4">Total Debit Footing</td>
                    {comparativeData.map((d) => (
                      <td key={d.company.id} className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                        {d.trial_balance.totalDebits.toLocaleString(undefined, { minimumFractionDigits: d.company.decimal_places })} {d.company.base_currency}
                      </td>
                    ))}
                  </tr>
                  <tr className="bg-sky-950/20 font-bold text-sky-300">
                    <td className="py-3 px-4">Total Credit Footing</td>
                    {comparativeData.map((d) => (
                      <td key={d.company.id} className="py-3 px-4 text-right font-mono font-bold text-sky-400">
                        {d.trial_balance.totalCredits.toLocaleString(undefined, { minimumFractionDigits: d.company.decimal_places })} {d.company.base_currency}
                      </td>
                    ))}
                  </tr>
                  <tr className="bg-slate-900 font-bold border-t border-slate-800">
                    <td className="py-3 px-4 text-slate-300">Active Posting Accounts</td>
                    {comparativeData.map((d) => (
                      <td key={d.company.id} className="py-3 px-4 text-right font-mono text-slate-200">
                        {d.trial_balance.leafAccountsCount} Accounts
                      </td>
                    ))}
                  </tr>
                </>
              )}

              {/* TAB 4: KEY RATIOS */}
              {activeTab === 'RATIOS' && (
                <>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-slate-200">Profitability: Net Margin</td>
                    {comparativeData.map((d) => (
                      <td key={d.company.id} className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                        {d.income_statement.marginPercentage.toFixed(1)}%
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-slate-200">Solvency: Equity Ratio</td>
                    {comparativeData.map((d) => {
                      const ratio = d.balance_sheet.totalAssets > 0 
                        ? (d.balance_sheet.totalEquityWithEarnings / d.balance_sheet.totalAssets) * 100 
                        : 0;
                      return (
                        <td key={d.company.id} className="py-3 px-4 text-right font-mono font-bold text-sky-400">
                          {ratio.toFixed(1)}%
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-slate-200">Leverage: Debt-to-Equity</td>
                    {comparativeData.map((d) => {
                      const debtToEquity = d.balance_sheet.totalEquityWithEarnings > 0 
                        ? (d.balance_sheet.totalLiabilities / d.balance_sheet.totalEquityWithEarnings)
                        : 0;
                      return (
                        <td key={d.company.id} className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                          {debtToEquity.toFixed(2)}x
                        </td>
                      );
                    })}
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
