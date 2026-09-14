import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { Asset } from '@/lib/db/schema';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId') || 'cmp_utharam_global';

    const db = getDb();
    const assets = db.prepare(`
      SELECT 
        a.*,
        cost_acc.name as cost_account_name,
        acc_dep.name as accumulated_dep_name,
        dep_exp.name as dep_expense_name,
        inc_acc.name as income_account_name,
        maint_acc.name as maintenance_account_name
      FROM assets a
      LEFT JOIN accounts cost_acc ON a.cost_account_id = cost_acc.id
      LEFT JOIN accounts acc_dep ON a.accumulated_dep_account_id = acc_dep.id
      LEFT JOIN accounts dep_exp ON a.depreciation_expense_account_id = dep_exp.id
      LEFT JOIN accounts inc_acc ON a.income_account_id = inc_acc.id
      LEFT JOIN accounts maint_acc ON a.maintenance_account_id = maint_acc.id
      WHERE a.company_id = ?
      ORDER BY a.name ASC
    `).all(companyId) as any[];

    // Compute live performance per asset based on its tag
    for (const ast of assets) {
      if (ast.tag) {
        const stats = db.prepare(`
          SELECT 
            SUM(CASE WHEN acc.type = 'REVENUE' AND jl.amount > 0 THEN jl.amount ELSE 0 END) as total_income,
            SUM(CASE WHEN acc.type = 'EXPENSE' AND jl.amount < 0 THEN ABS(jl.amount) ELSE 0 END) as total_expenses
          FROM journal_lines jl
          JOIN accounts acc ON jl.account_id = acc.id
          JOIN journal_entries je ON jl.entry_id = je.id
          WHERE je.company_id = ? AND je.status = 'POSTED' AND jl.tags LIKE ?
        `).get(companyId, `%"${ast.tag}"%`) as any;

        ast.total_income = stats?.total_income || 0;
        ast.total_expenses = stats?.total_expenses || 0;
        ast.net_yield = ast.total_income - ast.total_expenses;
      }
    }

    return NextResponse.json({ success: true, assets });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const db = getDb();
    const body = await req.json();
    const {
      company_id,
      name,
      asset_code,
      category,
      acquisition_date,
      purchase_cost,
      currency,
      tag,
      cost_account_id,
      accumulated_dep_account_id,
      depreciation_expense_account_id,
      income_account_id,
      maintenance_account_id
    } = body;

    const id = `ast_${Date.now()}`;
    const now = new Date().toISOString();
    const cost = isNaN(Number(purchase_cost)) ? 0 : Number(purchase_cost);

    db.prepare(`
      INSERT INTO assets (
        id, company_id, name, asset_code, category, acquisition_date,
        purchase_cost, currency, tag, cost_account_id, accumulated_dep_account_id,
        depreciation_expense_account_id, income_account_id, maintenance_account_id, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
    `).run(
      id,
      company_id,
      name,
      asset_code || null,
      category || null,
      acquisition_date || null,
      cost,
      currency || 'USD',
      tag || null,
      cost_account_id || null,
      accumulated_dep_account_id || null,
      depreciation_expense_account_id || null,
      income_account_id || null,
      maintenance_account_id || null,
      now
    );

    return NextResponse.json({ success: true, assetId: id });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
