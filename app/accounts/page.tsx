'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCompany } from '@/components/context/company-context';
import { 
  Layers, 
  Plus, 
  Folder, 
  FolderOpen, 
  FileText, 
  ChevronRight, 
  ChevronDown, 
  ShieldCheck, 
  Coins, 
  Search,
  BookOpen
} from 'lucide-react';
import { AccountTreeNode } from '@/lib/engine/coa-tree';
import { CreateLedgerModal } from '@/components/accounts/create-ledger-modal';

export default function AccountsPage() {
  const { activeCompanyId, formatAmount } = useCompany();
  const [tree, setTree] = useState<AccountTreeNode[]>([]);
  const [rawAccounts, setRawAccounts] = useState<any[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    acc_1000: true,
    acc_2000: true,
    acc_3000: true,
    acc_4000: true,
    acc_5000: true,
    acc_1100: true,
    acc_1500: true,
    acc_2100: true
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Add Account Modal
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchAccountsTree = async () => {
    if (!activeCompanyId) return;
    try {
      setIsLoading(true);
      const [treeRes, flatRes] = await Promise.all([
        fetch(`/api/accounts?companyId=${activeCompanyId}&format=tree`),
        fetch(`/api/accounts?companyId=${activeCompanyId}`)
      ]);
      const [treeData, flatData] = await Promise.all([treeRes.json(), flatRes.json()]);

      if (treeData.success) {
        setTree(treeData.tree || []);
      }
      if (flatData.success) {
        setRawAccounts(flatData.accounts || []);
      }
    } catch (err) {
      console.error('Failed to load accounts tree:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccountsTree();
  }, [activeCompanyId]);

  const toggleExpand = (id: string) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAccountCreated = () => {
    fetchAccountsTree();
  };

  const renderNode = (node: AccountTreeNode) => {
    const isExpanded = expandedNodes[node.id];
    const hasChildren = node.children && node.children.length > 0;
    const isGroup = node.is_group === 1;

    // Search filter
    const matchesSearch = !searchTerm || 
      node.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      node.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.path.toLowerCase().includes(searchTerm.toLowerCase());

    return (
      <div key={node.id} className="select-none">
        <div
          className={`flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-slate-800/60 transition-colors border border-transparent hover:border-slate-700/60 group ${
            !matchesSearch && searchTerm ? 'opacity-40' : ''
          }`}
          style={{ paddingLeft: `${node.level * 20 + 12}px` }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleExpand(node.id)}
                className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-white"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <div className="w-5" />
            )}

            {isGroup ? (
              isExpanded ? (
                <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-amber-400 shrink-0" />
              )
            ) : (
              <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
            )}

            <span className="font-mono text-xs font-semibold text-slate-300">
              {node.code}
            </span>

            {isGroup ? (
              <span className="text-xs truncate font-bold text-white">
                {node.name}
              </span>
            ) : (
              <Link
                href={`/ledger?accountId=${node.id}`}
                className="text-xs truncate text-slate-200 hover:text-emerald-400 font-medium hover:underline decoration-dotted"
                title="Click to view Account Ledger"
              >
                {node.name}
              </Link>
            )}

            <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
              {node.type}
            </span>

            {isGroup ? (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-800/50">
                Group / Rollup
              </span>
            ) : (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/50">
                Posting
              </span>
            )}
          </div>

          <div className="flex items-center gap-6 text-xs">
            <div className="font-mono text-slate-400 text-[11px] hidden sm:block">
              Path: <span className="text-slate-300 font-semibold">{node.path}</span>
            </div>

            <div className="w-32 text-right font-mono font-bold text-slate-100">
              {formatAmount(node.displayBalance)}
            </div>

            {!isGroup && (
              <Link
                href={`/ledger?accountId=${node.id}`}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white"
                title="View Ledger Statement"
              >
                <BookOpen className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="space-y-0.5 mt-0.5">
            {node.children.map(child => renderNode(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
            <Layers className="w-4 h-4" />
            <span>Hierarchical Chart of Accounts</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Account Taxonomy & Materialized Paths
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Unlimited tree nesting, posting restrictions on parent folders, and real-time sub-tree rollups.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search code, name, path..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-900 border border-slate-750 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-56"
            />
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-md shadow-emerald-700/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Account / Hierarchy</span>
          </button>
        </div>
      </div>

      {/* COA Tree Card */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase text-slate-400 px-3 pb-3 border-b border-slate-800">
          <span>Account Hierarchy & Category</span>
          <div className="flex items-center gap-16">
            <span className="hidden sm:inline">Materialized Path</span>
            <span className="w-32 text-right">Rolled-Up Balance</span>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            Loading Chart of Accounts...
          </div>
        ) : (
          <div className="space-y-1 pt-1">
            {tree.map(rootNode => renderNode(rootNode))}
          </div>
        )}
      </div>

      {/* Create Ledger & Hierarchy Modal */}
      {showAddModal && (
        <CreateLedgerModal
          companyId={activeCompanyId}
          existingAccounts={rawAccounts}
          defaultType="EXPENSE"
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onAccountCreated={handleAccountCreated}
        />
      )}
    </div>
  );
}
