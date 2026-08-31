'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCompany } from '@/components/context/company-context';
import { 
  Receipt, 
  Plus, 
  Search, 
  RotateCcw, 
  ShieldCheck, 
  CheckCircle2, 
  Tag, 
  Calendar, 
  FileSpreadsheet, 
  Filter 
} from 'lucide-react';

export default function VouchersDaybookPage() {
  const { activeCompany, activeCompanyId, formatAmount } = useCompany();
  const [entries, setEntries] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [reversingId, setReversingId] = useState<string | null>(null);

  const fetchEntries = async () => {
    if (!activeCompanyId) return;
    try {
      setIsLoading(true);
      let url = `/api/journal?companyId=${activeCompanyId}`;
      if (selectedTag) url += `&tag=${encodeURIComponent(selectedTag)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setEntries(data.entries || []);
      }
    } catch (err) {
      console.error('Failed to load daybook:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [activeCompanyId, selectedTag]);

  const handleMirrorReversal = async (entryId: string, entryNumber: string) => {
    if (!confirm(`Confirm 1-Click Mirror Reversal for ${entryNumber}? This will post an exact offsetting entry in the ledger.`)) {
      return;
    }
    try {
      setReversingId(entryId);
      const res = await fetch('/api/journal/reverse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: activeCompanyId,
          entryId,
          reversalDate: new Date().toISOString().substring(0, 10),
          reversalMemo: `Mirror Reversal of ${entryNumber}`
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Mirror Reversal posted: ${data.entry.entry_number}`);
        fetchEntries();
      } else {
        alert(`Reversal failed: ${data.errors?.join(', ') || data.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setReversingId(null);
    }
  };

  const filteredEntries = entries.filter((e) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      e.entry_number.toLowerCase().includes(term) ||
      (e.memo && e.memo.toLowerCase().includes(term)) ||
      (e.reference && e.reference.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
            <Receipt className="w-4 h-4" />
            <span>General Ledger & Voucher Daybook</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Journal Entries & Audit Immutability Log
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Zero-Sum double-entry log with multi-currency lines, dimensional tags, and 1-click mirror reversals.
          </p>
        </div>

        <Link
          href="/vouchers/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-700/25 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Journal Voucher</span>
        </Link>
      </div>

      {/* Filter Controls */}
      <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search voucher #, memo, reference..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl">
            <Tag className="w-3.5 h-3.5 text-emerald-400" />
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
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

        <div className="text-xs text-slate-400">
          Showing <span className="text-white font-bold">{filteredEntries.length}</span> recorded vouchers
        </div>
      </div>

      {/* Vouchers Table */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Voucher No</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Particulars & Line Breakdown</th>
                <th className="py-3 px-4">Tags (#)</th>
                <th className="py-3 px-4 text-right">Debit / Credit Base ({activeCompany?.base_currency})</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Audit Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredEntries.map((entry) => {
                const isReversal = entry.is_reversal === 1;
                const isNonFinancial = entry.is_non_financial === 1;
                const lines = entry.lines || [];

                return (
                  <tr key={entry.id} className="hover:bg-slate-850/50 transition-colors align-top">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-200 whitespace-nowrap">
                      {entry.entry_number}
                      {entry.reference && (
                        <div className="text-[10px] text-slate-500 font-mono font-normal">
                          Ref: {entry.reference}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap font-mono">
                      {entry.entry_date}
                    </td>
                    <td className="py-3.5 px-4 max-w-md">
                      <div className="font-semibold text-slate-100 mb-1.5">
                        {entry.memo || 'Voucher transaction'}
                      </div>
                      
                      {/* Detailed Line Items */}
                      <div className="space-y-1 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-[11px]">
                        {lines.map((l: any, lIdx: number) => {
                          const isDr = l.amount < 0;
                          return (
                            <div key={lIdx} className="flex items-center justify-between gap-4 font-mono">
                              <span className="text-slate-300 truncate">
                                {isDr ? 'Dr. ' : '    Cr. '}{l.account_code} - {l.account_name}
                                {l.currency !== activeCompany?.base_currency && (
                                  <span className="text-sky-400 text-[10px] ml-1.5">
                                    ({Math.abs(l.foreign_amount)} {l.currency} @ {l.exchange_rate})
                                  </span>
                                )}
                              </span>
                              <span className={isDr ? 'text-emerald-400 font-semibold' : 'text-slate-300'}>
                                {formatAmount(Math.abs(l.amount))}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        {lines.flatMap((l: any) => {
                          try { return JSON.parse(l.tags || '[]'); } catch { return []; }
                        }).filter((v: any, i: number, a: any[]) => a.indexOf(v) === i).map((tag: string, tIdx: number) => (
                          <span key={tIdx} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-100 whitespace-nowrap">
                      {isNonFinancial ? (
                        <span className="text-slate-500 italic font-sans font-normal text-[11px]">Non-Financial Attestation</span>
                      ) : (
                        formatAmount(
                          lines.filter((l: any) => l.amount < 0).reduce((s: number, l: any) => s + Math.abs(l.amount), 0)
                        )
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {isNonFinancial ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-950 text-sky-400 border border-sky-800/50">
                          <CheckCircle2 className="w-3 h-3" /> Attestation
                        </span>
                      ) : isReversal ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800/50">
                          <RotateCcw className="w-3 h-3" /> Reversal
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                          <ShieldCheck className="w-3 h-3" /> Balanced
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      {!isReversal && !isNonFinancial && (
                        <button
                          onClick={() => handleMirrorReversal(entry.id, entry.entry_number)}
                          disabled={reversingId === entry.id}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-300 text-[11px] font-medium border border-slate-700 hover:border-rose-800/60 transition-all shadow-sm"
                        >
                          {reversingId === entry.id ? 'Reversing...' : '1-Click Reverse'}
                        </button>
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
  );
}
