'use client';

import React, { useState, useEffect } from 'react';
import { useCompany } from '@/components/context/company-context';
import { 
  Database, 
  Download, 
  Upload, 
  History, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  FileText, 
  Calendar, 
  RefreshCw, 
  Lock, 
  Server,
  FileCheck
} from 'lucide-react';
import { AuditEvent } from '@/lib/db/schema';

export default function BackupPage() {
  const { activeCompany, activeCompanyId, refreshCompanies } = useCompany();
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [filterEventType, setFilterEventType] = useState<string>('ALL');
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);

  // Restore states
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePreview, setRestorePreview] = useState<any>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch Audit Trail Events
  const fetchAuditEvents = async () => {
    try {
      setIsLoadingEvents(true);
      const res = await fetch(`/api/backup?type=audit-events&companyId=ALL`);
      const data = await res.json();
      if (data.success) {
        setAuditEvents(data.events || []);
      }
    } catch (err) {
      console.error('Failed to load audit events:', err);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  useEffect(() => {
    fetchAuditEvents();
  }, [activeCompanyId]);

  // 1. Export Full System Backup
  const handleExportFullBackup = async () => {
    try {
      const res = await fetch('/api/backup?type=full-system');
      const data = await res.json();
      if (data.success) {
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Flowbook_Full_Backup_${new Date().toISOString().substring(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        fetchAuditEvents();
      }
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  // 2. Export Single Entity Snapshot
  const handleExportEntitySnapshot = async () => {
    if (!activeCompanyId) return;
    try {
      const res = await fetch(`/api/backup?type=entity-snapshot&companyId=${activeCompanyId}`);
      const data = await res.json();
      if (data.success) {
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Flowbook_Snapshot_${activeCompany?.legal_name.replace(/\s+/g, '_')}_${new Date().toISOString().substring(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        fetchAuditEvents();
      }
    } catch (err: any) {
      alert(`Snapshot failed: ${err.message}`);
    }
  };

  // 3. Handle File Selection for Restore
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreFile(file);
    setRestoreStatus(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        setRestorePreview(parsed);
      } catch (err) {
        setRestoreStatus({ type: 'error', message: 'Invalid JSON backup file.' });
        setRestorePreview(null);
      }
    };
    reader.readAsText(file);
  };

  // 4. Execute Restore
  const handleExecuteRestore = async () => {
    if (!restorePreview) return;
    if (!window.confirm('WARNING: Restoring from backup will update database records. Ensure you have exported a current backup. Proceed?')) {
      return;
    }

    try {
      setIsRestoring(true);
      setRestoreStatus(null);

      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RESTORE_BACKUP',
          backup_data: restorePreview
        })
      });

      const data = await res.json();
      if (data.success) {
        setRestoreStatus({ type: 'success', message: data.message });
        setRestoreFile(null);
        setRestorePreview(null);
        await refreshCompanies();
        await fetchAuditEvents();
      } else {
        setRestoreStatus({ type: 'error', message: data.error || 'Restore failed' });
      }
    } catch (err: any) {
      setRestoreStatus({ type: 'error', message: err.message });
    } finally {
      setIsRestoring(false);
    }
  };

  const filteredEvents = auditEvents.filter(e => {
    if (filterEventType === 'ALL') return true;
    return e.event_type === filterEventType;
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
          <Database className="w-4 h-4" />
          <span>Disaster Recovery & Audit Governance</span>
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Backup, Restore & Audit Event Trail
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Generate portable full-system or entity snapshots, safely restore from archives, and inspect immutable audit event logs.
        </p>
      </div>

      {/* 1. Export Backups Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Full System Backup Card */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Server className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-white">Full System Backup (.json)</h2>
            <p className="text-xs text-slate-400">
              Exports all registered corporate entities, full Chart of Accounts trees, journal entries, vouchers, flow templates, asset clusters, and cap tables into a single timestamped JSON archive.
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportFullBackup}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-700/25 transition-all flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Download Complete System Backup</span>
          </button>
        </div>

        {/* Single Entity Snapshot Card */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
              <FileCheck className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-white">Active Entity Snapshot (.json)</h2>
            <p className="text-xs text-slate-400">
              Exports an isolated, portable backup of the active book: <strong className="text-emerald-400">{activeCompany?.legal_name}</strong>. Ideal for client handovers or tax auditor exports.
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportEntitySnapshot}
            className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-lg shadow-sky-700/25 transition-all flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Export Snapshot for {activeCompany?.trade_name || 'Active Entity'}</span>
          </button>
        </div>
      </div>

      {/* 2. Restore from Backup Archive */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Upload className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-base font-bold text-white">Restore from Backup Archive</h2>
              <p className="text-xs text-slate-400">Select a verified Flowbook `.json` backup file to restore accounting ledgers.</p>
            </div>
          </div>
        </div>

        {restoreStatus && (
          <div className={`p-4 rounded-xl border text-xs flex items-center gap-2.5 ${
            restoreStatus.type === 'success' ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300' : 'bg-rose-950/80 border-rose-800 text-rose-300'
          }`}>
            {restoreStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
            <span>{restoreStatus.message}</span>
          </div>
        )}

        <div className="p-5 border-2 border-dashed border-slate-700 hover:border-indigo-500/60 rounded-2xl bg-slate-900/50 text-center space-y-3 transition-colors">
          <Upload className="w-8 h-8 text-indigo-400 mx-auto" />
          <div className="text-xs text-slate-300">
            <label className="cursor-pointer text-indigo-400 font-bold hover:underline">
              <span>Choose JSON Backup File</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            <span className="text-slate-500"> or drag and drop</span>
          </div>
          {restoreFile && (
            <div className="text-xs font-mono font-bold text-emerald-400">
              Selected: {restoreFile.name} ({(restoreFile.size / 1024).toFixed(1)} KB)
            </div>
          )}
        </div>

        {/* Pre-Restore Preview Card */}
        {restorePreview && (
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-white border-b border-slate-800 pb-2">
              <span>Backup Payload Verified</span>
              <span className="text-emerald-400 font-mono">Platform: {restorePreview.platform || 'Flowbook'} v{restorePreview.version || '1.0.0'}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Entities</span>
                <strong className="text-white font-mono text-sm">
                  {restorePreview.data?.companies?.length || (restorePreview.company ? 1 : 0)}
                </strong>
              </div>
              <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Accounts</span>
                <strong className="text-white font-mono text-sm">
                  {restorePreview.data?.accounts?.length || restorePreview.accounts?.length || 0}
                </strong>
              </div>
              <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Vouchers</span>
                <strong className="text-white font-mono text-sm">
                  {restorePreview.data?.journal_entries?.length || restorePreview.entries?.length || 0}
                </strong>
              </div>
              <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Flow Templates</span>
                <strong className="text-white font-mono text-sm">
                  {restorePreview.data?.flow_templates?.length || restorePreview.templates?.length || 0}
                </strong>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={isRestoring}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-700/25 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isRestoring ? 'Restoring Books...' : 'Confirm & Execute Restore'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Immutable Financial & Governance Audit Trail */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-bold text-white">System Audit Event History Log</h2>
              <p className="text-xs text-slate-400">Chronological immutable audit log of statutory alterations, lock dates, and backups.</p>
            </div>
          </div>

          {/* Filter Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Filter:</span>
            <select
              value={filterEventType}
              onChange={(e) => setFilterEventType(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
            >
              <option value="ALL">All Event Types</option>
              <option value="COMPANY_CREATED">Company Created</option>
              <option value="PROFILE_ALTERED">Profile Altered</option>
              <option value="BACKUP_GENERATED">Backup Generated</option>
              <option value="BACKUP_RESTORED">Backup Restored</option>
              <option value="BOOKS_LOCKED">Books Locked</option>
              <option value="VOUCHER_POSTED">Voucher Posted</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredEvents.map((evt) => (
                <tr key={evt.id} className="hover:bg-slate-850/40">
                  <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                    {evt.created_at.substring(0, 19).replace('T', ' ')}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border ${
                      evt.event_type.includes('RESTORE') || evt.event_type.includes('ALTERED')
                        ? 'bg-amber-950 text-amber-300 border-amber-800/60'
                        : evt.event_type.includes('BACKUP') || evt.event_type.includes('CREATED')
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800/60'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}>
                      {evt.event_type}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-200 whitespace-nowrap">
                    {evt.actor}
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    {evt.description}
                  </td>
                </tr>
              ))}
              {filteredEvents.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500 text-xs">
                    No audit events recorded in this category.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
