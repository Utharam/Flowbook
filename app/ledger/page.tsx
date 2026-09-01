'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCompany } from '@/components/context/company-context';
import { CreateLedgerModal } from '@/components/accounts/create-ledger-modal';
import { 
  BookOpen, 
  Search, 
  Calendar, 
  Download, 
  Printer, 
  PlusCircle, 
  FileText, 
  ArrowLeft, 
  Settings, 
  Layers, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Tag, 
  Coins, 
  SlidersHorizontal,
  ChevronRight,
  Plus,
  Trash2,
  X,
  Building2,
  FolderTree,
  Eye,
  EyeOff,
  Sparkles,
  Edit2,
  Check,
  ArrowUpRight
} from 'lucide-react';
import { AccountType, SopStep, TriggerRules } from '@/lib/db/schema';

function LedgerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { activeCompany, activeCompanyId, formatAmount } = useCompany();

  const selectedAccountId = searchParams.get('accountId');

  // Directory State (Tier 1)
  const [directoryAccounts, setDirectoryAccounts] = useState<any[]>([]);
  const [directorySearch, setDirectorySearch] = useState('');
  const [directoryCategoryFilter, setDirectoryCategoryFilter] = useState<string>('ALL');
  const [showCreateLedgerModal, setShowCreateLedgerModal] = useState(false);

  // Focused Ledger State (Tier 2)
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [inLedgerSearch, setInLedgerSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [activePreset, setActivePreset] = useState<'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_FY'>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // View Options
  const [showNarrations, setShowNarrations] = useState(true);
  const [showForeignCurrencies, setShowForeignCurrencies] = useState(false);

  // Inline Narration Edit State
  const [editingMemoLineId, setEditingMemoLineId] = useState<string | null>(null);
  const [editingMemoText, setEditingMemoText] = useState<string>('');
  const [isSavingMemo, setIsSavingMemo] = useState(false);

  // Action & Info Hub Drawer State
  const [showDrawer, setShowDrawer] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'SOP' | 'TRIGGERS' | 'TAGS' | 'VIEW'>('SOP');
  const [isSavingGovernance, setIsSavingGovernance] = useState(false);
  const [drawerSuccessMsg, setDrawerSuccessMsg] = useState<string | null>(null);

  // Drawer Form States
  const [sopSteps, setSopSteps] = useState<SopStep[]>([]);
  const [triggerRules, setTriggerRules] = useState<TriggerRules>({});
  const [accountTags, setAccountTags] = useState<string[]>([]);
  const [accountDescription, setAccountDescription] = useState('');
  const [newTagInput, setNewTagInput] = useState('');

  // 1. Fetch Directory or Focused Ledger Data
  const fetchData = async () => {
    if (!activeCompanyId) return;
    try {
      setIsLoading(true);
      if (!selectedAccountId) {
        // Fetch Directory
        const res = await fetch(`/api/ledger?companyId=${activeCompanyId}`);
        const data = await res.json();
        if (data.success) {
          setDirectoryAccounts(data.accounts || []);
          setLedgerData(null);
        }
      } else {
        // Fetch Focused Ledger
        let url = `/api/ledger?companyId=${activeCompanyId}&accountId=${selectedAccountId}`;
        if (startDate) url += `&startDate=${startDate}`;
        if (endDate) url += `&endDate=${endDate}`;
        if (selectedTag) url += `&tag=${encodeURIComponent(selectedTag)}`;

        const res = await fetch(url);
        const data = await res.json();
        if (data.success) {
          setLedgerData(data);
          // Initialize drawer fields
          setSopSteps(data.account?.sop_steps || []);
          setTriggerRules(data.account?.trigger_rules || {});
          setAccountTags(data.account?.tags || []);
          setAccountDescription(data.account?.description || '');
        }
      }
    } catch (err) {
      console.error('Failed to load ledger data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeCompanyId, selectedAccountId, startDate, endDate, selectedTag]);

  // Date Preset Handlers
  const handleApplyPreset = (preset: 'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_FY') => {
    setActivePreset(preset);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'THIS_MONTH') {
      const firstDay = new Date(currentYear, currentMonth, 1).toISOString().substring(0, 10);
      const lastDay = new Date(currentYear, currentMonth + 1, 0).toISOString().substring(0, 10);
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === 'LAST_MONTH') {
      const firstDay = new Date(currentYear, currentMonth - 1, 1).toISOString().substring(0, 10);
      const lastDay = new Date(currentYear, currentMonth, 0).toISOString().substring(0, 10);
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === 'THIS_FY') {
      const fyStartMonth = (activeCompany?.financial_year_start_month || 4) - 1;
      let fyYear = currentYear;
      if (currentMonth < fyStartMonth) {
        fyYear -= 1;
      }
      const firstDay = new Date(fyYear, fyStartMonth, 1).toISOString().substring(0, 10);
      const lastDay = new Date(fyYear + 1, fyStartMonth, 0).toISOString().substring(0, 10);
      setStartDate(firstDay);
      setEndDate(lastDay);
    }
  };

  // Filtered Transactions for In-Ledger Search
  const filteredTransactions = useMemo(() => {
    if (!ledgerData?.transactions) return [];
    if (!inLedgerSearch.trim()) return ledgerData.transactions;

    const term = inLedgerSearch.toLowerCase();
    return ledgerData.transactions.filter((tx: any) => {
      const entryNo = (tx.entryNumber || '').toLowerCase();
      const particulars = (tx.particulars || '').toLowerCase();
      const counterLedger = (tx.counterLedgerText || '').toLowerCase();
      const ref = (tx.reference || '').toLowerCase();
      const debitStr = tx.debit ? tx.debit.toString() : '';
      const creditStr = tx.credit ? tx.credit.toString() : '';
      const tagsStr = (tx.tags || []).join(' ').toLowerCase();

      return (
        entryNo.includes(term) ||
        particulars.includes(term) ||
        counterLedger.includes(term) ||
        ref.includes(term) ||
        debitStr.includes(term) ||
        creditStr.includes(term) ||
        tagsStr.includes(term)
      );
    });
  }, [ledgerData, inLedgerSearch]);

  // Filtered Directory Accounts
  const filteredDirectoryAccounts = useMemo(() => {
    return directoryAccounts.filter(acc => {
      if (acc.is_group === 1) return false; // Show leaf posting accounts in directory
      if (directoryCategoryFilter !== 'ALL' && acc.type !== directoryCategoryFilter) return false;
      if (!directorySearch.trim()) return true;

      const term = directorySearch.toLowerCase();
      const code = (acc.code || '').toLowerCase();
      const name = (acc.name || '').toLowerCase();
      const path = (acc.path || '').toLowerCase();
      const tags = (acc.tags || []).join(' ').toLowerCase();

      return code.includes(term) || name.includes(term) || path.includes(term) || tags.includes(term);
    });
  }, [directoryAccounts, directorySearch, directoryCategoryFilter]);

  // SOP Step Handlers
  const handleAddSopStep = () => {
    setSopSteps([
      ...sopSteps,
      {
        step_number: sopSteps.length + 1,
        title: `Step ${sopSteps.length + 1}`,
        instruction: ''
      }
    ]);
  };

  const handleUpdateSopStep = (index: number, field: 'title' | 'instruction', val: string) => {
    const updated = [...sopSteps];
    updated[index] = { ...updated[index], [field]: val };
    setSopSteps(updated);
  };

  const handleDeleteSopStep = (index: number) => {
    const updated = sopSteps.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_number: i + 1 }));
    setSopSteps(updated);
  };

  // Tag Handlers
  const handleAddTag = (e: React.KeyboardEvent | React.MouseEvent) => {
    if (newTagInput.trim()) {
      let tagFormatted = newTagInput.trim();
      if (!tagFormatted.startsWith('#')) tagFormatted = `#${tagFormatted}`;
      if (!accountTags.includes(tagFormatted)) {
        setAccountTags([...accountTags, tagFormatted]);
      }
      setNewTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setAccountTags(accountTags.filter(t => t !== tagToRemove));
  };

  // Inline Narration Editing Handlers
  const startEditingMemo = (lineId: string, currentMemo: string) => {
    setEditingMemoLineId(lineId);
    setEditingMemoText(currentMemo || '');
  };

  const cancelEditingMemo = () => {
    setEditingMemoLineId(null);
    setEditingMemoText('');
  };

  const saveEditingMemo = async (entryId: string, lineId: string) => {
    if (!activeCompanyId) return;
    try {
      setIsSavingMemo(true);
      const res = await fetch('/api/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_MEMO',
          companyId: activeCompanyId,
          entryId,
          lineId,
          memo: editingMemoText
        })
      });

      const data = await res.json();
      if (data.success) {
        // Optimistic local update
        if (ledgerData?.transactions) {
          const updatedTxs = ledgerData.transactions.map((tx: any) => {
            if (tx.lineId === lineId) {
              return { ...tx, particulars: editingMemoText, narration: editingMemoText };
            }
            return tx;
          });
          setLedgerData({ ...ledgerData, transactions: updatedTxs });
        }
        setEditingMemoLineId(null);
      } else {
        alert(`Failed: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error updating narration: ${err.message}`);
    } finally {
      setIsSavingMemo(false);
    }
  };

  // Save Governance Metadata
  const handleSaveGovernance = async () => {
    if (!selectedAccountId || !activeCompanyId) return;
    try {
      setIsSavingGovernance(true);
      setDrawerSuccessMsg(null);

      const res = await fetch('/api/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_GOVERNANCE',
          companyId: activeCompanyId,
          accountId: selectedAccountId,
          description: accountDescription,
          tags: accountTags,
          sop_steps: sopSteps,
          trigger_rules: triggerRules
        })
      });

      const data = await res.json();
      if (data.success) {
        setDrawerSuccessMsg('Governance parameters & SOP updated successfully!');
        fetchData();
        setTimeout(() => setDrawerSuccessMsg(null), 3500);
      } else {
        alert(`Failed: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error saving governance: ${err.message}`);
    } finally {
      setIsSavingGovernance(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!ledgerData || !ledgerData.account) return;
    const { account, totals, transactions } = ledgerData;

    const rows = [
      [`Flowbook by Utharam - General Ledger Statement`],
      [`Entity: ${activeCompany?.legal_name}`],
      [`Account: ${account.code} - ${account.name}`],
      [`Period: ${startDate || 'Inception'} to ${endDate || 'Present'}`],
      [`Base Currency: ${activeCompany?.base_currency}`],
      [],
      [`Opening Balance:`, '', '', '', '', totals.openingBalance.toFixed(activeCompany?.decimal_places || 2), totals.openingSide],
      [],
      ['Date', 'Voucher No', 'Counter Ledger (Opposite Account)', 'Particulars / Narration', 'Reference', 'Tags', 'Debit (Dr)', 'Credit (Cr)', 'Running Balance', 'Side'],
      ...transactions.map((tx: any) => [
        tx.entryDate,
        tx.entryNumber,
        `"${(tx.counterLedgerText || '').replace(/"/g, '""')}"`,
        `"${(tx.particulars || '').replace(/"/g, '""')}"`,
        tx.reference || '',
        (tx.tags || []).join('; '),
        tx.debit > 0 ? tx.debit.toFixed(activeCompany?.decimal_places || 2) : '',
        tx.credit > 0 ? tx.credit.toFixed(activeCompany?.decimal_places || 2) : '',
        tx.runningBalance.toFixed(activeCompany?.decimal_places || 2),
        tx.balanceSide
      ]),
      [],
      ['Total Period Debits:', totals.periodDebits.toFixed(activeCompany?.decimal_places || 2)],
      ['Total Period Credits:', totals.periodCredits.toFixed(activeCompany?.decimal_places || 2)],
      ['Net Period Movement:', totals.netMovement.toFixed(activeCompany?.decimal_places || 2)],
      ['Period Closing Balance:', totals.closingBalance.toFixed(activeCompany?.decimal_places || 2), totals.closingSide]
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Ledger_${account.code}_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper for Category Colors
  const getCategoryBadge = (type: AccountType) => {
    switch (type) {
      case 'ASSET': return 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60';
      case 'LIABILITY': return 'bg-sky-950/80 text-sky-400 border-sky-800/60';
      case 'EQUITY': return 'bg-indigo-950/80 text-indigo-400 border-indigo-800/60';
      case 'REVENUE': return 'bg-teal-950/80 text-teal-400 border-teal-800/60';
      case 'EXPENSE': return 'bg-amber-950/80 text-amber-400 border-amber-800/60';
      default: return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto select-none">
      {/* ========================================================================= */}
      {/* TIER 1: LEDGER DIRECTORY & SEARCH HUB (When no accountId is active)        */}
      {/* ========================================================================= */}
      {!selectedAccountId && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
                <BookOpen className="w-4 h-4" />
                <span>Core Ledger & Account Statement Directory</span>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Account Ledger Directory
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Search, inspect running balances, and open focused transaction statements for any ledger account.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowCreateLedgerModal(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold border border-slate-700 transition-all shadow-sm"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>+ Create New Ledger</span>
              </button>

              <Link
                href="/vouchers/new"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-700/25 transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ New Voucher</span>
              </Link>
            </div>
          </div>

          {/* Search & Category Filter Bar */}
          <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-2xl space-y-3 shadow-sm">
            <div className="flex flex-col md:flex-row items-center gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search ledgers by code, account name, tags, or taxonomy path..."
                  value={directorySearch}
                  onChange={(e) => setDirectorySearch(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
                {['ALL', 'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setDirectoryCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap border ${
                      directoryCategoryFilter === cat
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {cat === 'ALL' ? 'All Heads' : cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Accounts Directory Table */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Active Posting Ledgers ({filteredDirectoryAccounts.length})
              </div>
              <div className="text-xs text-slate-400">
                Click any account row to open its detailed statement
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4 w-28">Code</th>
                    <th className="py-3 px-4">Account Name</th>
                    <th className="py-3 px-4">Primary Head</th>
                    <th className="py-3 px-4">Hierarchy Path</th>
                    <th className="py-3 px-4">Governance</th>
                    <th className="py-3 px-4 text-right">Transactions</th>
                    <th className="py-3 px-4 text-right">Current Running Balance</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredDirectoryAccounts.map((acc) => (
                    <tr
                      key={acc.id}
                      onClick={() => router.push(`/ledger?accountId=${acc.id}`)}
                      className="hover:bg-slate-850/50 cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                        {acc.code}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-100 group-hover:text-emerald-300 transition-colors">
                        <div>{acc.name}</div>
                        {acc.tags && acc.tags.length > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            {acc.tags.map((t: string) => (
                              <span key={t} className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getCategoryBadge(acc.type)}`}>
                          {acc.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                        {acc.path}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          {acc.sop_count > 0 && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800/60">
                              {acc.sop_count} SOP Steps
                            </span>
                          )}
                          {acc.has_triggers && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/60">
                              Triggers Active
                            </span>
                          )}
                          {!acc.sop_count && !acc.has_triggers && (
                            <span className="text-slate-600 text-[11px]">—</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-300">
                        {acc.transaction_count}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-100 whitespace-nowrap">
                        <span>{formatAmount(acc.displayBalance)}</span>{' '}
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          acc.normalSide === 'Dr' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60' : 'bg-sky-950 text-sky-400 border border-sky-800/60'
                        }`}>
                          {acc.normalSide}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 group-hover:bg-emerald-600 text-slate-300 group-hover:text-white text-xs font-semibold transition-all">
                          <span>Open</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </td>
                    </tr>
                  ))}

                  {filteredDirectoryAccounts.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                        No ledger accounts found matching your search query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TIER 2: DEDICATED FOCUSED LEDGER WORKSPACE (When accountId is active)     */}
      {/* ========================================================================= */}
      {selectedAccountId && ledgerData && ledgerData.account && (
        <div className="space-y-6">
          {/* Top Back & Account Header Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => router.push('/ledger')}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 transition-colors font-medium mb-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>← Back to Ledger Directory</span>
              </button>

              <div className="flex items-center gap-3">
                <span className="text-xl font-bold font-mono text-emerald-400">
                  {ledgerData.account.code}
                </span>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  {ledgerData.account.name}
                </h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getCategoryBadge(ledgerData.account.type)}`}>
                  {ledgerData.account.type}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                <span>Path: {ledgerData.account.path}</span>
                <span>•</span>
                <span>Base Currency: <strong className="text-slate-200">{activeCompany?.base_currency}</strong></span>
                {ledgerData.account.tags && ledgerData.account.tags.length > 0 && (
                  <>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      {ledgerData.account.tags.map((t: string) => (
                        <span key={t} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                          {t}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 self-start md:self-auto">
              <button
                type="button"
                onClick={() => setShowDrawer(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold border border-slate-700 shadow-sm transition-all"
                title="Open SOP, Triggers & Rules Drawer"
              >
                <Settings className="w-4 h-4 text-amber-400" />
                <span>Action & Info Hub</span>
                {(ledgerData.account.sop_steps?.length > 0 || Object.keys(ledgerData.account.trigger_rules || {}).length > 0) && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                )}
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>

              <Link
                href="/vouchers/new"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-700/20 transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>New Voucher</span>
              </Link>
            </div>
          </div>

          {/* Compact Period Selector Bar & KPI Strip */}
          <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-2xl space-y-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
              {/* Presets */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                {[
                  { id: 'ALL', label: 'All Time' },
                  { id: 'THIS_MONTH', label: 'This Month' },
                  { id: 'LAST_MONTH', label: 'Last Month' },
                  { id: 'THIS_FY', label: 'This FY' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleApplyPreset(p.id as any)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      activePreset === p.id
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Custom Date Pickers */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-slate-300">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>From:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); setActivePreset('ALL'); }}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <span>To:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => { setEndDate(e.target.value); setActivePreset('ALL'); }}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* KPI Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 border-t border-slate-800 text-xs">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Opening Balance</span>
                <strong className="text-slate-200 font-mono text-sm block mt-0.5">
                  {formatAmount(ledgerData.totals.openingBalance)} {ledgerData.totals.openingSide}
                </strong>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] text-emerald-400 uppercase font-semibold block">Period Debits (DR)</span>
                <strong className="text-emerald-300 font-mono text-sm block mt-0.5">
                  {formatAmount(ledgerData.totals.periodDebits)}
                </strong>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] text-sky-400 uppercase font-semibold block">Period Credits (CR)</span>
                <strong className="text-sky-300 font-mono text-sm block mt-0.5">
                  {formatAmount(ledgerData.totals.periodCredits)}
                </strong>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Net Movement</span>
                <strong className="text-slate-200 font-mono text-sm block mt-0.5">
                  {formatAmount(ledgerData.totals.netMovement)}
                </strong>
              </div>

              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-700/60 col-span-2 sm:col-span-1 shadow-sm">
                <span className="text-[10px] text-emerald-300 uppercase font-bold block">Closing Balance</span>
                <strong className="text-emerald-400 font-mono text-base block mt-0.5">
                  {formatAmount(ledgerData.totals.closingBalance)} {ledgerData.totals.closingSide}
                </strong>
              </div>
            </div>
          </div>

          {/* Quick In-Ledger Search & Display Toggles Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0f172a] border border-slate-800 p-3.5 rounded-2xl text-xs shadow-sm">
            {/* In-Ledger Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search transactions: memo, counter ledger, voucher #, tag, amount..."
                value={inLedgerSearch}
                onChange={(e) => setInLedgerSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* View Toggles */}
            <div className="flex items-center gap-4 text-slate-300">
              <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                <input
                  type="checkbox"
                  checked={showNarrations}
                  onChange={(e) => setShowNarrations(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Show Narrations & Memos</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                <input
                  type="checkbox"
                  checked={showForeignCurrencies}
                  onChange={(e) => setShowForeignCurrencies(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Show Forex</span>
              </label>

              <span className="text-slate-500 font-mono text-[11px]">
                {filteredTransactions.length} of {ledgerData.transactions.length} rows
              </span>
            </div>
          </div>

          {/* Chronological Postings Grid (Tally-Inspired Clean Layout) */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4 w-28">Date</th>
                    <th className="py-3 px-4 w-32">Voucher No</th>
                    <th className="py-3 px-4">Particulars (Counter Ledger)</th>
                    {showForeignCurrencies && <th className="py-3 px-4 text-right w-32">Forex Amount</th>}
                    <th className="py-3 px-4 w-28">Tags (#)</th>
                    <th className="py-3 px-4 text-right w-32">Debit (DR)</th>
                    <th className="py-3 px-4 text-right w-32">Credit (CR)</th>
                    <th className="py-3 px-4 text-right w-36">Cumulative Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {/* Opening Balance Row */}
                  <tr className="bg-slate-900/60 font-semibold text-slate-300">
                    <td className="py-2.5 px-4 font-mono text-slate-400">{startDate || '—'}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-500">OPENING-BAL</td>
                    <td className="py-2.5 px-4 italic text-slate-400">Opening Balance Brought Forward</td>
                    {showForeignCurrencies && <td className="py-2.5 px-4 text-right font-mono text-slate-500">—</td>}
                    <td className="py-2.5 px-4 font-mono text-slate-500">—</td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-500">—</td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-500">—</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-200">
                      {formatAmount(ledgerData.totals.openingBalance)} {ledgerData.totals.openingSide}
                    </td>
                  </tr>

                  {/* Transaction Rows */}
                  {filteredTransactions.map((tx: any) => {
                    const isEditingThisMemo = editingMemoLineId === tx.lineId;

                    return (
                      <React.Fragment key={tx.lineId}>
                        {/* 1. Primary Financial Row */}
                        <tr className={`hover:bg-slate-850/50 transition-colors group ${showNarrations ? 'border-b-0' : ''}`}>
                          {/* Date */}
                          <td className="py-2.5 px-4 font-mono text-slate-300 whitespace-nowrap">
                            {tx.entryDate}
                          </td>

                          {/* Voucher Number */}
                          <td className="py-2.5 px-4 font-mono font-bold text-slate-200 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Link href="/vouchers" className="hover:text-emerald-400 hover:underline">
                                {tx.entryNumber}
                              </Link>
                              {tx.isReversal && (
                                <span className="px-1.5 py-0.2 rounded bg-rose-950 text-rose-400 text-[10px] font-bold border border-rose-800/50">
                                  REV
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Particulars (Counter Ledger / Contra Account) */}
                          <td className="py-2.5 px-4">
                            {tx.primaryCounterAccount ? (
                              <Link
                                href={`/ledger?accountId=${tx.primaryCounterAccount.id}`}
                                className="font-semibold text-slate-100 hover:text-emerald-400 hover:underline inline-flex items-center gap-1.5 group/link"
                                title={`Drill into ${tx.counterLedgerText}`}
                              >
                                <span className="font-mono text-emerald-400 font-bold">{tx.primaryCounterAccount.code}</span>
                                <span>{tx.primaryCounterAccount.name}</span>
                                {tx.counterLedgers?.length > 1 && (
                                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                                    +{tx.counterLedgers.length - 1} split
                                  </span>
                                )}
                                <ArrowUpRight className="w-3 h-3 text-slate-500 group-hover/link:text-emerald-400 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                              </Link>
                            ) : (
                              <span className="text-slate-400 font-mono italic">Direct Entry</span>
                            )}
                          </td>

                          {/* Forex Amount (if enabled) */}
                          {showForeignCurrencies && (
                            <td className="py-2.5 px-4 text-right font-mono text-amber-300 whitespace-nowrap">
                              {tx.lineCurrency !== activeCompany?.base_currency ? (
                                <span>{tx.foreignAmount.toLocaleString()} {tx.lineCurrency}</span>
                              ) : (
                                <span className="text-slate-600">—</span>
                              )}
                            </td>
                          )}

                          {/* Tags */}
                          <td className="py-2.5 px-4">
                            {tx.tags && tx.tags.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {tx.tags.map((t: string) => (
                                  <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                                    {t}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-600 text-[11px]">—</span>
                            )}
                          </td>

                          {/* Debit (DR) */}
                          <td className="py-2.5 px-4 text-right font-mono font-semibold text-emerald-400 whitespace-nowrap">
                            {tx.debit > 0 ? formatAmount(tx.debit) : '—'}
                          </td>

                          {/* Credit (CR) */}
                          <td className="py-2.5 px-4 text-right font-mono font-semibold text-sky-400 whitespace-nowrap">
                            {tx.credit > 0 ? formatAmount(tx.credit) : '—'}
                          </td>

                          {/* Cumulative Balance */}
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-100 whitespace-nowrap">
                            <span>{formatAmount(tx.runningBalance)}</span>{' '}
                            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                              tx.balanceSide === 'Dr' ? 'bg-emerald-950 text-emerald-400' : 'bg-sky-950 text-sky-400'
                            }`}>
                              {tx.balanceSide}
                            </span>
                          </td>
                        </tr>

                        {/* 2. Spanned Dedicated Narration Sub-Row (Tally-Style Horizontal Narration) */}
                        {showNarrations && (
                          <tr className="bg-slate-950/40 text-slate-400 border-b border-slate-850 hover:bg-slate-900/40 transition-colors">
                            <td colSpan={showForeignCurrencies ? 8 : 7} className="py-1.5 px-4 pl-12 text-[11px]">
                              {isEditingThisMemo ? (
                                <div className="flex items-center gap-2 py-1 max-w-2xl animate-in fade-in duration-150">
                                  <span className="text-emerald-400 font-bold font-mono">Edit Narration:</span>
                                  <input
                                    type="text"
                                    value={editingMemoText}
                                    onChange={(e) => setEditingMemoText(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') saveEditingMemo(tx.entryId, tx.lineId);
                                      if (e.key === 'Escape') cancelEditingMemo();
                                    }}
                                    autoFocus
                                    className="flex-1 bg-slate-900 border border-emerald-500 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none shadow-sm"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => saveEditingMemo(tx.entryId, tx.lineId)}
                                    disabled={isSavingMemo}
                                    className="p-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 px-2 text-xs font-bold"
                                    title="Save Narration"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Save</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelEditingMemo}
                                    className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white px-2 text-xs"
                                    title="Cancel"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between gap-4 group/memo">
                                  <div className="flex items-center gap-2 italic text-slate-300">
                                    <span className="text-slate-500 not-italic font-semibold text-[10px] uppercase tracking-wider">Narration:</span>
                                    <span>{tx.particulars || 'No narration provided'}</span>
                                    {tx.reference && (
                                      <span className="not-italic text-slate-400 font-mono text-[10px] bg-slate-850 px-1.5 py-0.2 rounded border border-slate-750">
                                        Ref: {tx.reference}
                                      </span>
                                    )}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => startEditingMemo(tx.lineId, tx.particulars)}
                                    className="opacity-0 group-hover/memo:opacity-100 flex items-center gap-1 text-[10px] text-slate-400 hover:text-emerald-400 px-2 py-0.5 rounded hover:bg-slate-800 transition-all shrink-0 font-medium not-italic"
                                    title="Edit Narration / Memo"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                    <span>Edit</span>
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td colSpan={showForeignCurrencies ? 8 : 7} className="py-12 text-center text-slate-500 text-xs">
                        No transactions found in this period matching your search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SLIDE-OUT ACTION & INFO HUB GOVERNANCE DRAWER                             */}
      {/* ========================================================================= */}
      {showDrawer && ledgerData?.account && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Ledger Action & Governance Hub
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    {ledgerData.account.code} - {ledgerData.account.name}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowDrawer(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Navigation Tabs */}
            <div className="flex border-b border-slate-800 bg-slate-900/90 text-xs">
              {[
                { id: 'SOP', label: 'SOP & Workflow', icon: Sparkles },
                { id: 'TRIGGERS', label: 'Scrutiny Triggers', icon: AlertCircle },
                { id: 'TAGS', label: 'Tags & Notes', icon: Tag },
                { id: 'VIEW', label: 'View & Print Options', icon: SlidersHorizontal },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = drawerTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setDrawerTab(tab.id as any)}
                    className={`flex-1 py-3 px-3 flex items-center justify-center gap-1.5 font-bold transition-all border-b-2 ${
                      isActive
                        ? 'border-emerald-500 text-emerald-400 bg-emerald-950/20'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              {drawerSuccessMsg && (
                <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{drawerSuccessMsg}</span>
                </div>
              )}

              {/* TAB 1: SOP & WORKFLOW STEPS */}
              {drawerTab === 'SOP' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">Standard Operating Procedure (SOP)</h4>
                      <p className="text-slate-400 text-[11px]">
                        Save mandatory steps bookkeepers must complete when posting entries to this ledger.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddSopStep}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Step</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {sopSteps.map((step, idx) => (
                      <div key={idx} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-emerald-400 font-mono text-[11px]">
                            Step {step.step_number}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteSopStep(idx)}
                            className="text-slate-500 hover:text-rose-400 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <input
                          type="text"
                          placeholder="Step title (e.g. Collect Fuel Receipt & Driver KM Reading)"
                          value={step.title}
                          onChange={(e) => handleUpdateSopStep(idx, 'title', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        />

                        <textarea
                          rows={2}
                          placeholder="Detailed instructions (e.g. Verify logbook, calculate mileage variance, get CEO sign-off before posting)"
                          value={step.instruction}
                          onChange={(e) => handleUpdateSopStep(idx, 'instruction', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                    ))}

                    {sopSteps.length === 0 && (
                      <div className="p-8 text-center bg-slate-950 rounded-xl border border-dashed border-slate-800 text-slate-500">
                        No SOP steps defined yet. Click "+ Add Step" to establish posting guidelines.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: SCRUTINY TRIGGERS & LIMITS */}
              {drawerTab === 'TRIGGERS' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-white">Scrutiny Rules & Action Queue Triggers</h4>
                    <p className="text-slate-400 text-[11px]">
                      Configure automated alerts when activity thresholds are violated.
                    </p>
                  </div>

                  <div className="space-y-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        Minimum Monthly Required Activity
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 1 (Requires at least 1 entry per month for rent/utilities)"
                        value={triggerRules.min_monthly_transactions ?? ''}
                        onChange={(e) => setTriggerRules({ ...triggerRules, min_monthly_transactions: parseInt(e.target.value) || 0 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Action Queue will trigger a high-severity alert if 0 transactions are detected in a month.
                      </span>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        Single Transaction Ceiling Limit ({activeCompany?.base_currency})
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 10000 (Flag any single transaction above this amount)"
                        value={triggerRules.max_single_transaction_limit ?? ''}
                        onChange={(e) => setTriggerRules({ ...triggerRules, max_single_transaction_limit: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Entries exceeding this limit will require senior managerial approval in Action Queue.
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-800">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={triggerRules.alert_on_unusual_variance ?? false}
                          onChange={(e) => setTriggerRules({ ...triggerRules, alert_on_unusual_variance: e.target.checked })}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-slate-200 font-semibold">Flag Unusual Month-over-Month Variance (&gt;30%)</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: TAGS & DESCRIPTION */}
              {drawerTab === 'TAGS' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-white">Persistent Tags & Account Notes</h4>
                    <p className="text-slate-400 text-[11px]">
                      Manage default tags and account description for audit documentation.
                    </p>
                  </div>

                  <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1.5">Default Tags (#)</label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {accountTags.map((t) => (
                          <span key={t} className="px-2 py-1 rounded-lg bg-slate-800 text-slate-200 font-mono text-[11px] flex items-center gap-1">
                            <span>{t}</span>
                            <button type="button" onClick={() => handleRemoveTag(t)} className="text-slate-400 hover:text-rose-400">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="e.g. #1206, #HQ, #Vendors"
                          value={newTagInput}
                          onChange={(e) => setNewTagInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag(e))}
                          className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white font-mono"
                        />
                        <button
                          type="button"
                          onClick={handleAddTag}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold"
                        >
                          Add Tag
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Account Description / Audit Notes</label>
                      <textarea
                        rows={4}
                        placeholder="e.g. Commercial office rental account for Bengaluru HQ facility. TDS 194-I applies."
                        value={accountDescription}
                        onChange={(e) => setAccountDescription(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: VIEW & PRINT OPTIONS */}
              {drawerTab === 'VIEW' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-white">Statement View & Multi-Currency Preferences</h4>
                    <p className="text-slate-400 text-[11px]">
                      Customize how ledger transactions are rendered on screen and printed.
                    </p>
                  </div>

                  <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <label className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                      <div>
                        <div className="font-semibold text-slate-200">Show Full Voucher Narrations</div>
                        <div className="text-[10px] text-slate-400">Renders detailed memos and invoice reference lines</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={showNarrations}
                        onChange={(e) => setShowNarrations(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                      <div>
                        <div className="font-semibold text-slate-200">Display Multi-Currency Forex Amounts</div>
                        <div className="text-[10px] text-slate-400">Shows foreign currency (EUR/AED/GBP/USD) alongside base amounts</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={showForeignCurrencies}
                        onChange={(e) => setShowForeignCurrencies(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowDrawer(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-750 font-medium"
              >
                Close
              </button>

              <button
                type="button"
                onClick={handleSaveGovernance}
                disabled={isSavingGovernance}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-700/20 transition-all disabled:opacity-50"
              >
                {isSavingGovernance ? 'Saving Changes...' : 'Save Governance Parameters'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* On-The-Fly Hierarchical Create Ledger Modal */}
      {showCreateLedgerModal && (
        <CreateLedgerModal
          companyId={activeCompanyId || ''}
          existingAccounts={directoryAccounts}
          isOpen={showCreateLedgerModal}
          onClose={() => setShowCreateLedgerModal(false)}
          onAccountCreated={(newAccount) => {
            setShowCreateLedgerModal(false);
            fetchData();
            router.push(`/ledger?accountId=${newAccount.id}`);
          }}
        />
      )}
    </div>
  );
}

export default function AccountLedgerPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400 font-mono text-xs">Loading ledger workspace...</div>}>
      <LedgerContent />
    </Suspense>
  );
}
