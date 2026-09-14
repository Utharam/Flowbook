import { Account, AccountType, Company } from '../db/schema';
import { getDb } from '../db';

export interface AccountTreeNode extends Account {
  children: AccountTreeNode[];
  level: number;
  balance: number; // Signed base currency total
  debitTotal: number;
  creditTotal: number;
  displayBalance: number; // Formatted based on normal balance direction
}

export interface CoaFilterOptions {
  startDate?: string;
  endDate?: string;
  tag?: string; // Multidimensional tag filter e.g. '#1206'
}

/**
 * Builds the complete hierarchical Chart of Accounts tree with recursive balance rollups.
 */
export function getHierarchicalCoa(
  companyId: string,
  options: CoaFilterOptions = {}
): AccountTreeNode[] {
  const db = getDb();
  
  // 1. Fetch all accounts for company
  const accounts = (db.prepare(`
    SELECT * FROM accounts 
    WHERE company_id = ? AND is_active = 1
    ORDER BY path ASC, code ASC
  `).all(companyId) as unknown) as Account[];

  // 2. Fetch raw account balances
  let query = `
    SELECT 
      jl.account_id,
      SUM(CASE WHEN jl.amount < 0 THEN ABS(jl.amount) ELSE 0 END) as debit_total,
      SUM(CASE WHEN jl.amount > 0 THEN jl.amount ELSE 0 END) as credit_total,
      SUM(jl.amount) as net_amount
    FROM journal_lines jl
    JOIN journal_entries je ON jl.entry_id = je.id
    JOIN accounts a ON jl.account_id = a.id
    WHERE je.company_id = ? AND je.status = 'POSTED' AND je.is_non_financial = 0
  `;
  const params: any[] = [companyId];

  if (options.startDate) {
    // Balance Sheet accounts (ASSET, LIABILITY, EQUITY) are cumulative as of endDate,
    // while P&L accounts (REVENUE, EXPENSE) are period-bound between startDate and endDate.
    query += ` AND (
      (a.type IN ('REVENUE', 'EXPENSE') AND je.entry_date >= ?)
      OR
      (a.type IN ('ASSET', 'LIABILITY', 'EQUITY'))
    )`;
    params.push(options.startDate);
  }
  if (options.endDate) {
    query += ` AND je.entry_date <= ?`;
    params.push(options.endDate);
  }
  if (options.tag) {
    query += ` AND EXISTS (SELECT 1 FROM json_each(jl.tags) WHERE json_each.value = ?)`;
    params.push(options.tag);
  }

  query += ` GROUP BY jl.account_id`;

  const balanceRows = (db.prepare(query).all(...params) as unknown) as Array<{
    account_id: string;
    debit_total: number;
    credit_total: number;
    net_amount: number;
  }>;

  const balanceMap = new Map<string, { debit: number; credit: number; net: number }>();
  for (const row of balanceRows) {
    balanceMap.set(row.account_id, {
      debit: row.debit_total || 0,
      credit: row.credit_total || 0,
      net: row.net_amount || 0
    });
  }

  // 3. Build Node Map
  const nodeMap = new Map<string, AccountTreeNode>();
  for (const acc of accounts) {
    const raw = balanceMap.get(acc.id) || { debit: 0, credit: 0, net: 0 };
    nodeMap.set(acc.id, {
      ...acc,
      children: [],
      level: (acc.path.match(/\./g) || []).length,
      balance: raw.net,
      debitTotal: raw.debit,
      creditTotal: raw.credit,
      displayBalance: 0
    });
  }

  // 4. Construct Parent-Child hierarchy
  const rootNodes: AccountTreeNode[] = [];
  for (const acc of accounts) {
    const node = nodeMap.get(acc.id)!;
    if (acc.parent_id && nodeMap.has(acc.parent_id)) {
      const parent = nodeMap.get(acc.parent_id)!;
      parent.children.push(node);
    } else {
      rootNodes.push(node);
    }
  }

  // 5. Recursive Rollup computation
  function calculateRollups(node: AccountTreeNode): { debit: number; credit: number; net: number } {
    let childDebit = 0;
    let childCredit = 0;
    let childNet = 0;

    for (const child of node.children) {
      const childRes = calculateRollups(child);
      childDebit += childRes.debit;
      childCredit += childRes.credit;
      childNet += childRes.net;
    }

    node.debitTotal += childDebit;
    node.creditTotal += childCredit;
    node.balance += childNet;

    // Normal balance rule:
    // Assets & Expenses: normal balance = Debit (stored as negative, so display is abs/positive when debit)
    // Liabilities, Equity & Revenue: normal balance = Credit (stored as positive, so display is positive when credit)
    if (node.type === 'ASSET' || node.type === 'EXPENSE') {
      node.displayBalance = -node.balance; // If net is -1000 (Dr), display as +1000
    } else {
      node.displayBalance = node.balance;  // If net is +1000 (Cr), display as +1000
    }

    return {
      debit: node.debitTotal,
      credit: node.creditTotal,
      net: node.balance
    };
  }

  for (const root of rootNodes) {
    calculateRollups(root);
  }

  return rootNodes;
}

/**
 * Flattens hierarchical tree into an ordered list for tabular reports.
 */
export function flattenCoaTree(nodes: AccountTreeNode[]): AccountTreeNode[] {
  const result: AccountTreeNode[] = [];
  function traverse(list: AccountTreeNode[]) {
    for (const item of list) {
      result.push(item);
      if (item.children.length > 0) {
        traverse(item.children);
      }
    }
  }
  traverse(nodes);
  return result;
}
