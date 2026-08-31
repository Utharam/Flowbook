'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Sparkles, 
  Layers, 
  Calendar, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Send, 
  ArrowRight, 
  Plus, 
  ShieldCheck,
  X
} from 'lucide-react';
import { FlowTemplate, Company, Account } from '@/lib/db/schema';
import { useCompany } from '@/components/context/company-context';
import { CreateLedgerModal } from '@/components/accounts/create-ledger-modal';

interface FlowLauncherModalProps {
  template: FlowTemplate;
  company: Company;
  accounts: Account[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function FlowLauncherModal({
  template,
  company,
  accounts,
  isOpen,
  onClose,
  onSuccess
}: FlowLauncherModalProps) {
  const router = useRouter();
  const { formatAmount } = useCompany();

  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [amount, setAmount] = useState<number>(1000);
  const [currency, setCurrency] = useState<string>(company.base_currency || 'USD');
  const [purpose, setPurpose] = useState<string>('');
  const [documentNo, setDocumentNo] = useState<string>('');
  const [documentDate, setDocumentDate] = useState<string>(new Date().toISOString().substring(0, 10));

  // Variable ledger mappings: key -> accountId
  const initialVars: Record<string, string> = {};
  (template.variables || []).forEach((v) => {
    initialVars[v.key] = v.default_account_id || '';
  });
  const [variableSelections, setVariableSelections] = useState<Record<string, string>>(initialVars);

  // On-the-fly ledger creation
  const [showCreateLedger, setShowCreateLedger] = useState(false);
  const [activeVarKeyForCreation, setActiveVarKeyForCreation] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  if (!isOpen) return null;

  // Text interpolation helper
  const interpolate = (str: string = '') => {
    return str
      .replace(/\{purpose\}/g, purpose.trim() || '(purpose)')
      .replace(/\{document_no\}/g, documentNo.trim() || '(document no)')
      .replace(/\{document_date\}/g, documentDate || '(document date)')
      .replace(/\{invoice_date\}/g, documentDate || '(invoice date)')
      .replace(/\{amount\}/g, formatAmount(amount));
  };

  const getAccountById = (accId?: string) => {
    return accounts.find((a) => a.id === accId);
  };

  const resolveLineAccount = (line: any) => {
    if (line.account_mode === 'CONSTANT') {
      return getAccountById(line.account_id);
    }
    if (line.account_mode === 'VARIABLE' && line.variable_key) {
      const selectedId = variableSelections[line.variable_key];
      return getAccountById(selectedId);
    }
    return null;
  };

  // Build resolved batch entries payload
  const buildBatchEntries = () => {
    return (template.steps || []).map((step) => {
      const lines = step.lines.map((l) => {
        const resolvedAcc = resolveLineAccount(l);
        return {
          accountId: resolvedAcc?.id || '',
          accountCode: resolvedAcc?.code || '',
          accountName: resolvedAcc?.name || '',
          currency,
          debit: l.direction === 'DEBIT' ? amount : undefined,
          credit: l.direction === 'CREDIT' ? amount : undefined,
          memo: interpolate(l.memo_template || step.narration_template),
          tags: [...(template.default_tags || []), ...(l.default_tags || [])]
        };
      });

      return {
        companyId: company.id,
        entryDate,
        memo: interpolate(step.narration_template),
        reference: interpolate(step.reference_template || documentNo),
        lines
      };
    });
  };

  const batchEntries = buildBatchEntries();

  // Validate that all variable accounts are selected
  const missingVars = (template.variables || []).filter((v) => !variableSelections[v.key]);
  const isValid = missingVars.length === 0 && amount > 0 && purpose.trim() !== '' && documentNo.trim() !== '';

  const handleAccountCreatedOnTheFly = (createdAccount: any) => {
    setVariableSelections((prev) => ({
      ...prev,
      [activeVarKeyForCreation]: createdAccount.id
    }));
  };

  // 1. Send to Action Queue
  const handleSendToQueue = async () => {
    try {
      setSubmitting(true);
      setStatusMessage(null);

      const res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'QUEUE_BATCH',
          companyId: company.id,
          batchPayload: {
            template_id: template.id,
            template_name: template.name,
            purpose,
            document_no: documentNo,
            amount,
            currency,
            entries: batchEntries
          }
        })
      });

      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: 'success', text: 'Batch entries sent to Action Queue for approval!' });
        setTimeout(() => {
          onClose();
          router.push('/queue');
        }, 1000);
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to queue batch' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Post Directly to Books
  const handlePostDirectly = async () => {
    try {
      setSubmitting(true);
      setStatusMessage(null);

      for (let i = 0; i < batchEntries.length; i++) {
        const entry = batchEntries[i];
        const res = await fetch('/api/journal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry)
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(`Step ${i + 1} failed: ${data.errors?.join(', ') || data.error}`);
        }
      }

      setStatusMessage({ type: 'success', text: `Successfully posted ${batchEntries.length} vouchers to the ledger!` });
      setTimeout(() => {
        onClose();
        if (onSuccess) onSuccess();
        router.push('/vouchers');
      }, 1000);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 space-y-6 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-600/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                  {template.category}
                </span>
                <span className="text-xs text-slate-400">
                  {template.steps?.length || 0} Sequential Vouchers
                </span>
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight">{template.name}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
                : 'bg-rose-950/80 border-rose-800 text-rose-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Form Inputs Grid */}
        <div className="bg-slate-950/80 border border-slate-800 p-5 rounded-2xl space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            1. Flow Input Parameters
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">Posting Date</label>
              <input
                type="date"
                required
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">Amount ({currency})</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={amount || ''}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">Document Date</label>
              <input
                type="date"
                required
                value={documentDate}
                onChange={(e) => setDocumentDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">Document / Invoice No *</label>
              <input
                type="text"
                required
                placeholder="e.g. INV-2026-0042 / CHQ-9901"
                value={documentNo}
                onChange={(e) => setDocumentNo(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-slate-300 font-semibold mb-1.5">Purpose / Particulars *</label>
              <input
                type="text"
                required
                placeholder="e.g. Consulting Advisory & Cloud Architecture Services"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Dynamic Variable Ledgers Selector */}
          {(template.variables || []).length > 0 && (
            <div className="pt-3 border-t border-slate-800/80 space-y-3">
              <h4 className="text-xs font-bold text-emerald-400">Select Variable Ledger(s)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(template.variables || []).map((variable) => (
                  <div key={variable.key}>
                    <div className="flex items-center justify-between mb-1.5 text-xs">
                      <label className="font-semibold text-slate-300">{variable.label}</label>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveVarKeyForCreation(variable.key);
                          setShowCreateLedger(true);
                        }}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 hover:underline font-bold"
                      >
                        <Plus className="w-3 h-3" />
                        <span>+ New Ledger</span>
                      </button>
                    </div>
                    <select
                      required
                      value={variableSelections[variable.key] || ''}
                      onChange={(e) =>
                        setVariableSelections({ ...variableSelections, [variable.key]: e.target.value })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="">Select account...</option>
                      {accounts
                        .filter((a) => a.is_group === 0)
                        .map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.code} - {acc.name} ({acc.type})
                          </option>
                        ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Live Generated Vouchers Preview */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              2. Live Generated Batch Entries Preview ({template.steps?.length || 0} Vouchers)
            </h3>
            <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Zero-Sum Double Entry Invariant Enforced</span>
            </span>
          </div>

          <div className="space-y-4">
            {batchEntries.map((entry, stepIdx) => (
              <div
                key={stepIdx}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center justify-center text-[10px] font-bold">
                      {stepIdx + 1}
                    </span>
                    <span className="text-xs font-bold text-white">
                      {template.steps[stepIdx]?.title || `Entry #${stepIdx + 1}`}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    Ref: {entry.reference}
                  </span>
                </div>

                {/* Resolved Narration */}
                <div className="text-xs text-slate-300 italic bg-slate-900/60 p-2.5 rounded-lg border border-slate-850">
                  <span className="text-slate-500 font-semibold not-italic text-[10px] uppercase block mb-0.5">
                    Narration / Memo:
                  </span>
                  &ldquo;{entry.memo}&rdquo;
                </div>

                {/* Lines Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase text-slate-400 border-b border-slate-800/60">
                        <th className="pb-1.5">Account (Code & Name)</th>
                        <th className="pb-1.5 text-right text-emerald-400">Debit (Dr)</th>
                        <th className="pb-1.5 text-right text-sky-400">Credit (Cr)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/50">
                      {entry.lines.map((l, lIdx) => (
                        <tr key={lIdx}>
                          <td className="py-1.5">
                            {l.accountCode ? (
                              <span className="font-mono text-slate-200">
                                <strong className="text-emerald-400">{l.accountCode}</strong> - {l.accountName}
                              </span>
                            ) : (
                              <span className="text-rose-400 italic">
                                [Variable Account not selected]
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 text-right font-mono font-bold text-emerald-400">
                            {l.debit ? formatAmount(l.debit) : '—'}
                          </td>
                          <td className="py-1.5 text-right font-mono font-bold text-sky-400">
                            {l.credit ? formatAmount(l.credit) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSendToQueue}
              disabled={!isValid || submitting}
              className="px-5 py-2.5 rounded-xl bg-amber-600/90 hover:bg-amber-500 text-white font-bold text-xs shadow-md shadow-amber-600/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              title="Places into Action Queue for accountant/manager approval"
            >
              <Clock className="w-4 h-4" />
              <span>Send to Approval Queue</span>
            </button>

            <button
              type="button"
              onClick={handlePostDirectly}
              disabled={!isValid || submitting}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-700/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              title="Directly and atomically posts all vouchers into the General Ledger"
            >
              <Send className="w-4 h-4" />
              <span>Post Directly to Books</span>
            </button>
          </div>
        </div>
      </div>

      {/* On-the-fly Ledger Creation Modal */}
      {showCreateLedger && (
        <CreateLedgerModal
          companyId={company.id}
          existingAccounts={accounts}
          defaultType="ASSET"
          isOpen={showCreateLedger}
          onClose={() => setShowCreateLedger(false)}
          onAccountCreated={handleAccountCreatedOnTheFly}
        />
      )}
    </div>
  );
}
