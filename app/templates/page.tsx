'use client';

import React, { useState, useEffect } from 'react';
import { useCompany } from '@/components/context/company-context';
import { 
  Sparkles, 
  Plus, 
  Play, 
  Trash2, 
  Edit3, 
  Layers, 
  Tag, 
  ArrowRight, 
  FolderPlus, 
  HelpCircle, 
  CheckCircle2, 
  AlertCircle,
  FileText
} from 'lucide-react';
import { FlowTemplate, FlowTemplateStep, FlowTemplateVariable } from '@/lib/db/schema';
import { FlowLauncherModal } from '@/components/templates/flow-launcher-modal';

export default function TemplatesPage() {
  const { activeCompany, activeCompanyId, formatAmount } = useCompany();
  const [templates, setTemplates] = useState<FlowTemplate[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Launcher Modal state
  const [selectedTemplateForLaunch, setSelectedTemplateForLaunch] = useState<FlowTemplate | null>(null);

  // Blueprint Designer Modal state
  const [showDesignerModal, setShowDesignerModal] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  // Blueprint Form State
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('SALES');
  const [formDescription, setFormDescription] = useState('');
  const [formTagsText, setFormTagsText] = useState('');
  const [formVariables, setFormVariables] = useState<FlowTemplateVariable[]>([]);
  const [formSteps, setFormSteps] = useState<FlowTemplateStep[]>([
    {
      id: 'step_1',
      step_number: 1,
      title: 'Step 1: Sales / Receivable Entry',
      narration_template: 'Being amount receivable towards the sale of {purpose} vide invoice no {document_no} dated {document_date}',
      reference_template: '{document_no}',
      lines: [
        { direction: 'DEBIT', account_mode: 'VARIABLE', variable_key: 'customer_account', memo_template: 'Receivable for {document_no}' },
        { direction: 'CREDIT', account_mode: 'CONSTANT', account_id: '', memo_template: 'Sales revenue for {purpose}' }
      ]
    },
    {
      id: 'step_2',
      step_number: 2,
      title: 'Step 2: Receipt / Cash Settlement',
      narration_template: 'Being amount received towards the sale of {purpose} vide invoice no {document_no} dated {document_date}',
      reference_template: 'RCP:{document_no}',
      lines: [
        { direction: 'DEBIT', account_mode: 'CONSTANT', account_id: '', memo_template: 'Cash/Bank collection for {document_no}' },
        { direction: 'CREDIT', account_mode: 'VARIABLE', variable_key: 'customer_account', memo_template: 'Clearance of receivable {document_no}' }
      ]
    }
  ]);

  const [savingBlueprint, setSavingBlueprint] = useState(false);

  const fetchScaffolding = async () => {
    if (!activeCompanyId) return;
    try {
      setIsLoading(true);
      const [tplRes, accRes] = await Promise.all([
        fetch(`/api/templates?companyId=${activeCompanyId}`),
        fetch(`/api/accounts?companyId=${activeCompanyId}`)
      ]);
      const [tplData, accData] = await Promise.all([tplRes.json(), accRes.json()]);

      if (tplData.success) {
        setTemplates(tplData.templates || []);
      }
      if (accData.success) {
        setAccounts(accData.accounts || []);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchScaffolding();
  }, [activeCompanyId]);

  const openNewDesigner = () => {
    setEditingTemplateId(null);
    setFormName('');
    setFormCategory('SALES');
    setFormDescription('');
    setFormTagsText('#CashSale #Retail');
    setFormVariables([
      { key: 'customer_account', label: 'Customer / Debtor Account', account_type: 'ASSET' }
    ]);
    setFormSteps([
      {
        id: 'step_1',
        step_number: 1,
        title: 'Step 1: Sales / Receivable Entry',
        narration_template: 'Being amount receivable towards the sale of {purpose} vide invoice no {document_no} dated {document_date}',
        reference_template: '{document_no}',
        lines: [
          { direction: 'DEBIT', account_mode: 'VARIABLE', variable_key: 'customer_account', memo_template: 'Receivable for {document_no}' },
          { direction: 'CREDIT', account_mode: 'CONSTANT', account_id: 'acc_4100', memo_template: 'Sales revenue for {purpose}' }
        ]
      },
      {
        id: 'step_2',
        step_number: 2,
        title: 'Step 2: Receipt / Cash Settlement',
        narration_template: 'Being amount received towards the sale of {purpose} vide invoice no {document_no} dated {document_date}',
        reference_template: 'RCP:{document_no}',
        lines: [
          { direction: 'DEBIT', account_mode: 'CONSTANT', account_id: 'acc_1110', memo_template: 'Cash/Bank collection for {document_no}' },
          { direction: 'CREDIT', account_mode: 'VARIABLE', variable_key: 'customer_account', memo_template: 'Clearance of receivable {document_no}' }
        ]
      }
    ]);
    setShowDesignerModal(true);
  };

  const openEditDesigner = (tpl: FlowTemplate) => {
    setEditingTemplateId(tpl.id);
    setFormName(tpl.name);
    setFormCategory(tpl.category || 'GENERAL');
    setFormDescription(tpl.description || '');
    setFormTagsText((tpl.default_tags || []).join(' '));
    setFormVariables(tpl.variables || []);
    setFormSteps(tpl.steps || []);
    setShowDesignerModal(true);
  };

  const handleDeleteTemplate = async (templateId: string, templateName: string) => {
    if (!window.confirm(`Are you sure you want to delete the flow template "${templateName}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/templates?id=${templateId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      } else {
        alert(`Failed to delete template: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error deleting template: ${err.message}`);
    }
  };

  const handleSaveBlueprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('Template Name is required');
      return;
    }

    try {
      setSavingBlueprint(true);
      const rawTags = formTagsText
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter((t) => t.startsWith('#'));

      const payload = {
        id: editingTemplateId || undefined,
        company_id: activeCompanyId,
        name: formName.trim(),
        category: formCategory,
        description: formDescription.trim(),
        default_tags: rawTags,
        variables: formVariables,
        steps: formSteps
      };

      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        setShowDesignerModal(false);
        fetchScaffolding();
      } else {
        alert(`Failed to save template: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSavingBlueprint(false);
    }
  };

  // Variable helpers in designer
  const addVariable = () => {
    const nextIdx = formVariables.length + 1;
    setFormVariables([
      ...formVariables,
      {
        key: `variable_${nextIdx}`,
        label: `Variable Account #${nextIdx}`,
        account_type: 'ASSET'
      }
    ]);
  };

  const removeVariable = (key: string) => {
    setFormVariables(formVariables.filter((v) => v.key !== key));
  };

  // Step helpers in designer
  const addStep = () => {
    const nextNum = formSteps.length + 1;
    setFormSteps([
      ...formSteps,
      {
        id: `step_${Date.now()}`,
        step_number: nextNum,
        title: `Step ${nextNum}: New Entry`,
        narration_template: 'Being transaction for {purpose} vide ref {document_no}',
        reference_template: '{document_no}',
        lines: [
          { direction: 'DEBIT', account_mode: 'CONSTANT', account_id: '', memo_template: 'Debit line' },
          { direction: 'CREDIT', account_mode: 'CONSTANT', account_id: '', memo_template: 'Credit line' }
        ]
      }
    ]);
  };

  const removeStep = (idx: number) => {
    if (formSteps.length <= 1) return;
    setFormSteps(formSteps.filter((_, i) => i !== idx));
  };

  const addLineToStep = (stepIdx: number) => {
    const updated = [...formSteps];
    updated[stepIdx].lines.push({
      direction: 'DEBIT',
      account_mode: 'CONSTANT',
      account_id: '',
      memo_template: ''
    });
    setFormSteps(updated);
  };

  const removeLineFromStep = (stepIdx: number, lineIdx: number) => {
    const updated = [...formSteps];
    if (updated[stepIdx].lines.length <= 2) return;
    updated[stepIdx].lines = updated[stepIdx].lines.filter((_, i) => i !== lineIdx);
    setFormSteps(updated);
  };

  const getAccountName = (accId?: string) => {
    const acc = accounts.find((a) => a.id === accId);
    return acc ? `${acc.code} - ${acc.name}` : 'Select Account';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            <span>Process Automation Engine</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Multi-Step Flow Templates
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Build multi-voucher batch blueprints with constant vs variable ledgers and dynamic placeholder narrations.
          </p>
        </div>

        <button
          type="button"
          onClick={openNewDesigner}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-700/25 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>+ Create Flow Blueprint</span>
        </button>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((tpl) => (
          <div
            key={tpl.id}
            className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between shadow-sm space-y-4 group"
          >
            <div>
              {/* Category & Step Count */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/50 font-mono">
                  {tpl.category}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {tpl.steps?.length || 0} Sequential Vouchers
                </span>
              </div>

              {/* Title & Description */}
              <h3 className="text-base font-bold text-white tracking-tight group-hover:text-emerald-300 transition-colors">
                {tpl.name}
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">
                {tpl.description || 'Pre-configured multi-step double entry batch automation.'}
              </p>

              {/* Sequential Steps Visual Progression */}
              <div className="mt-4 p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Batch Execution Steps
                </span>
                <div className="space-y-1.5">
                  {(tpl.steps || []).map((step, sIdx) => (
                    <div key={step.id || sIdx} className="flex items-center gap-2 text-xs">
                      <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                        {sIdx + 1}
                      </span>
                      <span className="text-slate-200 font-medium truncate">{step.title}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Variable Ledgers Badge */}
              {(tpl.variables || []).length > 0 && (
                <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Variables:</span>
                  {tpl.variables.map((v) => (
                    <span
                      key={v.key}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950/80 text-sky-400 border border-sky-800/50"
                    >
                      {v.label}
                    </span>
                  ))}
                </div>
              )}

              {/* Tags */}
              <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                {(tpl.default_tags || []).map((t, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => openEditDesigner(tpl)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                  title="Edit Blueprint"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteTemplate(tpl.id, tpl.name)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition-colors"
                  title="Delete Template"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTemplateForLaunch(tpl)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-700/20 transition-all"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Launch Flow</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {templates.length === 0 && !isLoading && (
        <div className="py-16 text-center bg-[#0f172a] border border-slate-800 rounded-2xl p-8 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">No Flow Blueprints Found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Create your first multi-step batch template to automate recurring sales, purchases, or payroll flows.
            </p>
          </div>
          <button
            type="button"
            onClick={openNewDesigner}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-700/25 transition-all inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Flow Blueprint</span>
          </button>
        </div>
      )}

      {/* Flow Launcher Modal */}
      {selectedTemplateForLaunch && activeCompany && (
        <FlowLauncherModal
          template={selectedTemplateForLaunch}
          company={activeCompany}
          accounts={accounts}
          isOpen={!!selectedTemplateForLaunch}
          onClose={() => setSelectedTemplateForLaunch(null)}
          onSuccess={fetchScaffolding}
        />
      )}

      {/* Blueprint Visual Designer Modal */}
      {showDesignerModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 space-y-6 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingTemplateId ? 'Edit Multi-Step Blueprint' : 'Design New Multi-Step Blueprint'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Define batch sequential steps, constant vs variable ledgers, and placeholder narrations.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDesignerModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveBlueprint} className="space-y-6 text-xs">
              {/* Basic Information */}
              <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-slate-300 font-semibold mb-1">Blueprint Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Direct Cash Sales with Instant Receipt"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="SALES">SALES</option>
                    <option value="PURCHASES">PURCHASES</option>
                    <option value="PAYROLL">PAYROLL</option>
                    <option value="TREASURY">TREASURY</option>
                    <option value="GENERAL">GENERAL</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-slate-300 font-semibold mb-1">Description</label>
                  <input
                    type="text"
                    placeholder="e.g. 2-Step batch: Creates Sales / Receivable entry and executes immediate cash settlement."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Default #Tags (Space Separated)</label>
                  <input
                    type="text"
                    placeholder="#CashSale #Retail"
                    value={formTagsText}
                    onChange={(e) => setFormTagsText(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-emerald-400 font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Dynamic Variable Ledgers Definition */}
              <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white">Variable Ledgers (Dynamic at Launch Time)</h4>
                    <p className="text-[11px] text-slate-400">
                      Accounts chosen by the user at launch time (e.g. Customer, Vendor, Expense Account).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addVariable}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs font-semibold border border-slate-700"
                  >
                    <Plus className="w-3.5 h-3.5 text-sky-400" />
                    <span>+ Add Variable</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {formVariables.map((v, vIdx) => (
                    <div key={v.key || vIdx} className="grid grid-cols-1 md:grid-cols-4 gap-2 bg-slate-900 p-2.5 rounded-lg border border-slate-800 items-center">
                      <div>
                        <label className="block text-[10px] text-slate-400 uppercase font-semibold">Variable Key</label>
                        <input
                          type="text"
                          required
                          value={v.key}
                          onChange={(e) => {
                            const updated = [...formVariables];
                            updated[vIdx].key = e.target.value;
                            setFormVariables(updated);
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 uppercase font-semibold">User-Facing Label</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Customer / Debtor"
                          value={v.label}
                          onChange={(e) => {
                            const updated = [...formVariables];
                            updated[vIdx].label = e.target.value;
                            setFormVariables(updated);
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 uppercase font-semibold">Account Type</label>
                        <select
                          value={v.account_type || 'ASSET'}
                          onChange={(e) => {
                            const updated = [...formVariables];
                            updated[vIdx].account_type = e.target.value as any;
                            setFormVariables(updated);
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-white"
                        >
                          <option value="ASSET">ASSET (Receivable/Bank/Property)</option>
                          <option value="LIABILITY">LIABILITY (Payable/Loan)</option>
                          <option value="EXPENSE">EXPENSE</option>
                          <option value="REVENUE">REVENUE</option>
                          <option value="EQUITY">EQUITY</option>
                        </select>
                      </div>
                      <div className="flex items-end justify-end">
                        <button
                          type="button"
                          onClick={() => removeVariable(v.key)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {formVariables.length === 0 && (
                    <div className="text-[11px] text-slate-500 italic p-2">
                      No variable ledgers defined. All lines will use fixed constant accounts.
                    </div>
                  )}
                </div>
              </div>

              {/* Sequential Steps Builder */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white">Sequential Voucher Steps ({formSteps.length})</h4>
                    <p className="text-[11px] text-slate-400">
                      Placeholders available in narrations: <code className="text-emerald-400">&#123;purpose&#125;</code>, <code className="text-emerald-400">&#123;document_no&#125;</code>, <code className="text-emerald-400">&#123;document_date&#125;</code>, <code className="text-emerald-400">&#123;amount&#125;</code>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addStep}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-semibold border border-emerald-500/30"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-400" />
                    <span>+ Add Step</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {formSteps.map((step, sIdx) => (
                    <div key={step.id || sIdx} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                        <div className="flex items-center gap-2 flex-1 max-w-md">
                          <span className="w-5 h-5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center justify-center text-[10px] font-bold">
                            {sIdx + 1}
                          </span>
                          <input
                            type="text"
                            required
                            placeholder="Step Title (e.g. Sales / Receivable Entry)"
                            value={step.title}
                            onChange={(e) => {
                              const updated = [...formSteps];
                              updated[sIdx].title = e.target.value;
                              setFormSteps(updated);
                            }}
                            className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-bold flex-1"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeStep(sIdx)}
                          disabled={formSteps.length <= 1}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 disabled:opacity-30"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Narration Formula */}
                      <div>
                        <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">
                          Voucher Narration / Memo Formula *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Being amount receivable towards the sale of {purpose} vide invoice no {document_no} dated {document_date}"
                          value={step.narration_template}
                          onChange={(e) => {
                            const updated = [...formSteps];
                            updated[sIdx].narration_template = e.target.value;
                            setFormSteps(updated);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      {/* Lines Builder */}
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between text-[10px] uppercase font-semibold text-slate-400">
                          <span>Step Line Items</span>
                          <button
                            type="button"
                            onClick={() => addLineToStep(sIdx)}
                            className="text-emerald-400 hover:text-emerald-300 font-bold"
                          >
                            + Add Line
                          </button>
                        </div>

                        {step.lines.map((line, lIdx) => (
                          <div
                            key={lIdx}
                            className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800 grid grid-cols-1 md:grid-cols-12 gap-2 items-center text-xs"
                          >
                            {/* Direction */}
                            <div className="md:col-span-2">
                              <select
                                value={line.direction}
                                onChange={(e) => {
                                  const updated = [...formSteps];
                                  updated[sIdx].lines[lIdx].direction = e.target.value as any;
                                  setFormSteps(updated);
                                }}
                                className={`w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 font-bold ${
                                  line.direction === 'DEBIT' ? 'text-emerald-400' : 'text-sky-400'
                                }`}
                              >
                                <option value="DEBIT">Debit (Dr)</option>
                                <option value="CREDIT">Credit (Cr)</option>
                              </select>
                            </div>

                            {/* Mode: Constant vs Variable */}
                            <div className="md:col-span-3">
                              <select
                                value={line.account_mode}
                                onChange={(e) => {
                                  const updated = [...formSteps];
                                  updated[sIdx].lines[lIdx].account_mode = e.target.value as any;
                                  setFormSteps(updated);
                                }}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-slate-200"
                              >
                                <option value="CONSTANT">Constant (Fixed Account)</option>
                                <option value="VARIABLE">Variable (Select at Launch)</option>
                              </select>
                            </div>

                            {/* Account Selector (Constant or Variable) */}
                            <div className="md:col-span-4">
                              {line.account_mode === 'CONSTANT' ? (
                                <select
                                  required
                                  value={line.account_id || ''}
                                  onChange={(e) => {
                                    const updated = [...formSteps];
                                    updated[sIdx].lines[lIdx].account_id = e.target.value;
                                    setFormSteps(updated);
                                  }}
                                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-white truncate"
                                >
                                  <option value="">Select Constant Account...</option>
                                  {accounts
                                    .filter((a) => a.is_group === 0)
                                    .map((acc) => (
                                      <option key={acc.id} value={acc.id}>
                                        {acc.code} - {acc.name}
                                      </option>
                                    ))}
                                </select>
                              ) : (
                                <select
                                  required
                                  value={line.variable_key || ''}
                                  onChange={(e) => {
                                    const updated = [...formSteps];
                                    updated[sIdx].lines[lIdx].variable_key = e.target.value;
                                    setFormSteps(updated);
                                  }}
                                  className="w-full bg-slate-950 border border-sky-700/60 text-sky-300 font-mono rounded-lg px-2 py-1 truncate"
                                >
                                  <option value="">Select Variable Slot...</option>
                                  {formVariables.map((v) => (
                                    <option key={v.key} value={v.key}>
                                      [Variable: {v.label}]
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>

                            {/* Line Memo */}
                            <div className="md:col-span-2">
                              <input
                                type="text"
                                placeholder="Line Memo Formula"
                                value={line.memo_template || ''}
                                onChange={(e) => {
                                  const updated = [...formSteps];
                                  updated[sIdx].lines[lIdx].memo_template = e.target.value;
                                  setFormSteps(updated);
                                }}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-white text-[11px]"
                              />
                            </div>

                            {/* Delete Line */}
                            <div className="md:col-span-1 flex justify-end">
                              <button
                                type="button"
                                onClick={() => removeLineFromStep(sIdx, lIdx)}
                                disabled={step.lines.length <= 2}
                                className="p-1 rounded text-slate-500 hover:text-rose-400 disabled:opacity-20"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDesignerModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingBlueprint}
                  className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md shadow-emerald-700/20 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{savingBlueprint ? 'Saving Blueprint...' : 'Save Flow Blueprint'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
