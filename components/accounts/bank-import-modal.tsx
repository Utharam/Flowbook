'use client';

import React, { useState } from 'react';
import { 
  Upload, 
  Download, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  X, 
  ArrowRight, 
  Sparkles,
  Building2,
  Tag,
  Check
} from 'lucide-react';
import { useCompany } from '@/components/context/company-context';
import { BankImportValidationResult } from '@/lib/engine/bank-import';

interface BankImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: any;
  onSuccess: () => void;
}

export function BankImportModal({ isOpen, onClose, account, onSuccess }: BankImportModalProps) {
  const { activeCompanyId, formatAmount } = useCompany();
  const [fileContent, setFileContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [validationResult, setValidationResult] = useState<BankImportValidationResult | null>(null);
  const [activeTab, setActiveTab] = useState<'UPLOAD' | 'PREVIEW'>('UPLOAD');

  if (!isOpen || !account) return null;

  // 1. Download CSV Template
  const handleDownloadTemplate = () => {
    window.open(`/api/reconciliation?companyId=${activeCompanyId}&accountId=${account.id}&action=template`, '_blank');
  };

  // 2. Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      setFileContent(content);
      await validateContent(content);
    };
    reader.readAsText(file);
  };

  // 3. Validate File Content
  const validateContent = async (content: string) => {
    if (!content.trim() || !activeCompanyId) return;
    try {
      setIsValidating(true);
      const res = await fetch('/api/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'VALIDATE',
          companyId: activeCompanyId,
          accountId: account.id,
          fileContent: content
        })
      });

      const data = await res.json();
      if (data.success) {
        setValidationResult(data);
        setActiveTab('PREVIEW');
      } else {
        alert(`Validation Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error during validation: ${err.message}`);
    } finally {
      setIsValidating(false);
    }
  };

  // 4. Post Batch Entries
  const handlePostBatch = async () => {
    if (!validationResult || !validationResult.valid || !activeCompanyId) return;

    try {
      setIsPosting(true);
      const res = await fetch('/api/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'POST_BATCH',
          companyId: activeCompanyId,
          accountId: account.id,
          validatedRows: validationResult.parsedRows
        })
      });

      const data = await res.json();
      if (data.success) {
        alert(data.message || 'Bank statement batch posted successfully!');
        onSuccess();
        onClose();
      } else {
        alert(`Batch posting failed: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  Smart Bank Statement & Batch Importer
                </h3>
                <span className="px-2 py-0.2 rounded bg-emerald-950 text-emerald-400 text-[10px] font-bold border border-emerald-800/60 font-mono">
                  {account.code} - {account.name}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Reconciled Till Date: <strong className="text-slate-200">{account.last_reconciled_date || 'Inception'}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900/90 text-xs px-4 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('UPLOAD')}
            className={`pb-2 px-4 font-bold border-b-2 transition-all ${
              activeTab === 'UPLOAD'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            1. Template & Upload
          </button>

          <button
            type="button"
            onClick={() => validationResult && setActiveTab('PREVIEW')}
            disabled={!validationResult}
            className={`pb-2 px-4 font-bold border-b-2 transition-all ${
              activeTab === 'PREVIEW'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200 disabled:opacity-40'
            }`}
          >
            2. Dry-Run Validation & Preview {validationResult ? `(${validationResult.parsedRows.length} rows)` : ''}
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* TAB 1: TEMPLATE & UPLOAD */}
          {activeTab === 'UPLOAD' && (
            <div className="space-y-4">
              {/* Step 1 Box: Download Template */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>Step 1: Download Reconciled Template</span>
                  </span>
                  <p className="text-slate-400 text-xs">
                    Get the customized CSV template containing your bank account ID, reconciled date barrier, and sample format.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-emerald-400 hover:text-emerald-300 font-bold border border-slate-700 transition-all shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Template (.csv)</span>
                </button>
              </div>

              {/* Step 2 Box: Upload / Dropzone */}
              <div className="p-6 rounded-2xl bg-slate-950 border-2 border-dashed border-slate-800 hover:border-emerald-500/50 transition-colors flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>

                <div>
                  <h4 className="text-sm font-bold text-white">Upload Populated Bank Statement CSV</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Select the completed spreadsheet or CSV file to run the multi-stage validation engine.
                  </p>
                </div>

                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-700/20 transition-all">
                    <span>Choose File from Computer</span>
                  </span>
                </label>

                {fileName && (
                  <span className="font-mono text-xs text-slate-300 bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
                    Selected: {fileName}
                  </span>
                )}
              </div>

              {/* Paste Direct CSV Option */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300">Or Paste Raw CSV Data Directly:</span>
                  <button
                    type="button"
                    onClick={() => validateContent(fileContent)}
                    disabled={!fileContent.trim() || isValidating}
                    className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] disabled:opacity-40"
                  >
                    {isValidating ? 'Validating...' : 'Validate Pasted Content →'}
                  </button>
                </div>

                <textarea
                  rows={4}
                  placeholder={`Date,Reference,Counter_Ledger,Narration,Amount,Tags\n2026-02-05,NEFT-1002,4100,Customer Consulting Invoice,15000.00,#Sales\n2026-02-10,CHQ-8891,5200,Office Rent Payment,-4000.00,#HQ`}
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* TAB 2: DRY-RUN VALIDATION & PREVIEW */}
          {activeTab === 'PREVIEW' && validationResult && (
            <div className="space-y-4">
              {/* Reconciliation Mathematical Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-sans font-semibold block">Opening Reconciled Bal</span>
                  <strong className="text-slate-200 text-sm block mt-0.5">
                    {formatAmount(validationResult.metadata.openingBalance)}
                  </strong>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-emerald-400 uppercase font-sans font-semibold block">Total Deposits (+)</span>
                  <strong className="text-emerald-300 text-sm block mt-0.5">
                    +{formatAmount(validationResult.metadata.totalInflows)}
                  </strong>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-sky-400 uppercase font-sans font-semibold block">Total Withdrawals (-)</span>
                  <strong className="text-sky-300 text-sm block mt-0.5">
                    -{formatAmount(validationResult.metadata.totalOutflows)}
                  </strong>
                </div>

                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-700/60 shadow-sm">
                  <span className="text-[10px] text-emerald-300 uppercase font-sans font-bold block">Computed Ending Bal</span>
                  <strong className="text-emerald-400 text-sm block mt-0.5">
                    {formatAmount(validationResult.metadata.computedEndingBalance)}
                  </strong>
                </div>
              </div>

              {/* Warnings / Target Balance Match */}
              {validationResult.metadata.targetStatementBalance !== null && (
                <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                  (validationResult.metadata.variance || 0) < 0.001
                    ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
                    : 'bg-amber-950/80 border-amber-800 text-amber-300'
                }`}>
                  <div className="flex items-center gap-2">
                    {(validationResult.metadata.variance || 0) < 0.001 ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                    <span>
                      Target Bank Statement Balance: <strong className="font-mono">{formatAmount(validationResult.metadata.targetStatementBalance || 0)}</strong>
                    </span>
                  </div>

                  <span className="font-mono font-bold">
                    {(validationResult.metadata.variance || 0) < 0.001
                      ? '✓ 100% Exact Math Match (0.00 Variance)'
                      : `Variance: ${formatAmount(validationResult.metadata.variance || 0)}`}
                  </span>
                </div>
              )}

              {/* Validation Errors Box (if any) */}
              {validationResult.errors.length > 0 && (
                <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-rose-200">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>Validation Blockers ({validationResult.errors.length}) — Must be resolved before posting:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-xs text-rose-300/90 pl-1 font-mono">
                    {validationResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Parsed Rows Preview Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                <div className="p-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200">
                    Parsed Journal Vouchers ({validationResult.parsedRows.length} Rows)
                  </span>
                  <span className="text-slate-400 font-mono">
                    {validationResult.valid ? '✓ Ready to post atomically' : '❌ Contains validation errors'}
                  </span>
                </div>

                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-semibold border-b border-slate-800 sticky top-0">
                      <tr>
                        <th className="py-2 px-3 w-12">#</th>
                        <th className="py-2 px-3 w-24">Date</th>
                        <th className="py-2 px-3 w-28">Reference</th>
                        <th className="py-2 px-3">Counter Ledger (Contra)</th>
                        <th className="py-2 px-3">Narration / Memo</th>
                        <th className="py-2 px-3 text-right w-24">Debit (Inflow)</th>
                        <th className="py-2 px-3 text-right w-24">Credit (Outflow)</th>
                        <th className="py-2 px-3 w-20">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {validationResult.parsedRows.map((row) => {
                        const hasError = !!row.error;

                        return (
                          <tr key={row.rowNumber} className={hasError ? 'bg-rose-950/20 text-rose-300' : 'hover:bg-slate-900/40 text-slate-200'}>
                            <td className="py-2 px-3 text-slate-500">{row.rowNumber}</td>
                            <td className="py-2 px-3 whitespace-nowrap">{row.date}</td>
                            <td className="py-2 px-3 text-slate-400">{row.reference || '—'}</td>
                            <td className="py-2 px-3 font-sans">
                              {row.counterAccountCode ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-emerald-400 font-bold">{row.counterAccountCode}</span>
                                  <span className="text-slate-100 truncate max-w-[140px]">{row.counterAccountName}</span>
                                </div>
                              ) : (
                                <span className="text-rose-400 font-bold">Unresolved</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-slate-300 truncate max-w-[180px] font-sans">
                              {row.narration}
                            </td>
                            <td className="py-2 px-3 text-right font-semibold text-emerald-400 whitespace-nowrap">
                              {row.debit > 0 ? formatAmount(row.debit) : '—'}
                            </td>
                            <td className="py-2 px-3 text-right font-semibold text-sky-400 whitespace-nowrap">
                              {row.credit > 0 ? formatAmount(row.credit) : '—'}
                            </td>
                            <td className="py-2 px-3">
                              {hasError ? (
                                <span className="px-1.5 py-0.2 rounded bg-rose-950 text-rose-400 text-[10px] font-bold border border-rose-800/60">
                                  Error
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 text-[10px] font-bold border border-emerald-800/60">
                                  Valid
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-750 font-medium"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            {activeTab === 'PREVIEW' && (
              <button
                type="button"
                onClick={() => setActiveTab('UPLOAD')}
                className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium"
              >
                ← Back to Upload
              </button>
            )}

            <button
              type="button"
              onClick={handlePostBatch}
              disabled={!validationResult?.valid || isPosting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-700/20 transition-all disabled:opacity-50"
            >
              {isPosting ? (
                <span>Posting Atomic Vouchers...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>
                    Confirm & Post Batch {validationResult ? `(${validationResult.metadata.validRowCount} Entries)` : ''}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
