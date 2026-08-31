'use client';

import React, { useState } from 'react';
import { 
  Layers, 
  Plus, 
  Trash2, 
  ChevronRight, 
  FolderPlus, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  X
} from 'lucide-react';
import { AccountType } from '@/lib/db/schema';

interface CreateLedgerModalProps {
  companyId: string;
  existingAccounts: any[];
  defaultType?: AccountType;
  initialName?: string;
  isOpen: boolean;
  onClose: () => void;
  onAccountCreated: (createdAccount: any) => void;
}

export function CreateLedgerModal({
  companyId,
  existingAccounts,
  defaultType = 'EXPENSE',
  initialName = '',
  isOpen,
  onClose,
  onAccountCreated
}: CreateLedgerModalProps) {
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState('');
  const [type, setType] = useState<AccountType>(defaultType);
  const [selectedParentId, setSelectedParentId] = useState<string>('');
  
  // On-the-fly parent hierarchy chain
  // e.g. ["Indirect Expenses", "Administration Expenses"]
  const [customHierarchyChain, setCustomHierarchyChain] = useState<string[]>([]);
  const [newGroupInput, setNewGroupInput] = useState<string>('');
  const [isGroup, setIsGroup] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filter groups matching selected type
  const groupAccounts = existingAccounts.filter(
    (a) => a.is_group === 1 && a.type === type
  );

  const handleAddHierarchyLevel = () => {
    if (!newGroupInput.trim()) return;
    setCustomHierarchyChain([...customHierarchyChain, newGroupInput.trim()]);
    setNewGroupInput('');
  };

  const handleRemoveHierarchyLevel = (idx: number) => {
    setCustomHierarchyChain(customHierarchyChain.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a ledger name.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const chainPayload = customHierarchyChain.map((grpName) => ({
        name: grpName,
        is_group: true
      }));

      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          name: name.trim(),
          code: code.trim() || undefined,
          type,
          parent_id: selectedParentId || undefined,
          is_group: isGroup,
          hierarchy_chain: chainPayload.length > 0 ? chainPayload : undefined
        })
      });

      const data = await res.json();
      if (data.success && data.account) {
        onAccountCreated(data.account);
        onClose();
      } else {
        setError(data.error || 'Failed to create account');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Find selected parent label for breadcrumbs
  const parentAcc = existingAccounts.find((a) => a.id === selectedParentId);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Create Ledger on the Go</h3>
              <p className="text-[11px] text-slate-400">Instantly create accounts & multi-level parent groups on the fly.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Category / Primary Head */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Primary Accounting Head (Type) *</label>
            <div className="grid grid-cols-5 gap-1 rounded-xl bg-slate-950 p-1 border border-slate-800">
              {(['EXPENSE', 'REVENUE', 'ASSET', 'LIABILITY', 'EQUITY'] as AccountType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setType(t);
                    setSelectedParentId('');
                  }}
                  className={`py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                    type === t
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Ledger Name & Optional Code */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-slate-300 font-semibold mb-1">Ledger Name *</label>
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. Office Expenses, Software Subscriptions..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Code (Optional)</label>
              <input
                type="text"
                placeholder="Auto-assigned"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-slate-500"
              />
            </div>
          </div>

          {/* Under: Existing Parent Group */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Under (Existing Group / Parent Head)</label>
            <select
              value={selectedParentId}
              onChange={(e) => setSelectedParentId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="">Top Level Primary Head ({type})</option>
              {groupAccounts.map((grp) => (
                <option key={grp.id} value={grp.id}>
                  {grp.code} - {grp.name} (Path: {grp.path})
                </option>
              ))}
            </select>
          </div>

          {/* Multi-Level On-The-Fly Hierarchy Chain */}
          <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                <FolderPlus className="w-3.5 h-3.5" />
                <span>Create Multi-Level Parent Chain (On the Fly)</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400">
              Need intermediate sub-groups (e.g. <em>Indirect Expenses &gt; Administration Expenses</em>)? Add them here in one shot:
            </p>

            {/* Added Hierarchy Chain Pills */}
            {customHierarchyChain.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-[10px] font-mono text-slate-400">
                  {parentAcc ? parentAcc.name : type}
                </span>
                {customHierarchyChain.map((level, idx) => (
                  <React.Fragment key={idx}>
                    <ChevronRight className="w-3 h-3 text-slate-600" />
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded">
                      <span>{level}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveHierarchyLevel(idx)}
                        className="hover:text-rose-400 ml-1"
                      >
                        &times;
                      </button>
                    </span>
                  </React.Fragment>
                ))}
                <ChevronRight className="w-3 h-3 text-slate-600" />
                <span className="text-[11px] font-bold text-white font-mono underline decoration-emerald-500">
                  {name || 'New Ledger'}
                </span>
              </div>
            )}

            {/* Input to add next level */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="e.g. Indirect Expenses, Administration Expenses..."
                value={newGroupInput}
                onChange={(e) => setNewGroupInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddHierarchyLevel();
                  }
                }}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={handleAddHierarchyLevel}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>+ Add Group Level</span>
              </button>
            </div>
          </div>

          {/* Group Folder Switch */}
          <div className="flex items-center justify-between p-2.5 bg-slate-800/40 rounded-xl border border-slate-800">
            <div>
              <div className="text-xs font-semibold text-slate-300">Is this a Summary Group Header?</div>
              <div className="text-[10px] text-slate-500">Leave unchecked for normal posting ledgers (Dr/Cr).</div>
            </div>
            <input
              type="checkbox"
              checked={isGroup}
              onChange={(e) => setIsGroup(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md shadow-emerald-700/20 transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{submitting ? 'Creating Hierarchy...' : 'Create & Select Ledger'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
