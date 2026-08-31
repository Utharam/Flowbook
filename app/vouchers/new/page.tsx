'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCompany } from '@/components/context/company-context';
import { 
  Receipt, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Coins, 
  Tag, 
  ArrowLeft, 
  ShieldCheck, 
  Lock,
  Layers
} from 'lucide-react';
import Link from 'next/link';
import { getExchangeRate } from '@/lib/engine/multi-currency';
import { CreateLedgerModal } from '@/components/accounts/create-ledger-modal';
import { AccountType } from '@/lib/db/schema';

interface LineItemState {
  accountId: string;
  currency: string;
  exchangeRate: number;
  direction: 'DEBIT' | 'CREDIT';
  amount: number; // unsigned user input
  memo: string;
  tagsText: string;
}

function VoucherFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get('template');

  const { activeCompany, activeCompanyId, formatAmount } = useCompany();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [allRawAccounts, setAllRawAccounts] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [isNonFinancial, setIsNonFinancial] = useState<boolean>(false);

  // On-the-fly Ledger creation state
  const [showCreateLedgerModal, setShowCreateLedgerModal] = useState<boolean>(false);
  const [activeLineForCreation, setActiveLineForCreation] = useState<number>(0);
  const [creationDefaultType, setCreationDefaultType] = useState<AccountType>('EXPENSE');

  const [entryDate, setEntryDate] = useState(new Date().toISOString().substring(0, 10));
  const [memo, setMemo] = useState('');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState<LineItemState[]>([
    {
      accountId: '',
      currency: activeCompany?.base_currency || 'USD',
      exchangeRate: 1.0,
      direction: 'DEBIT',
      amount: 0,
      memo: '',
      tagsText: ''
    },
    {
      accountId: '',
      currency: activeCompany?.base_currency || 'USD',
      exchangeRate: 1.0,
      direction: 'CREDIT',
      amount: 0,
      memo: '',
      tagsText: ''
    }
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  // Load accounts and templates
  const loadScaffolding = async () => {
    if (!activeCompanyId) return;
    try {
      const [accRes, tplRes] = await Promise.all([
        fetch(`/api/accounts?companyId=${activeCompanyId}`),
        fetch(`/api/templates?companyId=${activeCompanyId}`)
      ]);

      const [accData, tplData] = await Promise.all([accRes.json(), tplRes.json()]);

      if (accData.success) {
        setAllRawAccounts(accData.accounts || []);
        setAccounts(accData.accounts.filter((a: any) => a.is_group === 0)); // Only posting accounts
      }
      if (tplData.success) {
        setTemplates(tplData.templates || []);
      }
    } catch (err) {
      console.error('Failed to load voucher scaffolding:', err);
    }
  };

  useEffect(() => {
    loadScaffolding();
  }, [activeCompanyId]);

  // Handle template pre-filling
  useEffect(() => {
    if (templateId && templates.length > 0 && accounts.length > 0) {
      const tpl = templates.find((t: any) => t.id === templateId);
      if (tpl) {
        setMemo(tpl.name);
        const newLines: LineItemState[] = (tpl.template_lines || []).map((tl: any) => ({
          accountId: tl.account_id || '',
          currency: activeCompany?.base_currency || 'USD',
          exchangeRate: 1.0,
          direction: tl.direction || 'DEBIT',
          amount: 0,
          memo: tl.memo || tl.role_name || '',
          tagsText: (tl.default_tags || tpl.default_tags || []).join(' ')
        }));
        if (newLines.length >= 2) {
          setLines(newLines);
        }
      }
    }
  }, [templateId, templates, accounts, activeCompany]);

  const addLine = () => {
    setLines([
      ...lines,
      {
        accountId: '',
        currency: activeCompany?.base_currency || 'USD',
        exchangeRate: 1.0,
        direction: 'DEBIT',
        amount: 0,
        memo: '',
        tagsText: ''
      }
    ]);
  };

  const removeLine = (idx: number) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, field: keyof LineItemState, val: any) => {
    // If user clicked the special "+ Create New..." option
    if (field === 'accountId' && val === '__CREATE_NEW__') {
      openCreateLedgerForLine(idx);
      return;
    }

    const updated = [...lines];
    updated[idx] = { ...updated[idx], [field]: val };

    // Auto-update exchange rate if currency changes
    if (field === 'currency' && activeCompany) {
      const rate = getExchangeRate(activeCompany.base_currency, val);
      updated[idx].exchangeRate = rate;
    }

    setLines(updated);
  };

  const openCreateLedgerForLine = (lineIdx: number) => {
    setActiveLineForCreation(lineIdx);
    // Suggest default type based on line direction (Debits are often Expenses/Assets, Credits are Revenue/Liabilities)
    const dir = lines[lineIdx]?.direction;
    setCreationDefaultType(dir === 'DEBIT' ? 'EXPENSE' : 'REVENUE');
    setShowCreateLedgerModal(true);
  };

  const handleAccountCreatedOnTheFly = (createdAccount: any) => {
    setAccounts((prev) => [...prev, createdAccount]);
    setAllRawAccounts((prev) => [...prev, createdAccount]);

    const updated = [...lines];
    if (updated[activeLineForCreation]) {
      updated[activeLineForCreation].accountId = createdAccount.id;
    }
    setLines(updated);
  };

  // Calculate live zero-sum balances in base currency
  let totalDebitsBase = 0;
  let totalCreditsBase = 0;

  for (const line of lines) {
    const baseAmt = (line.amount || 0) * (line.exchangeRate || 1.0);
    if (line.direction === 'DEBIT') {
      totalDebitsBase += baseAmt;
    } else {
      totalCreditsBase += baseAmt;
    }
  }

  const variance = totalDebitsBase - totalCreditsBase;
  const isBalanced = isNonFinancial || (Math.abs(variance) < 0.001 && totalDebitsBase > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors([]);

    if (!isNonFinancial && !isBalanced) {
      setFormErrors([`Voucher is not balanced: Variance is ${variance.toFixed(activeCompany?.decimal_places || 2)} ${activeCompany?.base_currency}`]);
      return;
    }

    if (activeCompany?.lock_date && entryDate <= activeCompany.lock_date) {
      setFormErrors([`Books are locked for period up to ${activeCompany.lock_date}. Cannot post backdated entries.`]);
      return;
    }

    try {
      setSubmitting(true);

      const formattedLines = lines.map((l) => {
        const rawTags = l.tagsText
          .split(/[\s,]+/)
          .map((t) => t.trim())
          .filter((t) => t.startsWith('#') && t.length > 1);

        return {
          accountId: l.accountId,
          currency: l.currency,
          exchangeRate: l.exchangeRate,
          debit: l.direction === 'DEBIT' ? l.amount : undefined,
          credit: l.direction === 'CREDIT' ? l.amount : undefined,
          memo: l.memo || undefined,
          tags: rawTags
        };
      });

      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: activeCompanyId,
          entryDate,
          memo,
          reference,
          isNonFinancial,
          lines: formattedLines
        })
      });

      const data = await res.json();
      if (data.success) {
        router.push('/vouchers');
      } else {
        setFormErrors(data.errors || [data.error || 'Failed to post voucher']);
      }
    } catch (err: any) {
      setFormErrors([err.message]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/vouchers"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Create Journal Voucher
            </h1>
            <p className="text-xs text-slate-400">
              Multi-currency double-entry voucher runner with on-the-fly hierarchical ledger creation.
            </p>
          </div>
        </div>

        {/* Non-Financial Attestation Mode Switch */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3.5 py-1.5 rounded-xl">
          <input
            type="checkbox"
            id="nonFinancialToggle"
            checked={isNonFinancial}
            onChange={(e) => setIsNonFinancial(e.target.checked)}
            className="rounded text-sky-500 focus:ring-sky-400"
          />
          <label htmlFor="nonFinancialToggle" className="text-xs font-semibold text-sky-300 cursor-pointer">
            Non-Financial Audit Attestation Mode
          </label>
        </div>
      </div>

      {/* Form Error Banner */}
      {formErrors.length > 0 && (
        <div className="bg-rose-950/60 border border-rose-800/80 p-4 rounded-xl space-y-1">
          <div className="flex items-center gap-2 text-rose-300 font-bold text-xs">
            <AlertCircle className="w-4 h-4" />
            <span>Cannot Post Voucher</span>
          </div>
          {formErrors.map((err, i) => (
            <p key={i} className="text-xs text-rose-200 ml-6">{err}</p>
          ))}
        </div>
      )}

      {/* Lock Date Warning */}
      {activeCompany?.lock_date && (
        <div className="bg-amber-950/40 border border-amber-800/50 p-3 rounded-xl flex items-center gap-2.5 text-xs text-amber-300">
          <Lock className="w-4 h-4 shrink-0 text-amber-400" />
          <span>
            Closed Books Barrier active: Any transaction on or prior to <strong>{activeCompany.lock_date}</strong> will be rejected by the engine.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header Fields Card */}
        <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Posting Date</label>
            <input
              type="date"
              required
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Reference / Invoice #</label>
            <input
              type="text"
              placeholder="e.g. INV-2026-0042 / CHQ-9912"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Particulars / Memo</label>
            <input
              type="text"
              required
              placeholder="e.g. Monthly cloud server infrastructure payment"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Line Items Card */}
        {!isNonFinancial && (
          <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Journal Line Items</h2>
              <button
                type="button"
                onClick={addLine}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Add Line Item</span>
              </button>
            </div>

            <div className="space-y-3">
              {lines.map((line, idx) => {
                const baseAmountComputed = (line.amount || 0) * (line.exchangeRate || 1.0);

                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
                  >
                    {/* Direction: Dr / Cr */}
                    <div className="md:col-span-2">
                      <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Direction</label>
                      <div className="grid grid-cols-2 rounded-lg bg-slate-800 p-0.5 border border-slate-700">
                        <button
                          type="button"
                          onClick={() => updateLine(idx, 'direction', 'DEBIT')}
                          className={`py-1 text-xs font-bold rounded-md transition-all ${
                            line.direction === 'DEBIT'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Debit (Dr)
                        </button>
                        <button
                          type="button"
                          onClick={() => updateLine(idx, 'direction', 'CREDIT')}
                          className={`py-1 text-xs font-bold rounded-md transition-all ${
                            line.direction === 'CREDIT'
                              ? 'bg-sky-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Credit (Cr)
                        </button>
                      </div>
                    </div>

                    {/* Account Selector with Inline "+ New Ledger" */}
                    <div className="md:col-span-4">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] uppercase font-semibold text-slate-400">Account</label>
                        <button
                          type="button"
                          onClick={() => openCreateLedgerForLine(idx)}
                          className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-0.5 hover:underline"
                          title="Create new ledger on the go with hierarchy"
                        >
                          <Plus className="w-3 h-3" />
                          <span>+ New Ledger</span>
                        </button>
                      </div>
                      <select
                        required
                        value={line.accountId}
                        onChange={(e) => updateLine(idx, 'accountId', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                      >
                        <option value="">Select posting account...</option>
                        <option value="__CREATE_NEW__" className="text-emerald-400 font-bold bg-slate-900">
                          + [Create New Ledger on the Fly...]
                        </option>
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.code} - {acc.name} ({acc.type})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Currency & FX Rate */}
                    <div className="md:col-span-2">
                      <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Currency & FX</label>
                      <div className="flex gap-1.5">
                        <select
                          value={line.currency}
                          onChange={(e) => updateLine(idx, 'currency', e.target.value)}
                          className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono"
                        >
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                          <option value="GBP">GBP</option>
                          <option value="AED">AED</option>
                          <option value="INR">INR</option>
                          <option value="SGD">SGD</option>
                        </select>
                        <input
                          type="number"
                          step="0.000001"
                          placeholder="Rate"
                          value={line.exchangeRate}
                          onChange={(e) => updateLine(idx, 'exchangeRate', parseFloat(e.target.value) || 1.0)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono text-right"
                          title="Exchange rate to base currency"
                        />
                      </div>
                    </div>

                    {/* Amount Input */}
                    <div className="md:col-span-2">
                      <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">
                        Amount ({line.currency})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        placeholder="0.00"
                        value={line.amount || ''}
                        onChange={(e) => updateLine(idx, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono font-bold text-right focus:border-emerald-500 focus:outline-none"
                      />
                      {line.currency !== activeCompany?.base_currency && (
                        <div className="text-[10px] text-sky-400 text-right mt-0.5 font-mono">
                          = {formatAmount(baseAmountComputed)}
                        </div>
                      )}
                    </div>

                    {/* Tags (#) & Delete */}
                    <div className="md:col-span-2 flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">#Tags</label>
                        <input
                          type="text"
                          placeholder="#1206 #HQ"
                          value={line.tagsText}
                          onChange={(e) => updateLine(idx, 'tagsText', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-emerald-400 font-mono"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        disabled={lines.length <= 2}
                        className="mt-4 p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 disabled:opacity-30 transition-colors"
                        title="Remove line"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Balancing Verification Bar */}
            <div className="mt-6 p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-6 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Total Debits</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {formatAmount(totalDebitsBase)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Total Credits</span>
                  <span className="font-mono font-bold text-sky-400 text-sm">
                    {formatAmount(totalCreditsBase)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Net Variance</span>
                  <span className={`font-mono font-bold text-sm ${Math.abs(variance) < 0.001 ? 'text-slate-400' : 'text-rose-400'}`}>
                    {formatAmount(Math.abs(variance))}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {isBalanced ? (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/60 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Zero-Sum Balanced (&sum; Base = 0)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950 text-rose-300 border border-rose-800/60 text-xs font-bold">
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                    <span>Unbalanced Invariant</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-4 pt-2">
          <Link
            href="/vouchers"
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold text-xs border border-slate-700 transition-all"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || (!isNonFinancial && !isBalanced)}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-700/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{submitting ? 'Posting Ledger...' : isNonFinancial ? 'Record Audit Attestation' : 'Post Journal Voucher'}</span>
          </button>
        </div>
      </form>

      {/* On-The-Fly Create Ledger Modal */}
      {showCreateLedgerModal && (
        <CreateLedgerModal
          companyId={activeCompanyId}
          existingAccounts={allRawAccounts}
          defaultType={creationDefaultType}
          isOpen={showCreateLedgerModal}
          onClose={() => setShowCreateLedgerModal(false)}
          onAccountCreated={handleAccountCreatedOnTheFly}
        />
      )}
    </div>
  );
}

export default function NewVoucherPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-slate-400 text-xs">Loading voucher form...</div>}>
      <VoucherFormContent />
    </Suspense>
  );
}
