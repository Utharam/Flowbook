'use client';

import React, { useState, useEffect } from 'react';
import { useCompany } from '@/components/context/company-context';
import { 
  Boxes, 
  Plus, 
  Building, 
  Laptop, 
  Car, 
  TrendingUp, 
  DollarSign, 
  Layers, 
  Tag, 
  ArrowUpRight, 
  Calendar, 
  FileText 
} from 'lucide-react';
import Link from 'next/link';

export default function AssetClustersPage() {
  const { activeCompany, activeCompanyId, formatAmount } = useCompany();
  const [assets, setAssets] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [newAsset, setNewAsset] = useState({
    name: '',
    asset_code: '',
    category: 'PROPERTY',
    acquisition_date: new Date().toISOString().substring(0, 10),
    purchase_cost: 100000,
    tag: '#',
    cost_account_id: '',
    accumulated_dep_account_id: '',
    depreciation_expense_account_id: '',
    income_account_id: '',
    maintenance_account_id: ''
  });

  const fetchAssets = async () => {
    if (!activeCompanyId) return;
    try {
      setIsLoading(true);
      const [astRes, accRes] = await Promise.all([
        fetch(`/api/assets?companyId=${activeCompanyId}`),
        fetch(`/api/accounts?companyId=${activeCompanyId}`)
      ]);
      const [astData, accData] = await Promise.all([astRes.json(), accRes.json()]);

      if (astData.success) setAssets(astData.assets || []);
      if (accData.success) setAccounts(accData.accounts || []);
    } catch (err) {
      console.error('Failed to load assets:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [activeCompanyId]);

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: activeCompanyId,
          ...newAsset
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        fetchAssets();
      } else {
        alert(`Failed: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
            <Boxes className="w-4 h-4" />
            <span>Asset Lifecycle & Account Clustering</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Fixed Asset Register & Linked Operational Clusters
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Cluster primary capital assets to their operational accounts (Depreciation, Rental Inflows, Maintenance Expenses, and Tag Indexing).
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-700/25 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Register Asset Cluster</span>
        </button>
      </div>

      {/* Asset Clusters List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {assets.map((ast) => (
          <div
            key={ast.id}
            className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-sm space-y-5 hover:border-slate-700 transition-all"
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  {ast.category === 'PROPERTY' ? (
                    <Building className="w-5 h-5" />
                  ) : ast.category === 'VEHICLE' ? (
                    <Car className="w-5 h-5" />
                  ) : (
                    <Laptop className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">{ast.name}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {ast.asset_code}
                    </span>
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                      {ast.category}
                    </span>
                    {ast.tag && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                        {ast.tag}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs text-slate-400">Capital Cost</div>
                <div className="text-base font-bold font-mono text-white">
                  {formatAmount(ast.purchase_cost, ast.currency)}
                </div>
              </div>
            </div>

            {/* Linked Account Cluster Grid */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-2.5">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>Linked Operational Accounts</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                  <div className="text-[10px] text-slate-400">Primary Cost Account</div>
                  <div className="font-mono text-slate-200 truncate">{ast.cost_account_name || '—'}</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                  <div className="text-[10px] text-slate-400">Accumulated Depreciation</div>
                  <div className="font-mono text-slate-200 truncate">{ast.accumulated_dep_name || '—'}</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                  <div className="text-[10px] text-slate-400">Depreciation Expense</div>
                  <div className="font-mono text-slate-200 truncate">{ast.dep_expense_name || '—'}</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                  <div className="text-[10px] text-slate-400">Rental / Lease Income</div>
                  <div className="font-mono text-emerald-400 truncate">{ast.income_account_name || '—'}</div>
                </div>
              </div>
            </div>

            {/* Live Financial Performance (From Tag indexing) */}
            <div className="grid grid-cols-3 gap-3 text-xs pt-1">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Revenue</div>
                <div className="font-mono font-bold text-emerald-400 text-sm mt-1">
                  {formatAmount(ast.total_income || 0)}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Maintenance/Exp</div>
                <div className="font-mono font-bold text-rose-400 text-sm mt-1">
                  {formatAmount(ast.total_expenses || 0)}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Net Yield</div>
                <div className="font-mono font-bold text-sky-400 text-sm mt-1">
                  {formatAmount(ast.net_yield || 0)}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80 text-slate-400">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Acquired: {ast.acquisition_date}</span>
              </div>
              {ast.tag && (
                <Link
                  href={`/reports/tag-matrix?tag=${encodeURIComponent(ast.tag)}`}
                  className="text-emerald-400 hover:underline flex items-center gap-1 text-[11px] font-medium"
                >
                  <span>View Mini-P&L</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Asset Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-white">Register Capital Asset Cluster</h3>
            <form onSubmit={handleCreateAsset} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Asset Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Unit #1206 Tower"
                    value={newAsset.name}
                    onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Asset Code</label>
                  <input
                    type="text"
                    required
                    placeholder="AST-PROP-1206"
                    value={newAsset.asset_code}
                    onChange={(e) => setNewAsset({ ...newAsset, asset_code: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Category</label>
                  <select
                    value={newAsset.category}
                    onChange={(e) => setNewAsset({ ...newAsset, category: e.target.value as any })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="PROPERTY">Property / Building</option>
                    <option value="EQUIPMENT">IT / Servers</option>
                    <option value="VEHICLE">Vehicles</option>
                    <option value="FURNITURE">Furniture</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Purchase Cost</label>
                  <input
                    type="number"
                    required
                    value={newAsset.purchase_cost}
                    onChange={(e) => setNewAsset({ ...newAsset, purchase_cost: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Dimension #Tag</label>
                  <input
                    type="text"
                    placeholder="#1206"
                    value={newAsset.tag}
                    onChange={(e) => setNewAsset({ ...newAsset, tag: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-emerald-400 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="text-[11px] font-semibold text-slate-300">Cluster Account Mapping:</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Capital Cost Account</label>
                    <select
                      value={newAsset.cost_account_id}
                      onChange={(e) => setNewAsset({ ...newAsset, cost_account_id: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    >
                      <option value="">Select account...</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Accumulated Depreciation</label>
                    <select
                      value={newAsset.accumulated_dep_account_id}
                      onChange={(e) => setNewAsset({ ...newAsset, accumulated_dep_account_id: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    >
                      <option value="">Select account...</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Lease / Rental Income</label>
                    <select
                      value={newAsset.income_account_id}
                      onChange={(e) => setNewAsset({ ...newAsset, income_account_id: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    >
                      <option value="">Select account...</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Maintenance / Utility Exp</label>
                    <select
                      value={newAsset.maintenance_account_id}
                      onChange={(e) => setNewAsset({ ...newAsset, maintenance_account_id: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    >
                      <option value="">Select account...</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                >
                  Save Asset Cluster
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
