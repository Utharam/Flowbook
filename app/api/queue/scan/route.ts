import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { Company, Asset, Account } from '@/lib/db/schema';

export async function POST(req: Request) {
  try {
    const db = getDb();
    const body = await req.json();
    const companyId = body.companyId || 'cmp_utharam_global';

    const company = (db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as unknown) as Company;
    if (!company) {
      return NextResponse.json({ success: false, error: 'Company not found' }, { status: 404 });
    }

    const now = new Date();
    const currentYearMonth = now.toISOString().substring(0, 7); // e.g. "2026-08"
    const newAlerts: string[] = [];

    // 1. Scan Assets for missing utility or maintenance bills
    const assets = (db.prepare('SELECT * FROM assets WHERE company_id = ? AND status = "ACTIVE"').all(companyId) as unknown) as Asset[];
    for (const ast of assets) {
      if (ast.tag && ast.maintenance_account_id) {
        const billCheck = db.prepare(`
          SELECT COUNT(*) as count FROM journal_lines jl
          JOIN journal_entries je ON jl.entry_id = je.id
          WHERE je.company_id = ? AND je.entry_date LIKE ? AND jl.tags LIKE ? AND jl.account_id = ?
        `).get(companyId, `${currentYearMonth}%`, `%"${ast.tag}"%`, ast.maintenance_account_id) as any;

        if (billCheck?.count === 0) {
          // Check if alert already exists in pending
          const existing = db.prepare(`
            SELECT id FROM action_queue 
            WHERE company_id = ? AND type = 'MISSING_RECURRING_BILL' AND metadata LIKE ? AND status = 'PENDING'
          `).get(companyId, `%"${ast.tag}"%`);

          if (!existing) {
            const queueId = `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            db.prepare(`
              INSERT INTO action_queue (id, company_id, type, title, description, severity, status, metadata, created_at)
              VALUES (?, ?, 'MISSING_RECURRING_BILL', ?, ?, 'MEDIUM', 'PENDING', ?, ?)
            `).run(
              queueId,
              companyId,
              `Missing Recurring Utility / Maintenance for ${ast.name}`,
              `Inactivity Scrutiny Scanner detected no maintenance or utility bill recorded for ${ast.name} (${ast.tag}) in ${currentYearMonth}.`,
              JSON.stringify({ asset_id: ast.id, asset_tag: ast.tag, month: currentYearMonth, account_id: ast.maintenance_account_id }),
              now.toISOString()
            );
            newAlerts.push(`Created missing bill alert for ${ast.name}`);
          }
        }
      }
    }

    // 2. Scan Bank accounts for Dormancy / Attestation Due
    const bankAccounts = (db.prepare(`
      SELECT * FROM accounts 
      WHERE company_id = ? AND is_group = 0 AND (name LIKE '%Bank%' OR name LIKE '%Treasury%')
    `).all(companyId) as unknown) as Account[];

    for (const bank of bankAccounts) {
      const recentTx = db.prepare(`
        SELECT COUNT(*) as count FROM journal_lines jl
        JOIN journal_entries je ON jl.entry_id = je.id
        WHERE je.company_id = ? AND jl.account_id = ? AND je.entry_date >= date('now', '-45 days')
      `).get(companyId, bank.id) as any;

      if (recentTx?.count === 0) {
        const existing = db.prepare(`
          SELECT id FROM action_queue 
          WHERE company_id = ? AND type = 'ATTESTATION_DUE' AND metadata LIKE ? AND status = 'PENDING'
        `).get(companyId, `%"${bank.id}"%`);

        if (!existing) {
          const queueId = `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          db.prepare(`
            INSERT INTO action_queue (id, company_id, type, title, description, severity, status, metadata, created_at)
            VALUES (?, ?, 'ATTESTATION_DUE', ?, ?, 'LOW', 'PENDING', ?, ?)
          `).run(
            queueId,
            companyId,
            `Dormant Account Attestation Required: ${bank.name}`,
            `No transactions detected for ${bank.name} in the last 45 days. Record a Non-Financial Audit Attestation to confirm verified bank balance.`,
            JSON.stringify({ account_id: bank.id, account_name: bank.name, code: bank.code }),
            now.toISOString()
          );
          newAlerts.push(`Created audit attestation reminder for ${bank.name}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      scanned_at: now.toISOString(),
      new_alerts_count: newAlerts.length,
      alerts: newAlerts
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
