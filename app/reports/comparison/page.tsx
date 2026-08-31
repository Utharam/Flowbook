'use client';

import React, { useState, useEffect } from 'react';
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
  Coins
} from 'lucide-react';

export default function MultiCompanyComparisonPage() {
  const { companies, formatAmount } = useCompany();
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'BS' | 'PL' | 'TB' | 'RATIOS'>('BS');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [comparativeData, setComparativeData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const exportCSV = () => {
    if (comparativeData.length === 0) return;
    const headerRow = ['Metric / Head', ...comparativeData.map(d => `${d.company.legal_name} (${d.company.base_currency})`)];
    
    const rows = [
      [`Flowbook by Utharam - Multi-Company Comparative Statement`],
      [`Generated as of: ${endDate || new Date().toISOString().substring(0, 10)}`],
      [],
      headerRow
    ];

    if (activeTab === 'BS') {
      rows.push(['Total Assets', ...comparativeData.map(d => d.balance_sheet.totalAssets.toFixed(2))]);
      rows.push(['Total Liabilities', ...comparativeData.map(d => d.balance_sheet.totalLiabilities.toFixed(2))]);
      rows.push(['Base Equity', ...comparativeData.map(d => d.balance_sheet.totalEquityBase.toFixed(2))]);
      rows.push(['Current Period Retained Earnings', ...comparativeData.map(d => d.balance_sheet.currentPeriodEarnings.toFixed(2))]);
      rows.push(['Total Liabilities & Equity', ...comparativeData.map(d => d.balance_sheet.totalLiabilitiesAndEquity.toFixed(2))]);
    } else if (activeTab === 'PL') {
      rows.push(['Operating Revenue', ...comparativeData.map(d => d.income_statement.totalRevenue.toFixed(2))]);
      rows.push(['Operating Expenses', ...comparativeData.map(d => d.income_statement.totalExpenses.toFixed(2))]);
      rows.push(['Net Operating Profit', ...comparativeData.map(d => d.income_statement.netProfit.toFixed(2))]);
      rows.push(['Net Margin (%)', ...comparativeData.map(d => `${d.income_statement.marginPercentage.toFixed(1)}%`)]);
    } else {
      rows.push(['Total Debits', ...comparativeData.map(d => d.trial_balance.totalDebits.toFixed(2))]);
      rows.push(['Total Credits', ...comparativeData.map(d => d.trial_balance.totalCredits.toFixed(2))]);
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
            Simultaneously load and compare the Balance Sheet, Profit & Loss, and Trial Balance across 2 to 5 corporate entities.
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

        {/* View Mode Tabs & Date Filter */}
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

          <div className="flex items-center gap-3">
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
          <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Side-by-Side Comparison: {activeTab === 'BS' ? 'Balance Sheet' : activeTab === 'PL' ? 'Profit & Loss' : activeTab === 'TB' ? 'Trial Balance' : 'Key Performance Indicators'}
          </div>
          <div className="text-xs text-slate-400">
            {comparativeData.length} Entities Loaded
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-300 border-b border-slate-800 text-[11px] uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4 w-72">Financial Metric / Section</th>
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
              {/* TAB 1: BALANCE SHEET COMPARATIVE */}
              {activeTab === 'BS' && (
                <>
                  <tr className="bg-emerald-950/20 font-bold text-emerald-300">
                    <td className="py-3 px-4">TOTAL ASSETS</td>
                    {comparativeData.map((d) => (
                      <td key={d.company.id} className="py-3 px-4 text-right font-mono text-emerald-400 text-sm">
                        {d.balance_sheet.totalAssets.toLocaleString(undefined, { minimumFractionDigits: d.company.decimal_places })} {d.company.base_currency}
                      </td>
                    ))}
                  </tr>
                  <tr className="bg-sky-950/20 font-bold text-sky-300">
                    <td className="py-3 px-4">TOTAL LIABILITIES</td>
                    {comparativeData.map((d) => (
                      <td key={d.company.id} className="py-3 px-4 text-right font-mono text-sky-400 text-sm">
                        {d.balance_sheet.totalLiabilities.toLocaleString(undefined, { minimumFractionDigits: d.company.decimal_places })} {d.company.base_currency}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 text-slate-300 pl-8">Base Equity Capital</td>
                    {comparativeData.map((d) => (
                      <td key={d.company.id} className="py-2.5 px-4 text-right font-mono text-slate-200">
                        {d.balance_sheet.totalEquityBase.toLocaleString(undefined, { minimumFractionDigits: d.company.decimal_places })}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 text-indigo-300 pl-8">Current Period Earnings (P&L)</td>
                    {comparativeData.map((d) => (
                      <td key={d.company.id} className="py-2.5 px-4 text-right font-mono text-indigo-300 font-bold">
                        {d.balance_sheet.currentPeriodEarnings.toLocaleString(undefined, { minimumFractionDigits: d.company.decimal_places })}
                      </td>
                    ))}
                  </tr>
                  <tr className="bg-indigo-950/20 font-bold text-indigo-300">
                    <td className="py-3 px-4">TOTAL EQUITY & RESERVES</td>
                    {comparativeData.map((d) => (
                      <td key={d.company.id} className="py-3 px-4 text-right font-mono text-indigo-300 text-sm">
                        {d.balance_sheet.totalEquityWithEarnings.toLocaleString(undefined, { minimumFractionDigits: d.company.decimal_places })} {d.company.base_currency}
                      </td>
                    ))}
                  </tr>
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

              {/* TAB 2: PROFIT & LOSS COMPARATIVE */}
              {activeTab === 'PL' && (
                <>
                  <tr className="bg-emerald-950/20 font-bold text-emerald-300">
                    <td className="py-3 px-4">OPERATING REVENUE</td>
                    {comparativeData.map((d) => (
                      <td key={d.company.id} className="py-3 px-4 text-right font-mono text-emerald-400 text-sm">
                        {d.income_statement.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: d.company.decimal_places })} {d.company.base_currency}
                      </td>
                    ))}
                  </tr>
                  <tr className="bg-amber-950/20 font-bold text-amber-300">
                    <td className="py-3 px-4">OPERATING EXPENSES</td>
                    {comparativeData.map((d) => (
                      <td key={d.company.id} className="py-3 px-4 text-right font-mono text-amber-400 text-sm">
                        {d.income_statement.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: d.company.decimal_places })} {d.company.base_currency}
                      </td>
                    ))}
                  </tr>
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
                  <tr>
                    <td className="py-3 px-4 font-bold text-emerald-400">Total Debit Footing</td>
                    {comparativeData.map((d) => (
                      <td key={d.company.id} className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                        {d.trial_balance.totalDebits.toLocaleString(undefined, { minimumFractionDigits: d.company.decimal_places })} {d.company.base_currency}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-bold text-sky-400">Total Credit Footing</td>
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
