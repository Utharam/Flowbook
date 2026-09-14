import { NextResponse } from 'next/server';
import { getDb, logAuditEvent } from '@/lib/db';
import { AuditEvent } from '@/lib/db/schema';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'full-system'; // 'full-system', 'entity-snapshot', 'audit-events'
    const companyId = searchParams.get('companyId') || 'cmp_utharam_global';

    const db = getDb();

    // 1. Fetch Audit Event Logs
    if (type === 'audit-events') {
      let query = `SELECT * FROM audit_events WHERE 1=1`;
      const params: any[] = [];

      if (companyId && companyId !== 'ALL') {
        query += ` AND company_id = ?`;
        params.push(companyId);
      }
      query += ` ORDER BY created_at DESC LIMIT 100`;

      const events = db.prepare(query).all(...params) as any[];
      return NextResponse.json({ success: true, events });
    }

    // 2. Export Single Entity Snapshot
    if (type === 'entity-snapshot') {
      const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);
      if (!company) {
        return NextResponse.json({ success: false, error: 'Company not found' }, { status: 404 });
      }

      const officers = db.prepare('SELECT * FROM company_officers WHERE company_id = ?').all(companyId);
      const shareholders = db.prepare('SELECT * FROM shareholding_structure WHERE company_id = ?').all(companyId);
      const accounts = db.prepare('SELECT * FROM accounts WHERE company_id = ?').all(companyId);
      const entries = db.prepare('SELECT * FROM journal_entries WHERE company_id = ?').all(companyId);
      const lines = db.prepare(`
        SELECT jl.* FROM journal_lines jl
        JOIN journal_entries je ON jl.entry_id = je.id
        WHERE je.company_id = ?
      `).all(companyId);
      const templates = db.prepare('SELECT * FROM flow_templates WHERE company_id = ?').all(companyId);
      const assets = db.prepare('SELECT * FROM assets WHERE company_id = ?').all(companyId);
      const queue = db.prepare('SELECT * FROM action_queue WHERE company_id = ?').all(companyId);

      logAuditEvent(companyId, 'BACKUP_GENERATED', 'System Auditor', `Generated entity backup snapshot for ${(company as any).legal_name}`);

      return NextResponse.json({
        success: true,
        backup_type: 'ENTITY_SNAPSHOT',
        version: '1.0.0',
        exported_at: new Date().toISOString(),
        company,
        officers,
        shareholders,
        accounts,
        entries,
        lines,
        templates,
        assets,
        queue
      });
    }

    // 3. Export Full System Backup
    const companies = db.prepare('SELECT * FROM companies').all();
    const officers = db.prepare('SELECT * FROM company_officers').all();
    const shareholders = db.prepare('SELECT * FROM shareholding_structure').all();
    const accounts = db.prepare('SELECT * FROM accounts').all();
    const entries = db.prepare('SELECT * FROM journal_entries').all();
    const lines = db.prepare('SELECT * FROM journal_lines').all();
    const templates = db.prepare('SELECT * FROM flow_templates').all();
    const assets = db.prepare('SELECT * FROM assets').all();
    const queue = db.prepare('SELECT * FROM action_queue').all();
    const links = db.prepare('SELECT * FROM intercompany_links').all();
    const auditLogs = db.prepare('SELECT * FROM audit_events').all();

    logAuditEvent(companyId, 'BACKUP_GENERATED', 'System Administrator', 'Generated complete system-wide financial backup');

    return NextResponse.json({
      success: true,
      backup_type: 'FULL_SYSTEM_BACKUP',
      platform: 'Flowbook by Utharam',
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      data: {
        companies,
        company_officers: officers,
        shareholding_structure: shareholders,
        accounts,
        journal_entries: entries,
        journal_lines: lines,
        flow_templates: templates,
        assets,
        action_queue: queue,
        intercompany_links: links,
        audit_events: auditLogs
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const db = getDb();
    const body = await req.json();
    const { action, backup_data, mode = 'OVERWRITE' } = body;

    if (action !== 'RESTORE_BACKUP' || !backup_data) {
      return NextResponse.json({ success: false, error: 'Invalid restore payload or action' }, { status: 400 });
    }

    const payload = backup_data.data || backup_data;
    const now = new Date().toISOString();

    // 1. Transactional restore
    db.exec('BEGIN TRANSACTION');

    try {
      if (mode === 'OVERWRITE') {
        // Clear existing tables in correct FK dependency order
        db.exec(`
          DELETE FROM audit_events;
          DELETE FROM action_queue;
          DELETE FROM intercompany_links;
          DELETE FROM assets;
          DELETE FROM flow_templates;
          DELETE FROM journal_lines;
          DELETE FROM journal_entries;
          DELETE FROM accounts;
          DELETE FROM shareholding_structure;
          DELETE FROM company_officers;
          DELETE FROM companies;
        `);
      }

      // Restore Companies
      if (Array.isArray(payload.companies)) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO companies (id, legal_name, trade_name, jurisdiction, registration_number, tax_identifier, registered_address, company_type, base_currency, decimal_places, financial_year_start_month, lock_date, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const c of payload.companies) {
          stmt.run(c.id, c.legal_name, c.trade_name || null, c.jurisdiction, c.registration_number, c.tax_identifier || null, c.registered_address || null, c.company_type || 'PVT_LTD', c.base_currency || 'USD', c.decimal_places || 2, c.financial_year_start_month || 4, c.lock_date || null, c.created_at || now);
        }
      }

      // Restore Officers
      if (Array.isArray(payload.company_officers)) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO company_officers (id, company_id, full_name, role, identification_number, appointed_date, resigned_date, is_active, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const o of payload.company_officers) {
          stmt.run(o.id, o.company_id, o.full_name, o.role, o.identification_number || null, o.appointed_date, o.resigned_date || null, o.is_active ?? 1, o.created_at || now);
        }
      }

      // Restore Shareholders
      if (Array.isArray(payload.shareholding_structure)) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO shareholding_structure (id, company_id, shareholder_name, shareholder_type, share_class, number_of_shares, percentage_holding, is_ubo, ubo_controlling_interest_type, effective_from, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const s of payload.shareholding_structure) {
          stmt.run(s.id, s.company_id, s.shareholder_name, s.shareholder_type || 'INDIVIDUAL', s.share_class || 'EQUITY', s.number_of_shares, s.percentage_holding, s.is_ubo ?? 0, s.ubo_controlling_interest_type || null, s.effective_from, s.created_at || now);
        }
      }

      // Restore Accounts
      if (Array.isArray(payload.accounts)) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO accounts (
            id, company_id, code, name, type, parent_id, path, is_group, currency,
            description, tags, sop_steps, trigger_rules, last_reconciled_date,
            last_reconciled_balance, is_active, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const a of payload.accounts) {
          const tagsStr = typeof a.tags === 'string' ? a.tags : JSON.stringify(a.tags || []);
          const sopStr = typeof a.sop_steps === 'string' ? a.sop_steps : JSON.stringify(a.sop_steps || []);
          const triggerStr = typeof a.trigger_rules === 'string' ? a.trigger_rules : JSON.stringify(a.trigger_rules || {});
          stmt.run(
            a.id, a.company_id, a.code, a.name, a.type, a.parent_id || null, a.path, a.is_group ?? 0,
            a.currency || 'USD', a.description || null, tagsStr, sopStr, triggerStr,
            a.last_reconciled_date || null, a.last_reconciled_balance ?? null,
            a.is_active ?? 1, a.created_at || now
          );
        }
      }

      // Restore Journal Entries
      if (Array.isArray(payload.journal_entries)) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO journal_entries (id, company_id, entry_number, entry_date, memo, reference, is_reversal, reversed_from_id, is_non_financial, status, created_by, approved_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const e of payload.journal_entries) {
          stmt.run(e.id, e.company_id, e.entry_number, e.entry_date, e.memo || null, e.reference || null, e.is_reversal ?? 0, e.reversed_from_id || null, e.is_non_financial ?? 0, e.status || 'POSTED', e.created_by || 'System', e.approved_by || null, e.created_at || now);
        }
      }

      // Restore Journal Lines
      if (Array.isArray(payload.journal_lines)) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO journal_lines (
            id, entry_id, account_id, currency, exchange_rate, foreign_amount,
            amount, memo, tags, bank_cleared_date, is_bank_cleared, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const l of payload.journal_lines) {
          stmt.run(
            l.id, l.entry_id, l.account_id, l.currency, l.exchange_rate || 1.0,
            l.foreign_amount, l.amount, l.memo || null,
            typeof l.tags === 'string' ? l.tags : JSON.stringify(l.tags || []),
            l.bank_cleared_date || null, l.is_bank_cleared ?? 0,
            l.created_at || now
          );
        }
      }

      // Restore Flow Templates
      if (Array.isArray(payload.flow_templates)) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO flow_templates (id, company_id, name, category, description, default_tags, variables, steps, template_lines, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const t of payload.flow_templates) {
          stmt.run(t.id, t.company_id, t.name, t.category || 'GENERAL', t.description || null, typeof t.default_tags === 'string' ? t.default_tags : JSON.stringify(t.default_tags || []), typeof t.variables === 'string' ? t.variables : JSON.stringify(t.variables || []), typeof t.steps === 'string' ? t.steps : JSON.stringify(t.steps || []), t.template_lines || null, t.created_at || now);
        }
      }

      // Restore Assets
      if (Array.isArray(payload.assets)) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO assets (
            id, company_id, name, asset_code, category, tag, cost_account_id,
            accumulated_dep_account_id, depreciation_expense_account_id, income_account_id,
            maintenance_account_id, acquisition_date, purchase_cost, currency, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const ast of payload.assets) {
          stmt.run(
            ast.id, ast.company_id, ast.name, ast.asset_code || null, ast.category || null,
            ast.tag || null, ast.cost_account_id || null, ast.accumulated_dep_account_id || null,
            ast.depreciation_expense_account_id || null, ast.income_account_id || null,
            ast.maintenance_account_id || null, ast.acquisition_date || null,
            ast.purchase_cost ?? 0, ast.currency || 'USD', ast.status || 'ACTIVE',
            ast.created_at || now
          );
        }
      }

      // Restore Action Queue
      if (Array.isArray(payload.action_queue)) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO action_queue (id, company_id, type, title, description, severity, status, metadata, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const q of payload.action_queue) {
          stmt.run(q.id, q.company_id, q.type, q.title, q.description, q.severity || 'MEDIUM', q.status || 'PENDING', typeof q.metadata === 'string' ? q.metadata : JSON.stringify(q.metadata || {}), q.created_at || now);
        }
      }

      // Commit transaction
      db.exec('COMMIT');

      // Log Audit Event
      const firstCompanyId = payload.companies?.[0]?.id || 'cmp_utharam_global';
      logAuditEvent(firstCompanyId, 'BACKUP_RESTORED', 'System Administrator', `Restored financial database from backup archive (${payload.companies?.length || 0} entities, ${payload.journal_entries?.length || 0} vouchers).`);

      return NextResponse.json({
        success: true,
        message: `Successfully restored ${payload.companies?.length || 0} entities and ${payload.journal_entries?.length || 0} vouchers.`
      });
    } catch (err: any) {
      db.exec('ROLLBACK');
      throw err;
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
