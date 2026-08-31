'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCompany } from '@/components/context/company-context';
import { 
  BookOpen, 
  Search, 
  Calendar, 
  Download, 
  Printer, 
  Tag, 
  Plus, 
  Filter, 
  TrendingUp, 
  TrendingDown, 
  Building, 
  CheckCircle2, 
  RotateCcw, 
  FileText,
  ChevronDown
} from 'lucide-react';
import Link from 'next/link';

function LedgerViewerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialAccountId = searchParams.get('accountId') || '';

  const { activeCompany, activeCompanyId, formatAmount } = useCompany();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(initialAccountId);
  const [accountSearch, setAccountSearch] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');

  const [ledgerData, setLedgerData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 1. Fetch posting accounts for selector
  useEffect(() => {
    if (!activeCompanyId) return;
    const loadAccounts = async () => {
      try {
        const res = await fetch(`/api/accounts?companyId=${activeCompanyId}`);
        const data = await res.json();
        if (data.success) {
          const postingAccounts = data.accounts.filter((a: any) => a.is_group === 0);
          setAccounts(postingAccounts);
          if (!selectedAccountId && postingAccounts.length > 0) {
            setSelectedAccountId(postingAccounts[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch accounts list:', err);
      }
    };
    loadAccounts();
  }, [activeCompanyId]);

  // Update selected account if query param changes
  useEffect(() => {
    if (initialAccountId) {
      setSelectedAccountId(initialAccountId);
    }
  }, [initialAccountId]);

  // 2. Fetch ledger transactions & running balances
  const fetchLedger = async () => {
    if (!activeCompanyId || !selectedAccountId) return;
    try {
      setIsLoading(true);
      let url = `/api/ledger?companyId=${activeCompanyId}&accountId=${selectedAccountId}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;
      if (selectedTag) url += `&tag=${encodeURIComponent(selectedTag)}`;

      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setLedgerData(json);
      }
    } catch (err) {
      console.error('Failed to load ledger data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, [activeCompanyId, selectedAccountId, startDate, endDate, selectedTag]);

  // Preset Date Range Helpers
  const applyPreset = (preset: 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_FY' | 'ALL_TIME') => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    if (preset === 'ALL_TIME') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'THIS_MONTH') {
      const start = new Date(currentYear, currentMonth - 1, 1).toISOString().substring(0, 10);
      const end = new Date(currentYear, currentMonth, 0).toISOString().substring(0, 10);
      setStartDate(start);
      setEndDate(end);
    } else if (preset === 'LAST_MONTH') {
      const start = new Date(currentYear, currentMonth - 2, 1).toISOString().substring(0, 10);
      const end = new Date(currentYear, currentMonth - 1, 0).toISOString().substring(0, 10);
      setStartDate(start);
      setEndDate(end);
    } else if (preset === 'THIS_FY') {
      const fyMonth = activeCompany?.financial_year_start_month || 4;
      let fyStartYear = currentYear;
      if (currentMonth < fyMonth) {
        fyStartYear = currentYear - 1;
      }
      const start = `${fyStartYear}-${String(fyMonth).padStart(2, '0')}-01`;
      setStartDate(start);
      setEndDate('');
    }
  };

  const exportCSV = () => {
    if (!ledgerData) return;
    const acc = ledgerData.account;
    const sum = ledgerData.summary;

    const rows = [
      [`Flowbook by Utharam - General Ledger Statement`],
      [`Entity: ${activeCompany?.legal_name}`],
      [`Account: ${acc.code} - ${acc.name} (${acc.type})`],
      [`Period: ${startDate || 'Inception'} to ${endDate || 'Present'}`],
      [`Base Currency: ${activeCompany?.base_currency}`],
      [],
      ['Date', 'Voucher #', 'Particulars / Memo', 'Reference', 'Tags', 'Debit (Dr)', 'Credit (Cr)', 'Running Balance', 'Dr/Cr'],
      ['', 'OPENING', 'Opening Balance Forward', '', '', '', '', Math.abs(sum.openingDisplayBalance).toFixed(activeCompany?.decimal_places || 2), sum.openingBalanceType],
      ...ledgerData.transactions.map((tx: any) => [
        tx.entry_date,
        tx.entry_number,
        `"${(tx.particulars || '').replace(/"/g, '""')}"`,
        tx.reference || '',
        `"${(tx.tags || []).join(' ')}"`,
        tx.debit > 0 ? tx.debit.toFixed(activeCompany?.decimal_places || 2) : '',
        tx.credit > 0 ? tx.credit.toFixed(activeCompany?.decimal_places || 2) : '',
        Math.abs(tx.running_display_balance).toFixed(activeCompany?.decimal_places || 2),
        tx.running_balance_type
      ]),
      ['', 'CLOSING', 'Closing Balance', '', '', sum.periodDebitTotal.toFixed(activeCompany?.decimal_places || 2), sum.periodCreditTotal.toFixed(activeCompany?.decimal_places || 2), Math.abs(sum.closingDisplayBalance).toFixed(activeCompany?.decimal_places || 2), sum.closingBalanceType]
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Ledger_${acc.code}_${acc.name.replace(/\s+/g, '_')}_${new Date().toISOString().substring(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredAccountOptions = accounts.filter(a => {
    if (!accountSearch) return true;
    const term = accountSearch.toLowerCase();
    return a.code.toLowerCase().includes(term) || a.name.toLowerCase().includes(term) || a.type.toLowerCase().includes(term);
  });

  const currentAccount = accounts.find(a => a.id === selectedAccountId) || ledgerData?.account || null;
  const summary = ledgerData?.summary || {
    openingDisplayBalance: 0,
    openingBalanceType: '-',
    periodDebitTotal: 0,
    periodCreditTotal: 0,
    periodNetMovement: 0,
    closingDisplayBalance: 0,
    closingBalanceType: '-'
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
            <BookOpen className="w-4 h-4" />
            <span>Account Statement & General Ledger</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Account Ledger Viewer
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Examine transaction history, chronological postings, and running balances for any ledger account.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/vouchers/new"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-700/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Voucher</span>
          </Link>
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
            <span>Print Ledger</span>
          </button>
        </div>
      </div>

      {/* Account Selector & Filters Bar */}
      <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-2xl space-y-4 no-print shadow-sm">
        {/* Row 1: Searchable Account Selector */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="md:col-span-6 relative">
            <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1.5">
              Select Ledger Account
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search account code or name (e.g. Rent, Bank, 5200)..."
                value={accountSearch}
                onChange={(e) => {
                  setAccountSearch(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <ChevronDown className="w-4 h-4" />
              </button>

              {/* Autocomplete Dropdown */}
              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900 border border-slate-750 rounded-xl max-h-64 overflow-y-auto shadow-2xl z-50 divide-y divide-slate-800/80">
                  {filteredAccountOptions.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => {
                        setSelectedAccountId(acc.id);
                        setAccountSearch(`${acc.code} - ${acc.name}`);
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-slate-800/90 flex items-center justify-between transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-emerald-400">{acc.code}</span>
                        <span className="text-slate-200 group-hover:text-white font-medium">{acc.name}</span>
                      </div>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                        {acc.type}
                      </span>
                    </button>
                  ))}
                  {filteredAccountOptions.length === 0 && (
                    <div className="p-4 text-center text-xs text-slate-500">No matching accounts found</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Quick-select Account Shortcut Pills */}
          <div className="md:col-span-6">
            <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1.5">
              Quick Switch Accounts
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'acc_5200', label: '5200 Office Rent' },
                { id: 'acc_1110', label: '1110 Operating Bank' },
                { id: 'acc_4100', label: '4100 SaaS Revenue' },
                { id: 'acc_1130', label: '1130 Accounts Receivable' },
                { id: 'acc_1510', label: '1510 Property #1206' },
                { id: 'acc_4900', label: '4900 FX Gain/Loss' }
              ].map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedAccountId(item.id);
                    setAccountSearch('');
                    setIsDropdownOpen(false);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all border ${
                    selectedAccountId === item.id
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700 font-bold shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2: Date Filters & Preset Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-800/80 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-slate-300">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div className="flex items-center gap-2 text-slate-300">
              <span>To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            {/* Tag Filter */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-3 py-1 rounded-lg">
              <Tag className="w-3.5 h-3.5 text-emerald-400" />
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
              >
                <option value="">All Tags (#)</option>
                <option value="#1206">#1206 (Commercial Unit)</option>
                <option value="#Advisory">#Advisory</option>
                <option value="#Capital">#Capital</option>
                <option value="#HQ-Rent">#HQ-Rent</option>
                <option value="#SaaS">#SaaS</option>
              </select>
            </div>
          </div>

          {/* Quick Period Presets */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => applyPreset('ALL_TIME')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium border ${!startDate && !endDate ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-slate-900 text-slate-400 border-slate-800'}`}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={() => applyPreset('THIS_MONTH')}
              className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-900 text-slate-400 border border-slate-800 hover:text-white"
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => applyPreset('LAST_MONTH')}
              className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-900 text-slate-400 border border-slate-800 hover:text-white"
            >
              Last Month
            </button>
            <button
              type="button"
              onClick={() => applyPreset('THIS_FY')}
              className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-900 text-slate-400 border border-slate-800 hover:text-white"
            >
              This FY
            </button>
          </div>
        </div>
      </div>

      {/* Account Overview Summary Card */}
      {currentAccount && (
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-sm font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60">
                  {currentAccount.code}
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
                  {currentAccount.type}
                </span>
                <span className="text-xs text-slate-400">
                  Path: <strong className="text-slate-300 font-mono">{currentAccount.path}</strong>
                </span>
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                {currentAccount.name}
              </h2>
            </div>

            {/* Closing Balance Pill */}
            <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Period Closing Balance
              </span>
              <div className="flex items-center justify-end gap-2 mt-0.5">
                <span className="text-xl font-bold font-mono text-white">
                  {formatAmount(Math.abs(summary.closingDisplayBalance))}
                </span>
                <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                  summary.closingBalanceType === 'Dr' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-sky-950 text-sky-400 border border-sky-800'
                }`}>
                  {summary.closingBalanceType}
                </span>
              </div>
            </div>
          </div>

          {/* Account Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Opening Balance</span>
              <div className="font-mono font-bold text-slate-200 text-sm mt-1 flex items-center justify-between">
                <span>{formatAmount(Math.abs(summary.openingDisplayBalance))}</span>
                <span className="text-[10px] text-slate-500 font-normal">{summary.openingBalanceType}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Period Debits (Dr)</span>
              <div className="font-mono font-bold text-emerald-400 text-sm mt-1">
                {formatAmount(summary.periodDebitTotal)}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Period Credits (Cr)</span>
              <div className="font-mono font-bold text-sky-400 text-sm mt-1">
                {formatAmount(summary.periodCreditTotal)}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Net Movement</span>
              <div className="font-mono font-bold text-white text-sm mt-1">
                {formatAmount(Math.abs(summary.periodNetMovement))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Transaction Grid Card */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Chronological Postings & Running Balance</h3>
          <span className="text-xs text-slate-400">
            {ledgerData?.transactions?.length || 0} transactions in selected timeframe
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Voucher No</th>
                <th className="py-3 px-4">Particulars / Memo</th>
                <th className="py-3 px-4">Tags (#)</th>
                <th className="py-3 px-4 text-right text-emerald-400">Debit (Dr)</th>
                <th className="py-3 px-4 text-right text-sky-400">Credit (Cr)</th>
                <th className="py-3 px-4 text-right">Cumulative Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {/* Opening Balance Row */}
              <tr className="bg-slate-900/60 font-semibold italic text-slate-300">
                <td className="py-2.5 px-4 font-mono text-slate-400">{startDate || '—'}</td>
                <td className="py-2.5 px-4 font-mono text-slate-500">OPENING</td>
                <td className="py-2.5 px-4" colSpan={2}>
                  <span>Opening Balance Forward</span>
                </td>
                <td className="py-2.5 px-4 text-right font-mono">—</td>
                <td className="py-2.5 px-4 text-right font-mono">—</td>
                <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-200">
                  {formatAmount(Math.abs(summary.openingDisplayBalance))} {summary.openingBalanceType}
                </td>
              </tr>

              {/* Transactions */}
              {(ledgerData?.transactions || []).map((tx: any) => (
                <tr key={tx.line_id} className="hover:bg-slate-850/50 transition-colors">
                  <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                    {tx.entry_date}
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-slate-200 whitespace-nowrap">
                    <Link href={`/vouchers`} className="hover:text-emerald-400 underline decoration-dotted">
                      {tx.entry_number}
                    </Link>
                    {tx.reference && (
                      <div className="text-[10px] text-slate-500 font-mono font-normal">
                        Ref: {tx.reference}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 max-w-sm">
                    <div className="text-slate-100 font-medium">{tx.particulars}</div>
                    {tx.currency !== activeCompany?.base_currency && (
                      <div className="text-[10px] text-sky-400 font-mono">
                        Foreign: {Math.abs(tx.foreign_amount)} {tx.currency} @ {tx.exchange_rate}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {(tx.tags || []).map((t: string, i: number) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-mono">
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                    {tx.debit > 0 ? formatAmount(tx.debit) : '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-sky-400 whitespace-nowrap">
                    {tx.credit > 0 ? formatAmount(tx.credit) : '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-100 whitespace-nowrap">
                    {formatAmount(Math.abs(tx.running_display_balance))} <span className="text-[10px] text-slate-400 font-normal">{tx.running_balance_type}</span>
                  </td>
                </tr>
              ))}

              {ledgerData?.transactions?.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                    No transactions recorded for this account in the selected timeframe.
                  </td>
                </tr>
              )}
            </tbody>

            {/* Closing Balance Footer */}
            <tfoot className="bg-slate-900 font-bold border-t-2 border-slate-700 text-xs">
              <tr>
                <td colSpan={4} className="py-3 px-4 text-slate-200 uppercase">
                  Period Totals & Closing Balance
                </td>
                <td className="py-3 px-4 text-right font-mono text-emerald-400 text-sm">
                  {formatAmount(summary.periodDebitTotal)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-sky-400 text-sm">
                  {formatAmount(summary.periodCreditTotal)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-white text-sm">
                  {formatAmount(Math.abs(summary.closingDisplayBalance))} <span className="text-xs text-emerald-400">{summary.closingBalanceType}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function LedgerPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-slate-400 text-xs">Loading ledger view...</div>}>
      <LedgerViewerContent />
    </Suspense>
  );
}
