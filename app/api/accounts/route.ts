import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { Account, AccountType } from '@/lib/db/schema';
import { getHierarchicalCoa } from '@/lib/engine/coa-tree';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId') || 'cmp_utharam_global';
    const tag = searchParams.get('tag') || undefined;
    const format = searchParams.get('format'); // 'tree' or 'flat'

    if (format === 'tree') {
      const tree = getHierarchicalCoa(companyId, { tag });
      return NextResponse.json({ success: true, tree });
    }

    const db = getDb();
    const accounts = (db.prepare(`
      SELECT * FROM accounts 
      WHERE company_id = ? AND is_active = 1 
      ORDER BY path ASC, code ASC
    `).all(companyId) as unknown) as Account[];

    return NextResponse.json({ success: true, accounts });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * Helper to auto-generate a sensible account code if not provided
 */
function generateNextCode(db: any, companyId: string, type: AccountType, parentId?: string | null): string {
  if (parentId) {
    const parent = db.prepare('SELECT code FROM accounts WHERE id = ?').get(parentId) as any;
    if (parent) {
      // Find highest child code
      const childCount = db.prepare('SELECT COUNT(*) as count FROM accounts WHERE parent_id = ?').get(parentId) as any;
      const count = (childCount?.count || 0) + 1;
      return `${parent.code}.${String(count).padStart(2, '0')}`;
    }
  }

  // Base ranges
  const baseMap: Record<AccountType, number> = {
    ASSET: 1000,
    LIABILITY: 2000,
    EQUITY: 3000,
    REVENUE: 4000,
    EXPENSE: 5000
  };
  const base = baseMap[type] || 5000;
  const highest = db.prepare(`
    SELECT code FROM accounts 
    WHERE company_id = ? AND type = ? AND code NOT LIKE '%.%'
    ORDER BY CAST(code AS INTEGER) DESC LIMIT 1
  `).get(companyId, type) as any;

  if (highest && !isNaN(Number(highest.code))) {
    return String(Number(highest.code) + 10);
  }
  return String(base + 100);
}

export async function POST(req: Request) {
  try {
    const db = getDb();
    const body = await req.json();
    const {
      action,
      company_id,
      code,
      name,
      type,
      parent_id,
      is_group,
      currency,
      description,
      // On-the-fly hierarchy chain: e.g. [{ name: 'Indirect Expenses', is_group: true }, { name: 'Admin Expenses', is_group: true }]
      hierarchy_chain
    } = body;

    if (!company_id || !name || !type) {
      return NextResponse.json({ success: false, error: 'Missing company_id, name, or type' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // 1. If a multi-level hierarchy chain is passed: Create parent groups sequentially on the fly!
    let currentParentId = parent_id || null;

    if (Array.isArray(hierarchy_chain) && hierarchy_chain.length > 0) {
      for (const groupDef of hierarchy_chain) {
        if (!groupDef.name || !groupDef.name.trim()) continue;

        // Check if a group with this name already exists under current parent
        let existingGroup: any = null;
        if (currentParentId) {
          existingGroup = db.prepare(`
            SELECT * FROM accounts 
            WHERE company_id = ? AND parent_id = ? AND name = ? AND is_group = 1
          `).get(company_id, currentParentId, groupDef.name.trim());
        } else {
          existingGroup = db.prepare(`
            SELECT * FROM accounts 
            WHERE company_id = ? AND parent_id IS NULL AND name = ? AND is_group = 1
          `).get(company_id, groupDef.name.trim());
        }

        if (existingGroup) {
          currentParentId = existingGroup.id;
        } else {
          // Generate code and path for this new parent group
          const grpCode = groupDef.code || generateNextCode(db, company_id, type, currentParentId);
          let grpPath = grpCode;
          if (currentParentId) {
            const parentAcc = db.prepare('SELECT path FROM accounts WHERE id = ?').get(currentParentId) as any;
            if (parentAcc) grpPath = `${parentAcc.path}.${grpCode}`;
          }

          const grpId = `acc_grp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          db.prepare(`
            INSERT INTO accounts (id, company_id, code, name, type, parent_id, path, is_group, currency, description, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 1, ?)
          `).run(
            grpId,
            company_id,
            grpCode,
            groupDef.name.trim(),
            type,
            currentParentId,
            grpPath,
            currency || 'USD',
            `Auto-generated parent group: ${groupDef.name.trim()}`,
            now
          );

          currentParentId = grpId;
        }
      }
    }

    // 2. Create the target ledger account under currentParentId
    const finalCode = code && code.trim() ? code.trim() : generateNextCode(db, company_id, type, currentParentId);
    
    let path = finalCode;
    if (currentParentId) {
      const parent = db.prepare('SELECT path FROM accounts WHERE id = ?').get(currentParentId) as any;
      if (parent) {
        path = `${parent.path}.${finalCode}`;
      }
    }

    const id = `acc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    db.prepare(`
      INSERT INTO accounts (id, company_id, code, name, type, parent_id, path, is_group, currency, description, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      id,
      company_id,
      finalCode,
      name.trim(),
      type,
      currentParentId,
      path,
      is_group ? 1 : 0,
      currency || 'USD',
      description || null,
      now
    );

    const createdAccount = (db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as unknown) as Account;
    return NextResponse.json({ 
      success: true, 
      account: createdAccount, 
      accountId: id, 
      path,
      message: 'Ledger created successfully' 
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
