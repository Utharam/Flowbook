'use client';

import React, { useState, useEffect } from 'react';
import { useCompany } from '@/components/context/company-context';
import { 
  Building2, 
  Users, 
  PieChart, 
  ShieldCheck, 
  Calendar, 
  Lock, 
  Plus, 
  CheckCircle, 
  AlertCircle, 
  UserCheck, 
  UserX,
  Building,
  CheckCircle2,
  MapPin,
  Coins,
  ArrowRight,
  Sparkles
} from 'lucide-react';

export default function GovernancePage() {
  const { companies, activeCompany, activeCompanyId, setActiveCompanyId, refreshCompanies } = useCompany();
  const [officers, setOfficers] = useState<any[]>([]);
  const [shareholders, setShareholders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Form states
  const [companyForm, setCompanyForm] = useState<any>({});
  const [showOfficerModal, setShowOfficerModal] = useState(false);
  const [officerForm, setOfficerForm] = useState({
    full_name: '',
    role: 'DIRECTOR',
    identification_number: '',
    appointed_date: new Date().toISOString().substring(0, 10),
    resigned_date: ''
  });

  const [showShareholderModal, setShowShareholderModal] = useState(false);
  const [shareholderForm, setShareholderForm] = useState({
    shareholder_name: '',
    shareholder_type: 'INDIVIDUAL',
    share_class: 'EQUITY',
    number_of_shares: 10000,
    percentage_holding: 10.0,
    is_ubo: false,
    ubo_controlling_interest_type: 'VOTING_RIGHTS',
    effective_from: new Date().toISOString().substring(0, 10)
  });

  const [showCreateCompanyModal, setShowCreateCompanyModal] = useState(false);
  const [newCompanyForm, setNewCompanyForm] = useState({
    legal_name: '',
    trade_name: '',
    jurisdiction: 'India',
    registration_number: '',
    tax_identifier: '',
    registered_address: '',
    company_type: 'PVT_LTD',
    base_currency: 'USD',
    decimal_places: 2,
    financial_year_start_month: 4,
    seed_standard_coa: true
  });
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  const fetchGovernanceData = async () => {
    if (!activeCompanyId) return;
    try {
      setIsLoading(true);
      const res = await fetch(`/api/governance?companyId=${activeCompanyId}`);
      const data = await res.json();
      if (data.success) {
        setOfficers(data.officers || []);
        setShareholders(data.shareholders || []);
      }
    } catch (err) {
      console.error('Failed to load governance data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeCompany) {
      setCompanyForm({
        legal_name: activeCompany.legal_name,
        trade_name: activeCompany.trade_name || '',
        jurisdiction: activeCompany.jurisdiction,
        registration_number: activeCompany.registration_number,
        tax_identifier: activeCompany.tax_identifier || '',
        registered_address: activeCompany.registered_address || '',
        company_type: activeCompany.company_type,
        base_currency: activeCompany.base_currency,
        decimal_places: activeCompany.decimal_places,
        financial_year_start_month: activeCompany.financial_year_start_month,
        lock_date: activeCompany.lock_date || ''
      });
      fetchGovernanceData();
    }
  }, [activeCompany, activeCompanyId]);

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingCompany(true);
      setSaveSuccessMessage(null);
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeCompanyId,
          ...companyForm
        })
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccessMessage('Corporate profile, registered address & parameters updated successfully!');
        await refreshCompanies();
        setTimeout(() => setSaveSuccessMessage(null), 4000);
      } else {
        alert(`Failed: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error updating company: ${err.message}`);
    } finally {
      setSavingCompany(false);
    }
  };

  const handleCreateNewCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreatingCompany(true);
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_COMPANY',
          ...newCompanyForm
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateCompanyModal(false);
        setNewCompanyForm({
          legal_name: '',
          trade_name: '',
          jurisdiction: 'India',
          registration_number: '',
          tax_identifier: '',
          registered_address: '',
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
        alert(`Failed: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setCreatingCompany(false);
    }
  };

  const handleAddOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/governance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ADD_OFFICER',
          payload: {
            company_id: activeCompanyId,
            ...officerForm
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowOfficerModal(false);
        setOfficerForm({
          full_name: '',
          role: 'DIRECTOR',
          identification_number: '',
          appointed_date: new Date().toISOString().substring(0, 10),
          resigned_date: ''
        });
        fetchGovernanceData();
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleAddShareholder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/governance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ADD_SHAREHOLDER',
          payload: {
            company_id: activeCompanyId,
            ...shareholderForm
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowShareholderModal(false);
        fetchGovernanceData();
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const totalCapPct = shareholders.reduce((sum, s) => sum + (s.percentage_holding || 0), 0);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Page Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
            <Building2 className="w-4 h-4" />
            <span>Entity & Corporate Governance Management</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Organization Center, Profile & Cap Table
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Switch between entities, alter corporate profiles, manage Key Management Personnel, and track UBO cap tables.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateCompanyModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-700/25 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add New Entity</span>
        </button>
      </div>

      {/* 1. All Registered Corporate Entities Grid */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Building className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Registered Corporate Entities ({companies.length})
            </h2>
          </div>
          <span className="text-xs text-slate-400">Click any entity card to switch active books</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((c) => {
            const isActive = c.id === activeCompanyId;

            return (
              <div
                key={c.id}
                onClick={() => setActiveCompanyId(c.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                  isActive
                    ? 'bg-emerald-950/40 border-emerald-500/80 shadow-lg shadow-emerald-900/20 ring-1 ring-emerald-500/50'
                    : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                      {c.jurisdiction}
                    </span>
                    {isActive ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-700/60">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Active Book</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-medium hover:text-slate-300 flex items-center gap-1">
                        <span>Switch</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-white tracking-tight">{c.legal_name}</h3>
                  {c.trade_name && (
                    <div className="text-xs text-emerald-400/90 font-medium mt-0.5">
                      DBA: {c.trade_name}
                    </div>
                  )}

                  <div className="mt-3 space-y-1 text-xs text-slate-400">
                    <div className="flex items-center justify-between text-[11px]">
                      <span>Reg No:</span>
                      <strong className="text-slate-200 font-mono">{c.registration_number}</strong>
                    </div>
                    {c.tax_identifier && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span>Tax ID:</span>
                        <strong className="text-slate-200 font-mono">{c.tax_identifier}</strong>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[11px]">
                      <span>Currency:</span>
                      <strong className="text-amber-300 font-mono">{c.base_currency} ({c.decimal_places} dec)</strong>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>FY Start: {c.financial_year_start_month === 4 ? 'April' : c.financial_year_start_month === 1 ? 'January' : `Month ${c.financial_year_start_month}`}</span>
                  <span className={c.lock_date ? 'text-amber-400' : 'text-emerald-400'}>
                    {c.lock_date ? `Locked: ${c.lock_date}` : 'Books Open'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save Success Banner */}
      {saveSuccessMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2 shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* 2. Alter Active Entity Profile & Compliance Parameters */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Alter Active Entity Profile: <span className="text-emerald-400">{activeCompany?.legal_name}</span>
              </h2>
              <p className="text-xs text-slate-400">
                Update legal name, registered address, tax numbers, base currency, and period lock dates.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveCompany} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Legal Entity Name</label>
            <input
              type="text"
              required
              value={companyForm.legal_name || ''}
              onChange={(e) => setCompanyForm({ ...companyForm, legal_name: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Trade / DBA Name</label>
            <input
              type="text"
              value={companyForm.trade_name || ''}
              onChange={(e) => setCompanyForm({ ...companyForm, trade_name: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Jurisdiction / Country</label>
            <input
              type="text"
              required
              value={companyForm.jurisdiction || ''}
              onChange={(e) => setCompanyForm({ ...companyForm, jurisdiction: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>Registered Corporate Address</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Level 8, Nexus Cyber Tower, Bengaluru 560100, India"
              value={companyForm.registered_address || ''}
              onChange={(e) => setCompanyForm({ ...companyForm, registered_address: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Registration No (CIN / CR / EIN)</label>
            <input
              type="text"
              required
              value={companyForm.registration_number || ''}
              onChange={(e) => setCompanyForm({ ...companyForm, registration_number: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Tax Identifier (GSTIN / TRN / VAT)</label>
            <input
              type="text"
              value={companyForm.tax_identifier || ''}
              onChange={(e) => setCompanyForm({ ...companyForm, tax_identifier: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Company Structure Type</label>
            <select
              value={companyForm.company_type || 'PVT_LTD'}
              onChange={(e) => setCompanyForm({ ...companyForm, company_type: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="PVT_LTD">Private Limited Company (Pvt Ltd)</option>
              <option value="LLC">Limited Liability Company (LLC)</option>
              <option value="HOLDING">Holding Company</option>
              <option value="PARTNERSHIP">Partnership / LLP</option>
              <option value="PUBLIC_LTD">Public Limited Company</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Base Operating Currency</label>
            <select
              value={companyForm.base_currency || 'USD'}
              onChange={(e) => setCompanyForm({ ...companyForm, base_currency: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
            >
              <option value="USD">USD - US Dollar ($)</option>
              <option value="EUR">EUR - Euro (€)</option>
              <option value="GBP">GBP - British Pound (£)</option>
              <option value="AED">AED - UAE Dirham (د.إ)</option>
              <option value="INR">INR - Indian Rupee (₹)</option>
              <option value="SGD">SGD - Singapore Dollar (S$)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Decimal Precision (0 - 4)</label>
            <input
              type="number"
              min="0"
              max="4"
              value={companyForm.decimal_places ?? 2}
              onChange={(e) => setCompanyForm({ ...companyForm, decimal_places: parseInt(e.target.value) || 2 })}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Financial Year Starting Month</label>
            <select
              value={companyForm.financial_year_start_month || 4}
              onChange={(e) => setCompanyForm({ ...companyForm, financial_year_start_month: parseInt(e.target.value) || 4 })}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value={1}>January (US / International Standard)</option>
              <option value={4}>April (India, UK, Commonwealth)</option>
              <option value={7}>July (Australia, Egypt)</option>
              <option value={10}>October (Costa Rica)</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-amber-300 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>Closed Books Barrier (Lock Date)</span>
            </label>
            <input
              type="date"
              value={companyForm.lock_date || ''}
              onChange={(e) => setCompanyForm({ ...companyForm, lock_date: e.target.value })}
              className="w-full bg-slate-900 border border-amber-800/60 rounded-xl px-3.5 py-2 text-xs text-amber-200 focus:border-amber-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Transactions dated on or prior to this date cannot be created, posted, or altered.
            </p>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={savingCompany}
              className="w-full py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-700/20 transition-all disabled:opacity-50"
            >
              {savingCompany ? 'Saving Profile...' : 'Save & Alter Corporate Profile'}
            </button>
          </div>
        </form>
      </div>

      {/* 3. Directors & Key Management Personnel (KMP) */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Directors & Key Management Personnel (KMP)</h2>
              <p className="text-xs text-slate-400">Statutory officer register with DIN/SSN and appointment auditing.</p>
            </div>
          </div>

          <button
            onClick={() => setShowOfficerModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Officer</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Officer Name</th>
                <th className="py-3 px-4">Role / Designation</th>
                <th className="py-3 px-4">Identification No (DIN/Passport)</th>
                <th className="py-3 px-4">Appointed Date</th>
                <th className="py-3 px-4">Resigned Date</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {officers.map((off) => (
                <tr key={off.id} className="hover:bg-slate-850/40">
                  <td className="py-3 px-4 font-semibold text-slate-200">
                    {off.full_name}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                      {off.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-300">
                    {off.identification_number || '—'}
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    {off.appointed_date}
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    {off.resigned_date || '—'}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {off.is_active === 1 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                        <UserCheck className="w-3 h-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-950 text-rose-400 border border-rose-800/50">
                        <UserX className="w-3 h-3" /> Resigned
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Shareholding Pattern & Ultimate Beneficial Owners (UBO) */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Shareholding Structure & Ultimate Beneficial Owners (UBO)</h2>
              <p className="text-xs text-slate-400">Cap table tracking equity classes, percentage holding, and anti-money laundering UBO designations.</p>
            </div>
          </div>

          <button
            onClick={() => setShowShareholderModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Shareholder</span>
          </button>
        </div>

        {/* Ownership Bar */}
        <div className="mb-6 bg-slate-900 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-slate-300 font-semibold">Total Capital Allocated: {totalCapPct.toFixed(2)}%</span>
            <span className={totalCapPct === 100 ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
              {totalCapPct === 100 ? '100% Fully Distributed' : `${(100 - totalCapPct).toFixed(2)}% Unallocated`}
            </span>
          </div>
          <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden flex">
            {shareholders.map((s, i) => (
              <div
                key={s.id}
                style={{ width: `${s.percentage_holding}%` }}
                className={i % 2 === 0 ? 'bg-emerald-500' : 'bg-indigo-500'}
                title={`${s.shareholder_name}: ${s.percentage_holding}%`}
              ></div>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Shareholder Name</th>
                <th className="py-3 px-4">Entity Type</th>
                <th className="py-3 px-4">Share Class</th>
                <th className="py-3 px-4 text-right">No. of Shares</th>
                <th className="py-3 px-4 text-right">Holding %</th>
                <th className="py-3 px-4 text-center">UBO Status</th>
                <th className="py-3 px-4">Controlling Interest</th>
                <th className="py-3 px-4">Effective Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {shareholders.map((sh) => (
                <tr key={sh.id} className="hover:bg-slate-850/40">
                  <td className="py-3 px-4 font-semibold text-slate-200">
                    {sh.shareholder_name}
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    {sh.shareholder_type}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-300">
                    {sh.share_class}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-medium text-slate-200">
                    {sh.number_of_shares.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-400 font-mono">
                    {sh.percentage_holding.toFixed(2)}%
                  </td>
                  <td className="py-3 px-4 text-center">
                    {sh.is_ubo === 1 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800/60">
                        <ShieldCheck className="w-3 h-3" /> UBO Flagged
                      </span>
                    ) : (
                      <span className="text-slate-500 font-mono text-[10px]">Non-UBO</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                    {sh.ubo_controlling_interest_type || '—'}
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    {sh.effective_from}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create New Company Modal */}
      {showCreateCompanyModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Create New Entity from Scratch</h3>
                <p className="text-xs text-slate-400">Set up a fresh company workspace while keeping reference companies safe.</p>
              </div>
            </div>

            <form onSubmit={handleCreateNewCompany} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-slate-300 font-semibold mb-1">Company Legal Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Skyline Logistics Private Limited"
                    value={newCompanyForm.legal_name}
                    onChange={(e) => setNewCompanyForm({ ...newCompanyForm, legal_name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Trade / Brand Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Skyline Express"
                    value={newCompanyForm.trade_name}
                    onChange={(e) => setNewCompanyForm({ ...newCompanyForm, trade_name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Jurisdiction / Country *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. India, UAE, Delaware (US), UK"
                    value={newCompanyForm.jurisdiction}
                    onChange={(e) => setNewCompanyForm({ ...newCompanyForm, jurisdiction: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-slate-300 font-semibold mb-1">Registered Address</label>
                  <input
                    type="text"
                    placeholder="e.g. Plot 45, MIDC Industrial Area, Mumbai 400093, India"
                    value={newCompanyForm.registered_address}
                    onChange={(e) => setNewCompanyForm({ ...newCompanyForm, registered_address: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Registration No (CIN/EIN/CR) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. U60200MH2026PTC334455"
                    value={newCompanyForm.registration_number}
                    onChange={(e) => setNewCompanyForm({ ...newCompanyForm, registration_number: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Tax ID (GSTIN / VAT / TRN)</label>
                  <input
                    type="text"
                    placeholder="e.g. 27AAAAA1111A1Z5"
                    value={newCompanyForm.tax_identifier}
                    onChange={(e) => setNewCompanyForm({ ...newCompanyForm, tax_identifier: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Structure Type</label>
                  <select
                    value={newCompanyForm.company_type}
                    onChange={(e) => setNewCompanyForm({ ...newCompanyForm, company_type: e.target.value })}
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
                    value={newCompanyForm.base_currency}
                    onChange={(e) => setNewCompanyForm({ ...newCompanyForm, base_currency: e.target.value })}
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
                    value={newCompanyForm.decimal_places}
                    onChange={(e) => setNewCompanyForm({ ...newCompanyForm, decimal_places: parseInt(e.target.value) || 2 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">FY Start Month</label>
                  <select
                    value={newCompanyForm.financial_year_start_month}
                    onChange={(e) => setNewCompanyForm({ ...newCompanyForm, financial_year_start_month: parseInt(e.target.value) || 4 })}
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
                  checked={newCompanyForm.seed_standard_coa}
                  onChange={(e) => setNewCompanyForm({ ...newCompanyForm, seed_standard_coa: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateCompanyModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingCompany}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md shadow-emerald-700/20 transition-all disabled:opacity-50"
                >
                  {creatingCompany ? 'Creating Entity...' : 'Create & Switch to Entity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Officer Modal */}
      {showOfficerModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-white">Add Company Director / Officer</h3>
            <form onSubmit={handleAddOfficer} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Full Legal Name</label>
                <input
                  type="text"
                  required
                  value={officerForm.full_name}
                  onChange={(e) => setOfficerForm({ ...officerForm, full_name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Role / Designation</label>
                <select
                  value={officerForm.role}
                  onChange={(e) => setOfficerForm({ ...officerForm, role: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="DIRECTOR">Director</option>
                  <option value="MANAGING_DIRECTOR">Managing Director (MD)</option>
                  <option value="CFO">Chief Financial Officer (CFO)</option>
                  <option value="COMPANY_SECRETARY">Company Secretary (CS)</option>
                  <option value="CEO">Chief Executive Officer (CEO)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Identification Number (DIN / SSN / Passport)</label>
                <input
                  type="text"
                  value={officerForm.identification_number}
                  onChange={(e) => setOfficerForm({ ...officerForm, identification_number: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Appointment Date</label>
                <input
                  type="date"
                  required
                  value={officerForm.appointed_date}
                  onChange={(e) => setOfficerForm({ ...officerForm, appointed_date: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOfficerModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold"
                >
                  Save Officer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Shareholder Modal */}
      {showShareholderModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-white">Add Shareholder / UBO</h3>
            <form onSubmit={handleAddShareholder} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Shareholder Name</label>
                <input
                  type="text"
                  required
                  value={shareholderForm.shareholder_name}
                  onChange={(e) => setShareholderForm({ ...shareholderForm, shareholder_name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Entity Type</label>
                  <select
                    value={shareholderForm.shareholder_type}
                    onChange={(e) => setShareholderForm({ ...shareholderForm, shareholder_type: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="INDIVIDUAL">Individual Person</option>
                    <option value="CORPORATE_BODY">Corporate Body</option>
                    <option value="TRUST">Trust</option>
                    <option value="INSTITUTIONAL">Institutional</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Share Class</label>
                  <select
                    value={shareholderForm.share_class}
                    onChange={(e) => setShareholderForm({ ...shareholderForm, share_class: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="EQUITY">Equity Shares</option>
                    <option value="PREFERENCE">Preference Shares</option>
                    <option value="CLASS_A">Class A Voting</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">No. of Shares</label>
                  <input
                    type="number"
                    required
                    value={shareholderForm.number_of_shares}
                    onChange={(e) => setShareholderForm({ ...shareholderForm, number_of_shares: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Percentage Holding (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={shareholderForm.percentage_holding}
                    onChange={(e) => setShareholderForm({ ...shareholderForm, percentage_holding: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shareholderForm.is_ubo}
                    onChange={(e) => setShareholderForm({ ...shareholderForm, is_ubo: e.target.checked })}
                    className="rounded border-slate-600 text-amber-500 focus:ring-amber-400"
                  />
                  <span className="text-xs font-semibold text-amber-300">Ultimate Beneficial Owner (UBO)</span>
                </label>
                {shareholderForm.is_ubo && (
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Controlling Interest Type</label>
                    <select
                      value={shareholderForm.ubo_controlling_interest_type}
                      onChange={(e) => setShareholderForm({ ...shareholderForm, ubo_controlling_interest_type: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="VOTING_RIGHTS">Voting Rights Control (&gt;25%)</option>
                      <option value="DIRECT_EQUITY">Direct Equity Majority</option>
                      <option value="EFFECTIVE_CONTROL">Effective Senior Management Control</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowShareholderModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                >
                  Save Shareholder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
