'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useCompany } from '../context/company-context';
import { 
  Building2, 
  Calendar, 
  Lock, 
  Unlock, 
  PlusCircle, 
  Coins, 
  Plus,
  Building,
  CheckCircle2
} from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function Header() {
  const { companies, activeCompany, activeCompanyId, setActiveCompanyId, refreshCompanies } = useCompany();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    legal_name: '',
    trade_name: '',
    jurisdiction: 'India',
    registration_number: '',
    tax_identifier: '',
    company_type: 'PVT_LTD',
    base_currency: 'USD',
    decimal_places: 2,
    financial_year_start_month: 4,
    seed_standard_coa: true
  });

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreating(true);
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_COMPANY',
          ...form
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateModal(false);
        setForm({
          legal_name: '',
          trade_name: '',
          jurisdiction: 'India',
          registration_number: '',
          tax_identifier: '',
          company_type: 'PVT_LTD',
          base_currency: 'USD',
          decimal_places: 2,
          financial_year_start_month: 4,
          seed_standard_coa: true
        });
        await refreshCompanies();
        if (data.company?.id) {
          setActiveCompanyId(data.company.id);
        }
      } else {
        alert(`Failed to create company: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <header className="h-16 bg-[#0b1220] border-b border-slate-800/80 px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Entity Selector */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-750 rounded-xl px-3 py-1.5 shadow-inner">
          <Building2 className="w-4 h-4 text-emerald-400" />
          <select
            value={activeCompanyId}
            onChange={(e) => setActiveCompanyId(e.target.value)}
            className="bg-transparent text-xs font-semibold text-slate-100 focus:outline-none cursor-pointer pr-2 max-w-xs truncate"
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id} className="bg-slate-900 text-slate-100">
                {c.legal_name} ({c.jurisdiction})
              </option>
            ))}
          </select>
        </div>

        {/* + Add New Company Button */}
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 text-xs font-medium border border-slate-750 transition-all"
          title="Create a new company from scratch"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New Entity</span>
        </button>

        {/* Company Parameters Meta Badges */}
        {activeCompany && (
          <div className="hidden lg:flex items-center gap-2.5 text-[11px]">
            {/* Base Currency Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/60 border border-slate-700/50 text-slate-300">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>Base: <strong className="text-slate-100 font-semibold">{activeCompany.base_currency}</strong></span>
              <span className="text-slate-400">({activeCompany.decimal_places} dec)</span>
            </div>

            {/* Financial Year Start */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/60 border border-slate-700/50 text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-sky-400" />
              <span>FY Start: <strong className="text-slate-100">{MONTH_NAMES[activeCompany.financial_year_start_month - 1]}</strong></span>
            </div>

            {/* Lock Date Status */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/60 border border-slate-700/50 text-slate-300">
              {activeCompany.lock_date ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Locked through: <strong className="text-amber-300">{activeCompany.lock_date}</strong></span>
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-slate-400">Books: <strong className="text-emerald-300 font-normal">Open</strong></span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <Link
          href="/vouchers/new"
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md shadow-emerald-700/20 transition-all active:scale-[0.98]"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Voucher</span>
        </Link>
      </div>

      {/* Create New Company Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Create New Entity from Scratch</h3>
                <p className="text-xs text-slate-400">Set up a fresh company workspace while keeping your reference companies safe.</p>
              </div>
            </div>

            <form onSubmit={handleCreateCompany} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-slate-300 font-semibold mb-1">Company Legal Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Tech Innovations Private Limited"
                    value={form.legal_name}
                    onChange={(e) => setForm({ ...form, legal_name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Trade / Brand Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Labs"
                    value={form.trade_name}
                    onChange={(e) => setForm({ ...form, trade_name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Jurisdiction / Country *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. India, UAE, Delaware (US), UK"
                    value={form.jurisdiction}
                    onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Registration No (CIN/EIN/CR) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. U72900DL2026PTC112233"
                    value={form.registration_number}
                    onChange={(e) => setForm({ ...form, registration_number: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Tax ID (GSTIN / VAT / TRN)</label>
                  <input
                    type="text"
                    placeholder="e.g. 07AAAAA0000A1Z5"
                    value={form.tax_identifier}
                    onChange={(e) => setForm({ ...form, tax_identifier: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Structure Type</label>
                  <select
                    value={form.company_type}
                    onChange={(e) => setForm({ ...form, company_type: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="PVT_LTD">Private Limited (Pvt Ltd)</option>
                    <option value="LLC">Limited Liability Company (LLC)</option>
                    <option value="HOLDING">Holding Company</option>
                    <option value="PARTNERSHIP">Partnership / LLP</option>
                    <option value="PUBLIC_LTD">Public Limited Company</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Base Currency</label>
                  <select
                    value={form.base_currency}
                    onChange={(e) => setForm({ ...form, base_currency: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  >
                    <option value="USD">USD - US Dollar ($)</option>
                    <option value="INR">INR - Indian Rupee (₹)</option>
                    <option value="AED">AED - UAE Dirham (د.إ)</option>
                    <option value="EUR">EUR - Euro (€)</option>
                    <option value="GBP">GBP - British Pound (£)</option>
                    <option value="SGD">SGD - Singapore Dollar (S$)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Decimal Places (0 - 4)</label>
                  <input
                    type="number"
                    min="0"
                    max="4"
                    value={form.decimal_places}
                    onChange={(e) => setForm({ ...form, decimal_places: parseInt(e.target.value) || 2 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">FY Start Month</label>
                  <select
                    value={form.financial_year_start_month}
                    onChange={(e) => setForm({ ...form, financial_year_start_month: parseInt(e.target.value) || 4 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value={1}>January (US / Global Standard)</option>
                    <option value={4}>April (India, UK, Commonwealth)</option>
                    <option value={7}>July (Australia)</option>
                    <option value={10}>October</option>
                  </select>
                </div>
              </div>

              {/* Seed COA checkbox */}
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-200">Initialize Standard Chart of Accounts?</div>
                  <div className="text-[10px] text-slate-400">Pre-populates Assets, Liabilities, Equity, Revenue, FX Gain/Loss, and Expenses.</div>
                </div>
                <input
                  type="checkbox"
                  checked={form.seed_standard_coa}
                  onChange={(e) => setForm({ ...form, seed_standard_coa: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md shadow-emerald-700/20 transition-all disabled:opacity-50"
                >
                  {creating ? 'Creating Entity...' : 'Create & Switch to Entity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
