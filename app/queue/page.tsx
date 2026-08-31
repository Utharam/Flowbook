'use client';

import React, { useState, useEffect } from 'react';
import { useCompany } from '@/components/context/company-context';
import { 
  AlertCircle, 
  Play, 
  CheckCircle2, 
  XCircle, 
  ShieldAlert, 
  Building, 
  Receipt, 
  Sparkles, 
  RefreshCw, 
  Clock 
} from 'lucide-react';
import Link from 'next/link';

export default function ActionQueuePage() {
  const { activeCompanyId, formatAmount } = useCompany();
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchQueue = async () => {
    if (!activeCompanyId) return;
    try {
      setIsLoading(true);
      const res = await fetch(`/api/queue?companyId=${activeCompanyId}`);
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
      }
    } catch (err) {
      console.error('Failed to load queue:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [activeCompanyId]);

  const handleRunScan = async () => {
    try {
      setIsScanning(true);
      const res = await fetch('/api/queue/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: activeCompanyId })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Inactivity Scan Completed! Found ${data.new_alerts_count} new alerts.`);
        fetchQueue();
      } else {
        alert(`Scan error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error running scan: ${err.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleAction = async (id: string, action: 'DISMISS' | 'APPROVE_MIRROR' | 'APPROVE') => {
    try {
      setProcessingId(id);
      const res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, companyId: activeCompanyId })
      });
      const data = await res.json();
      if (data.success) {
        if (data.message) alert(data.message);
        fetchQueue();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const pendingItems = items.filter(i => i.status === 'PENDING');
  const resolvedItems = items.filter(i => i.status !== 'PENDING');

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
            <AlertCircle className="w-4 h-4" />
            <span>Audit Automation Engine</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Action Queue & Inactivity Scrutiny
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Automated month-end scanner detecting missing recurring expenses, dormant bank accounts, and intercompany mirror drafts.
          </p>
        </div>

        <button
          onClick={handleRunScan}
          disabled={isScanning}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-700/25 transition-all self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
          <span>{isScanning ? 'Scanning Ledger...' : 'Run Inactivity & Anomaly Scan'}</span>
        </button>
      </div>

      {/* Pending Items Section */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <span>Pending Action Required</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-950 text-amber-400 border border-amber-800/50 font-mono">
            {pendingItems.length}
          </span>
        </h2>

        {pendingItems.length === 0 ? (
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <p className="font-semibold text-slate-200">No Pending Queue Items</p>
            <p className="text-slate-500 mt-0.5">All recurring operational bills and intercompany drafts are up to date.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingItems.map((item) => {
              const meta = item.metadata || {};

              return (
                <div
                  key={item.id}
                  className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-slate-700 transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800/50 font-bold">
                          {item.type}
                        </span>
                        <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3" /> {item.created_at}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white tracking-tight">
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-400 max-w-2xl">
                        {item.description}
                      </p>

                      {/* Intercompany Mirror Draft Payload */}
                      {item.type === 'INTERCOMPANY_MIRROR' && meta.proposed_amount && (
                        <div className="mt-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono flex items-center gap-4 text-slate-300">
                          <span>Amount: <strong className="text-emerald-400">{formatAmount(meta.proposed_amount)}</strong></span>
                          <span>Memo: <strong className="text-white">{meta.memo}</strong></span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    {item.type === 'INTERCOMPANY_MIRROR' ? (
                      <button
                        onClick={() => handleAction(item.id, 'APPROVE_MIRROR')}
                        disabled={processingId === item.id}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>Approve & Post Mirror Voucher</span>
                      </button>
                    ) : item.type === 'ATTESTATION_DUE' ? (
                      <Link
                        href="/vouchers/new"
                        className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Record Attestation</span>
                      </Link>
                    ) : (
                      <Link
                        href="/vouchers/new"
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>Create Voucher</span>
                      </Link>
                    )}

                    <button
                      onClick={() => handleAction(item.id, 'DISMISS')}
                      disabled={processingId === item.id}
                      className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors"
                      title="Dismiss alert"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Resolved History */}
      {resolvedItems.length > 0 && (
        <div className="space-y-3 pt-6 border-t border-slate-800">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Resolved / Processed Queue History
          </h2>
          <div className="space-y-2">
            {resolvedItems.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs text-slate-400"
              >
                <div>
                  <span className="font-semibold text-slate-300">{item.title}</span>
                  <span className="text-[11px] text-slate-500 ml-2">({item.created_at})</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
