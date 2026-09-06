'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Lock, 
  Check, 
  RotateCcw, 
  SlidersHorizontal,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Filter,
  Layers,
  HelpCircle
} from 'lucide-react';
import { useCompany } from '@/components/context/company-context';
import { BankReconciliationData, BrsTransactionRow } from '@/lib/engine/reconciliation';

interface BankReconciliationViewProps {
  accountId: string;
  onReconciliationComplete?: () => void;
}

export function BankReconciliationView({ accountId, onReconciliationComplete }: BankReconciliationViewProps) {
  const { activeCompany, activeCompanyId, formatAmount } = useCompany();

  // As of Date & Statement Balance Inputs
  const [asOfDate, setAsOfDate] = useState<string>(() => {
    const now = new Date();
    // Default to last day of current month
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().substring(0, 10);
  });
  const [statementBalanceInput, setStatementBalanceInput] = useState<string>('');
  const [data, setData] = useState<BankReconciliationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [filterMode, setFilterMode] = useState<'ALL' | 'UNCLEARED' | 'CLEARED'>('ALL');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch BRS Data
  const fetchBrsData = async () => {
    if (!activeCompanyId || !accountId) return;
    try {
      setIsLoading(true);
      let url = `/api/reconciliation/brs?companyId=${activeCompanyId}&accountId=${accountId}&asOfDate=${asOfDate}`;
      if (statementBalanceInput.trim()) {
        url += `&statementBalance=${statementBalanceInput.trim()}`;
      }

      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setData(json);
        if (statementBalanceInput === '' && json.account?.last_reconciled_balance !== undefined && json.account?.last_reconciled_balance !== null) {
          // Pre-populate if empty
          // setStatementBalanceInput(json.account.last_reconciled_balance.toString());
        }
      }
    } catch (err) {
      console.error('Failed to load BRS data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBrsData();
  }, [activeCompanyId, accountId, asOfDate, statementBalanceInput]);

  // Handle Toggle Line Clearance
  const handleToggleLine = async (row: BrsTransactionRow) => {
    const newClearedState = !row.isCleared;
    const defaultDate = newClearedState ? (row.clearedDate || asOfDate || row.entryDate) : null;

    try {
      // Optimistic local update
      if (data) {
        const updated = data.transactions.map(t => {
          if (t.lineId === row.lineId) {
            return { ...t, isCleared: newClearedState, clearedDate: defaultDate };
          }
          return t;
        });
        setData({ ...data, transactions: updated });
      }

      await fetch('/api/reconciliation/brs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_LINE',
          lineId: row.lineId,
          isCleared: newClearedState,
          clearedDate: defaultDate
        })
      });

      // Refetch exact formula recalculation
      fetchBrsData();
    } catch (err) {
      console.error('Failed to update line clearance:', err);
    }
  };

  // Handle Change Clearance Date
  const handleDateChange = async (lineId: string, dateVal: string) => {
    try {
      if (data) {
        const updated = data.transactions.map(t => {
          if (t.lineId === lineId) {
            return { ...t, clearedDate: dateVal, isCleared: !!dateVal };
          }
          return t;
        });
        setData({ ...data, transactions: updated });
      }

      await fetch('/api/reconciliation/brs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_LINE',
          lineId,
          isCleared: !!dateVal,
          clearedDate: dateVal || null
        })
      });

      fetchBrsData();
    } catch (err) {
      console.error('Failed to update clearance date:', err);
    }
  };

  // Bulk Actions
  const handleBulkClearAll = async (clearState: boolean) => {
    if (!data?.transactions) return;
    const ids = data.transactions.map(t => t.lineId);

    try {
      await fetch('/api/reconciliation/brs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'BULK_CLEAR',
          lineIds: ids,
          isCleared: clearState,
          clearedDate: clearState ? asOfDate : null
        })
      });
      fetchBrsData();
    } catch (err) {
      console.error('Failed bulk update:', err);
    }
  };

  // Finalize & Lock Reconciliation
  const handleFinalize = async () => {
    if (!activeCompanyId || !accountId || !data) return;
    const targetBalance = statementBalanceInput ? parseFloat(statementBalanceInput) : data.reconciledBankBalance;

    if (isNaN(targetBalance)) {
      alert('Please enter a valid statement balance from your bank statement.');
      return;
    }

    if (data.variance !== null && data.variance > 0.001) {
      const confirmDiscrepancy = window.confirm(
        `Warning: There is a variance of ${formatAmount(data.variance)} between your Reconciled Bank Balance and the Statement Balance. Do you still want to finalize and lock this reconciliation?`
      );
      if (!confirmDiscrepancy) return;
    }

    try {
      setIsFinalizing(true);
      const res = await fetch('/api/reconciliation/brs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'FINALIZE',
          companyId: activeCompanyId,
          accountId,
          asOfDate,
          statementBalance: targetBalance
        })
      });

      const json = await res.json();
      if (json.success) {
        setFeedbackMsg({
          type: 'success',
          text: `Bank Reconciliation successfully finalized & locked as of ${asOfDate}!`
        });
        fetchBrsData();
        if (onReconciliationComplete) onReconciliationComplete();
        setTimeout(() => setFeedbackMsg(null), 5000);
      } else {
        alert(`Error: ${json.error}`);
      }
    } catch (err: any) {
      alert(`Failed to finalize: ${err.message}`);
    } finally {
      setIsFinalizing(false);
    }
  };

  // Filtered rows
  const filteredRows = useMemo(() => {
    if (!data?.transactions) return [];
    if (filterMode === 'UNCLEARED') return data.transactions.filter(t => !t.isCleared);
    if (filterMode === 'CLEARED') return data.transactions.filter(t => t.isCleared);
    return data.transactions;
  }, [data, filterMode]);

  return (
    <div className="space-y-4 text-xs select-none">
      {/* Header / Period & Statement Balance Controls */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Bank Reconciliation Statement (BRS)</h3>
              <span className="px-2 py-0.2 rounded bg-emerald-950 text-emerald-400 text-[10px] font-bold border border-emerald-800/60 font-mono">
                {data?.account?.code} - {data?.account?.name}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Reconcile company book entries against bank clearance dates to account for unpresented cheques and uncleared deposits.
            </p>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-slate-400">Last Locked:</span>
            <strong className="text-slate-200 font-mono bg-slate-900 px-2 py-1 rounded border border-slate-800">
              {data?.account?.last_reconciled_date || 'None'}
            </strong>
          </div>
        </div>

        {/* Inputs Strip: As Of Date + Target Bank Statement Ending Balance */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Reconcile As Of Date:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setAsOfDate(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().substring(0, 10));
                }}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 whitespace-nowrap text-[10px]"
              >
                Month End
              </button>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Actual Bank Statement Ending Balance ({activeCompany?.base_currency}):
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="e.g. 340900.00 (From bank PDF)"
              value={statementBalanceInput}
              onChange={(e) => setStatementBalanceInput(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {feedbackMsg && (
        <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
          feedbackMsg.type === 'success' ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300' : 'bg-rose-950/80 border-rose-800 text-rose-300'
        }`}>
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* BRS FORMULA SUMMARY CARD (The Traditional Reconciliation Math Proof) */}
      {data && (
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Reconciliation Proof & Mathematical Summary</span>
            <span className="font-mono text-slate-500">As of {asOfDate}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
            {/* 1. Book Balance */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] text-slate-400 font-sans font-semibold block">Company Book Balance</span>
              <strong className="text-slate-200 text-sm block mt-0.5">
                {formatAmount(data.bookBalance)} {data.bookBalanceSide}
              </strong>
            </div>

            {/* 2. Unpresented Cheques (+) */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] text-sky-400 font-sans font-semibold block">
                + Unpresented Cheques ({data.unpresentedChequesCount})
              </span>
              <strong className="text-sky-300 text-sm block mt-0.5">
                +{formatAmount(data.unpresentedChequesTotal)}
              </strong>
            </div>

            {/* 3. Uncleared Deposits (-) */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] text-amber-400 font-sans font-semibold block">
                - Uncleared Deposits ({data.unclearedDepositsCount})
              </span>
              <strong className="text-amber-300 text-sm block mt-0.5">
                -{formatAmount(data.unclearedDepositsTotal)}
              </strong>
            </div>

            {/* 4. Reconciled Bank Balance */}
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-700/60 shadow-sm">
              <span className="text-[10px] text-emerald-300 font-sans font-bold block">= Reconciled Bank Balance</span>
              <strong className="text-emerald-400 text-sm block mt-0.5">
                {formatAmount(data.reconciledBankBalance)} {data.reconciledBankSide}
              </strong>
            </div>
          </div>

          {/* Variance / Verification Banner */}
          {statementBalanceInput !== '' && (
            <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
              data.isReconciled
                ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
                : 'bg-amber-950/80 border-amber-800 text-amber-300'
            }`}>
              <div className="flex items-center gap-2">
                {data.isReconciled ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                )}
                <span>
                  Statement Target: <strong className="font-mono">{formatAmount(parseFloat(statementBalanceInput) || 0)}</strong>
                </span>
              </div>

              <span className="font-mono font-bold">
                {data.isReconciled
                  ? '✓ Fully Reconciled (0.00 Variance)'
                  : `Discrepancy: ${formatAmount(data.variance || 0)}`}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Interactive Transactions Clearance Table */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
        {/* Table Filter / Bulk Action Bar */}
        <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5">
            {[
              { id: 'ALL', label: `All (${data?.transactions.length || 0})` },
              { id: 'UNCLEARED', label: `Uncleared (${(data?.unpresentedChequesCount || 0) + (data?.unclearedDepositsCount || 0)})` },
              { id: 'CLEARED', label: `Cleared` },
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterMode(f.id as any)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all text-[11px] ${
                  filterMode === f.id
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Bulk Clear Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleBulkClearAll(true)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium"
            >
              Mark All Cleared
            </button>
            <button
              type="button"
              onClick={() => handleBulkClearAll(false)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 text-[11px] font-medium"
            >
              Clear None
            </button>
          </div>
        </div>

        {/* Table Grid */}
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-semibold border-b border-slate-800 sticky top-0">
              <tr>
                <th className="py-2.5 px-3 w-16 text-center">Cleared?</th>
                <th className="py-2.5 px-3 w-24">Voucher Date</th>
                <th className="py-2.5 px-3 w-28">Voucher #</th>
                <th className="py-2.5 px-3">Particulars (Counter Ledger)</th>
                <th className="py-2.5 px-3 text-right w-24">Deposit (Dr)</th>
                <th className="py-2.5 px-3 text-right w-24">Payment (Cr)</th>
                <th className="py-2.5 px-3 w-36">Bank Clearance Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 font-mono text-[11px]">
              {filteredRows.map(row => (
                <tr
                  key={row.lineId}
                  onClick={() => handleToggleLine(row)}
                  className={`cursor-pointer transition-colors ${
                    row.isCleared
                      ? 'bg-slate-950 hover:bg-slate-900/60 text-slate-300'
                      : 'bg-amber-950/20 hover:bg-amber-950/30 text-amber-200'
                  }`}
                >
                  {/* Checkbox */}
                  <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={row.isCleared}
                      onChange={() => handleToggleLine(row)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                    />
                  </td>

                  {/* Voucher Date */}
                  <td className="py-2 px-3 whitespace-nowrap text-slate-400">
                    {row.entryDate}
                  </td>

                  {/* Voucher No */}
                  <td className="py-2 px-3 font-bold text-slate-200 whitespace-nowrap">
                    {row.entryNumber}
                  </td>

                  {/* Particulars (Counter Ledger) */}
                  <td className="py-2 px-3 font-sans truncate max-w-[200px] text-slate-200">
                    <span className="font-semibold">{row.counterLedgerText}</span>
                    {row.reference && (
                      <span className="text-[10px] text-slate-500 block font-mono">Ref: {row.reference}</span>
                    )}
                  </td>

                  {/* Deposit (Dr) */}
                  <td className="py-2 px-3 text-right font-semibold text-emerald-400 whitespace-nowrap">
                    {row.debit > 0 ? formatAmount(row.debit) : '—'}
                  </td>

                  {/* Payment (Cr) */}
                  <td className="py-2 px-3 text-right font-semibold text-sky-400 whitespace-nowrap">
                    {row.credit > 0 ? formatAmount(row.credit) : '—'}
                  </td>

                  {/* Bank Clearance Date Input */}
                  <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="date"
                      value={row.clearedDate || ''}
                      onChange={(e) => handleDateChange(row.lineId, e.target.value)}
                      className={`w-full border rounded px-2 py-0.5 text-[11px] font-mono focus:outline-none ${
                        row.isCleared
                          ? 'bg-slate-900 border-slate-700 text-white'
                          : 'bg-slate-950 border-dashed border-amber-800 text-amber-300'
                      }`}
                      placeholder="Pending"
                    />
                  </td>
                </tr>
              ))}

              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-sans text-xs">
                    No transactions found for the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Finalize & Lock Footer */}
      <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-400 text-xs">
          <Lock className="w-4 h-4 text-emerald-400" />
          <span>Locking updates the ledger's reconciled date barrier to <strong>{asOfDate}</strong>.</span>
        </div>

        <button
          type="button"
          onClick={handleFinalize}
          disabled={isFinalizing}
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-700/20 transition-all disabled:opacity-50"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>{isFinalizing ? 'Finalizing...' : `Finalize & Lock Reconciliation for ${asOfDate}`}</span>
        </button>
      </div>
    </div>
  );
}
