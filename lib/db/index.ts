import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { AuditEventType } from './schema';

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = path.join(process.cwd(), 'flowbook.sqlite');
  dbInstance = new DatabaseSync(dbPath);

  // Enable WAL mode & foreign keys for enterprise concurrency & integrity
  dbInstance.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  initSchemaAndSeed(dbInstance);
  return dbInstance;
}

export function logAuditEvent(
  companyId: string,
  eventType: AuditEventType,
  actor: string,
  description: string,
  metadata?: any
) {
  try {
    const db = getDb();
    const eventId = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const metaStr = typeof metadata === 'object' ? JSON.stringify(metadata) : metadata || null;

    db.prepare(`
      INSERT INTO audit_events (id, company_id, event_type, actor, description, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(eventId, companyId, eventType, actor || 'System', description, metaStr, now);
  } catch (err) {
    console.error('Failed to log audit event:', err);
  }
}

function initSchemaAndSeed(db: DatabaseSync) {
  // 1. Core Companies / Legal Entities
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      legal_name TEXT NOT NULL,
      trade_name TEXT,
      jurisdiction TEXT NOT NULL,
      registration_number TEXT NOT NULL,
      tax_identifier TEXT,
      registered_address TEXT,
      company_type TEXT NOT NULL DEFAULT 'PVT_LTD',
      base_currency TEXT NOT NULL DEFAULT 'USD',
      decimal_places INTEGER NOT NULL DEFAULT 2,
      financial_year_start_month INTEGER NOT NULL DEFAULT 4,
      lock_date TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS company_officers (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL,
      identification_number TEXT,
      appointed_date TEXT NOT NULL,
      resigned_date TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shareholding_structure (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      shareholder_name TEXT NOT NULL,
      shareholder_type TEXT NOT NULL DEFAULT 'INDIVIDUAL',
      share_class TEXT NOT NULL DEFAULT 'EQUITY',
      number_of_shares REAL NOT NULL,
      percentage_holding REAL NOT NULL,
      is_ubo INTEGER NOT NULL DEFAULT 0,
      ubo_controlling_interest_type TEXT,
      effective_from TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      parent_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
      path TEXT NOT NULL,
      is_group INTEGER NOT NULL DEFAULT 0,
      currency TEXT,
      description TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      sop_steps TEXT NOT NULL DEFAULT '[]',
      trigger_rules TEXT NOT NULL DEFAULT '{}',
      last_reconciled_date TEXT,
      last_reconciled_balance REAL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      entry_number TEXT NOT NULL,
      entry_date TEXT NOT NULL,
      memo TEXT,
      reference TEXT,
      is_reversal INTEGER NOT NULL DEFAULT 0,
      reversed_from_id TEXT REFERENCES journal_entries(id) ON DELETE SET NULL,
      is_non_financial INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'POSTED',
      created_by TEXT NOT NULL DEFAULT 'System',
      approved_by TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS journal_lines (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
      currency TEXT NOT NULL,
      exchange_rate REAL NOT NULL DEFAULT 1.0,
      foreign_amount REAL NOT NULL,
      amount REAL NOT NULL,
      memo TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      bank_cleared_date TEXT,
      is_bank_cleared INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS flow_templates (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      default_tags TEXT NOT NULL DEFAULT '[]',
      variables TEXT NOT NULL DEFAULT '[]',
      steps TEXT NOT NULL DEFAULT '[]',
      template_lines TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      tag TEXT NOT NULL,
      cost_account_id TEXT NOT NULL REFERENCES accounts(id),
      accumulated_dep_account_id TEXT REFERENCES accounts(id),
      depreciation_expense_account_id TEXT REFERENCES accounts(id),
      income_account_id TEXT REFERENCES accounts(id),
      maintenance_account_id TEXT REFERENCES accounts(id),
      acquisition_date TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS action_queue (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'MEDIUM',
      status TEXT NOT NULL DEFAULT 'PENDING',
      metadata TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS intercompany_links (
      id TEXT PRIMARY KEY,
      source_company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      source_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      target_company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      target_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      mirror_direction_inverse INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      actor TEXT NOT NULL DEFAULT 'System',
      description TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Safe migrations for existing SQLite database
  try { db.exec(`ALTER TABLE companies ADD COLUMN registered_address TEXT;`); } catch {}
  try { db.exec(`ALTER TABLE accounts ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';`); } catch {}
  try { db.exec(`ALTER TABLE accounts ADD COLUMN sop_steps TEXT NOT NULL DEFAULT '[]';`); } catch {}
  try { db.exec(`ALTER TABLE accounts ADD COLUMN trigger_rules TEXT NOT NULL DEFAULT '{}';`); } catch {}
  try { db.exec(`ALTER TABLE accounts ADD COLUMN last_reconciled_date TEXT;`); } catch {}
  try { db.exec(`ALTER TABLE accounts ADD COLUMN last_reconciled_balance REAL;`); } catch {}
  try { db.exec(`ALTER TABLE journal_lines ADD COLUMN bank_cleared_date TEXT;`); } catch {}
  try { db.exec(`ALTER TABLE journal_lines ADD COLUMN is_bank_cleared INTEGER NOT NULL DEFAULT 0;`); } catch {}

  seedInitialData(db);
}

function seedInitialData(db: DatabaseSync) {
  const companyCheck = db.prepare('SELECT COUNT(*) as count FROM companies').get() as { count: number };
  if (companyCheck && companyCheck.count > 0) {
    upgradeTemplatesIfLegacy(db);
    seedDefaultSopsIfMissing(db);
    return;
  }

  const now = new Date().toISOString();

  // 1. Seed Main Company (India HQ)
  db.prepare(`
    INSERT INTO companies (
      id, legal_name, trade_name, jurisdiction, registration_number, 
      tax_identifier, registered_address, company_type, base_currency, decimal_places, 
      financial_year_start_month, lock_date, created_at
    ) VALUES (
      'cmp_utharam_global', 'Utharam Enterprises Private Limited', 'Utharam Global',
      'India', 'U72900KA2024PTC188231', '29ABCDE1234F1Z5', 'Level 8, Nexus Cyber Tower, Bengaluru 560100, India', 'PVT_LTD',
      'USD', 2, 4, '2025-12-31', ?
    )
  `).run(now);

  // 2. Seed Subsidiary Company (UAE FZ-LLC)
  db.prepare(`
    INSERT INTO companies (
      id, legal_name, trade_name, jurisdiction, registration_number, 
      tax_identifier, registered_address, company_type, base_currency, decimal_places, 
      financial_year_start_month, lock_date, created_at
    ) VALUES (
      'cmp_utharam_mea', 'Utharam MEA FZ-LLC', 'Utharam Middle East',
      'UAE', 'FZ-LLC-2025-9981', 'TRN-100298374600003', 'Office 402, Building 3, Dubai Internet City, Dubai, UAE', 'LLC',
      'AED', 2, 1, '2025-12-31', ?
    )
  `).run(now);

  // 3. Officers & Directors
  const insertOfficer = db.prepare(`
    INSERT INTO company_officers (id, company_id, full_name, role, identification_number, appointed_date, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  `);
  insertOfficer.run('off_1', 'cmp_utharam_global', 'Utharam Krishnan', 'DIRECTOR', 'DIN-00984721', '2024-04-01', now);
  insertOfficer.run('off_2', 'cmp_utharam_global', 'Siddharth V.', 'MANAGING_DIRECTOR', 'DIN-01029384', '2024-04-01', now);
  insertOfficer.run('off_3', 'cmp_utharam_mea', 'Amina Al-Mansoor', 'DIRECTOR', 'EID-784-1988-1234567-1', '2025-01-15', now);

  // 4. Cap Table & UBOs
  const insertShareholder = db.prepare(`
    INSERT INTO shareholding_structure (id, company_id, shareholder_name, shareholder_type, share_class, number_of_shares, percentage_holding, is_ubo, ubo_controlling_interest_type, effective_from, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertShareholder.run('sh_1', 'cmp_utharam_global', 'Utharam Krishnan', 'INDIVIDUAL', 'EQUITY', 510000, 51.0, 1, 'VOTING_RIGHTS', '2024-04-01', now);
  insertShareholder.run('sh_2', 'cmp_utharam_global', 'Siddharth V.', 'INDIVIDUAL', 'EQUITY', 290000, 29.0, 1, 'VOTING_RIGHTS', '2024-04-01', now);
  insertShareholder.run('sh_3', 'cmp_utharam_global', 'Nexus Capital Ventures Ltd', 'CORPORATE_BODY', 'PREFERENCE', 200000, 20.0, 0, null, '2024-08-15', now);
  insertShareholder.run('sh_4', 'cmp_utharam_mea', 'Utharam Enterprises Private Limited', 'CORPORATE_BODY', 'EQUITY', 100000, 100.0, 1, 'DIRECT_EQUITY', '2025-01-15', now);

  // 5. Chart of Accounts Tree (Global Parent)
  const coaData = [
    // Top Level Groups
    { id: 'acc_1000', code: '1000', name: 'Assets', type: 'ASSET', parent_id: null, path: '1000', is_group: 1 },
    { id: 'acc_2000', code: '2000', name: 'Liabilities', type: 'LIABILITY', parent_id: null, path: '2000', is_group: 1 },
    { id: 'acc_3000', code: '3000', name: 'Equity', type: 'EQUITY', parent_id: null, path: '3000', is_group: 1 },
    { id: 'acc_4000', code: '4000', name: 'Revenue', type: 'REVENUE', parent_id: null, path: '4000', is_group: 1 },
    { id: 'acc_5000', code: '5000', name: 'Expenses', type: 'EXPENSE', parent_id: null, path: '5000', is_group: 1 },

    // Asset Sub-groups & Accounts
    { id: 'acc_1100', code: '1100', name: 'Current Assets', type: 'ASSET', parent_id: 'acc_1000', path: '1000.1100', is_group: 1 },
    { id: 'acc_1110', code: '1110', name: 'Cash & Operating Bank Account', type: 'ASSET', parent_id: 'acc_1100', path: '1000.1100.1110', is_group: 0, currency: 'USD', tags: '["#Bank", "#Treasury"]' },
    { id: 'acc_1120', code: '1120', name: 'Treasury & FX Liquidity (EUR)', type: 'ASSET', parent_id: 'acc_1100', path: '1000.1100.1120', is_group: 0, currency: 'EUR', tags: '["#Treasury", "#EUR"]' },
    { id: 'acc_1130', code: '1130', name: 'Accounts Receivable (Trade Debtors)', type: 'ASSET', parent_id: 'acc_1100', path: '1000.1100.1130', is_group: 0, currency: 'USD', tags: '["#AR", "#Customers"]' },
    { id: 'acc_1140', code: '1140', name: 'Intercompany Receivable (Utharam MEA)', type: 'ASSET', parent_id: 'acc_1100', path: '1000.1100.1140', is_group: 0, currency: 'USD', tags: '["#Intercompany"]' },

    // Fixed Assets Cluster
    { id: 'acc_1500', code: '1500', name: 'Fixed Assets', type: 'ASSET', parent_id: 'acc_1000', path: '1000.1500', is_group: 1 },
    { id: 'acc_1510', code: '1510', name: 'Commercial Property Unit #1206', type: 'ASSET', parent_id: 'acc_1500', path: '1000.1500.1510', is_group: 0, currency: 'USD', tags: '["#1206", "#RealEstate"]' },
    { id: 'acc_1520', code: '1520', name: 'Accumulated Depreciation - Unit #1206', type: 'ASSET', parent_id: 'acc_1500', path: '1000.1500.1520', is_group: 0, currency: 'USD', tags: '["#1206", "#Depreciation"]' },

    // Liabilities
    { id: 'acc_2100', code: '2100', name: 'Current Liabilities', type: 'LIABILITY', parent_id: 'acc_2000', path: '2000.2100', is_group: 1 },
    { id: 'acc_2110', code: '2110', name: 'Accounts Payable (Trade Creditors)', type: 'LIABILITY', parent_id: 'acc_2100', path: '2000.2100.2110', is_group: 0, currency: 'USD', tags: '["#AP", "#Vendors"]' },
    { id: 'acc_2120', code: '2120', name: 'Accrued Payroll & Taxes', type: 'LIABILITY', parent_id: 'acc_2100', path: '2000.2100.2120', is_group: 0, currency: 'USD', tags: '["#Payroll"]' },
    { id: 'acc_2130', code: '2130', name: 'Intercompany Payable (Utharam MEA)', type: 'LIABILITY', parent_id: 'acc_2100', path: '2000.2100.2130', is_group: 0, currency: 'USD', tags: '["#Intercompany"]' },

    // Equity
    { id: 'acc_3100', code: '3100', name: 'Common Share Capital', type: 'EQUITY', parent_id: 'acc_3000', path: '3000.3100', is_group: 0, currency: 'USD', tags: '["#Capital"]' },
    { id: 'acc_3200', code: '3200', name: 'Retained Earnings', type: 'EQUITY', parent_id: 'acc_3000', path: '3000.3200', is_group: 0, currency: 'USD' },

    // Revenue
    { id: 'acc_4100', code: '4100', name: 'Enterprise SaaS & Subscription Revenue', type: 'REVENUE', parent_id: 'acc_4000', path: '4000.4100', is_group: 0, currency: 'USD', tags: '["#SaaS", "#Revenue"]' },
    { id: 'acc_4200', code: '4200', name: 'Commercial Property Rental Income (#1206)', type: 'REVENUE', parent_id: 'acc_4000', path: '4000.4200', is_group: 0, currency: 'USD', tags: '["#1206", "#Rental"]' },
    { id: 'acc_4900', code: '4900', name: 'Realized FX Gain / Loss', type: 'REVENUE', parent_id: 'acc_4000', path: '4000.4900', is_group: 0, currency: 'USD', tags: '["#FX"]' },

    // Expenses
    { id: 'acc_5100', code: '5100', name: 'Salaries & Staff Costs', type: 'EXPENSE', parent_id: 'acc_5000', path: '5000.5100', is_group: 0, currency: 'USD', tags: '["#Payroll", "#HR"]' },
    { id: 'acc_5200', code: '5200', name: 'Office Rent & Facilities', type: 'EXPENSE', parent_id: 'acc_5000', path: '5000.5200', is_group: 0, currency: 'USD', tags: '["#HQ", "#Rent"]' },
    { id: 'acc_5300', code: '5300', name: 'Unit #1206 Maintenance & Utilities', type: 'EXPENSE', parent_id: 'acc_5000', path: '5000.5300', is_group: 0, currency: 'USD', tags: '["#1206", "#Maintenance"]' },
    { id: 'acc_5400', code: '5400', name: 'Cloud Server Infrastructure', type: 'EXPENSE', parent_id: 'acc_5000', path: '5000.5400', is_group: 0, currency: 'USD', tags: '["#AWS", "#Infrastructure"]' },
    { id: 'acc_5500', code: '5500', name: 'Depreciation Expense - Real Estate', type: 'EXPENSE', parent_id: 'acc_5000', path: '5000.5500', is_group: 0, currency: 'USD', tags: '["#Depreciation"]' },
  ];

  const insertCoa = db.prepare(`
    INSERT INTO accounts (id, company_id, code, name, type, parent_id, path, is_group, currency, tags, is_active, created_at)
    VALUES (?, 'cmp_utharam_global', ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `);
  for (const acc of coaData) {
    insertCoa.run(acc.id, acc.code, acc.name, acc.type, acc.parent_id, acc.path, acc.is_group, acc.currency || 'USD', acc.tags || '[]', now);
  }

  // 6. Seed Multi-Step Flow Templates
  seedMultiStepTemplates(db, now);

  // 7. Seed Asset Cluster for Unit #1206
  db.prepare(`
    INSERT INTO assets (
      id, company_id, name, tag, cost_account_id, accumulated_dep_account_id,
      depreciation_expense_account_id, income_account_id, maintenance_account_id,
      acquisition_date, status, created_at
    ) VALUES (
      'ast_1206', 'cmp_utharam_global', 'Commercial Office Unit #1206', '#1206',
      'acc_1510', 'acc_1520', 'acc_5500', 'acc_4200', 'acc_5300',
      '2024-06-01', 'ACTIVE', ?
    )
  `).run(now);

  // 8. Seed Initial Opening Balances & Sample Multi-Currency Transactions
  seedSampleJournalEntries(db, now);

  // 9. Seed Default SOPs and Trigger Rules
  seedDefaultSopsIfMissing(db);

  // 10. Log Initial Audit Event
  logAuditEvent('cmp_utharam_global', 'COMPANY_CREATED', 'System Seeder', 'Initialized Utharam Enterprises Private Limited corporate books');
}

function seedDefaultSopsIfMissing(db: DatabaseSync) {
  try {
    // 1. SOP for Office Rent (acc_5200)
    db.prepare(`
      UPDATE accounts SET 
        sop_steps = ?,
        trigger_rules = ?
      WHERE id = 'acc_5200' AND (sop_steps = '[]' OR sop_steps IS NULL)
    `).run(
      JSON.stringify([
        { step_number: 1, title: 'Verify Lease Agreement', instruction: 'Confirm monthly rent matches the current signed lease terms and landlord tax ID.' },
        { step_number: 2, title: 'TDS / Withholding Tax', instruction: 'Ensure TDS Section 194-I (10%) or applicable local withholding is deducted before bank release.' },
        { step_number: 3, title: 'Landlord Receipt Acknowledgment', instruction: 'Collect and archive the official rent receipt in the document vault.' }
      ]),
      JSON.stringify({
        min_monthly_transactions: 1,
        max_single_transaction_limit: 10000,
        alert_on_unusual_variance: true
      })
    );

    // 2. SOP for Unit #1206 Maintenance (acc_5300)
    db.prepare(`
      UPDATE accounts SET 
        sop_steps = ?,
        trigger_rules = ?
      WHERE id = 'acc_5300' AND (sop_steps = '[]' OR sop_steps IS NULL)
    `).run(
      JSON.stringify([
        { step_number: 1, title: 'Collect Service Work Order', instruction: 'Verify technician work completion certificate and vendor tax invoice.' },
        { step_number: 2, title: 'Tag Assignment (#1206)', instruction: 'Confirm the voucher line item is strictly tagged with #1206 for asset clustering.' },
        { step_number: 3, title: 'Property Manager Sign-Off', instruction: 'Obtain approval from the facilities manager before posting payment.' }
      ]),
      JSON.stringify({
        max_single_transaction_limit: 5000,
        alert_on_unusual_variance: true
      })
    );

    // 3. Set default reconciled date for Operating Bank Account (acc_1110)
    db.prepare(`
      UPDATE accounts SET last_reconciled_date = '2026-01-31'
      WHERE id = 'acc_1110' AND last_reconciled_date IS NULL
    `).run();
  } catch {}
}

function seedMultiStepTemplates(db: DatabaseSync, now: string) {
  const insertTpl = db.prepare(`
    INSERT INTO flow_templates (id, company_id, name, category, description, default_tags, variables, steps, created_at)
    VALUES (?, 'cmp_utharam_global', ?, ?, ?, ?, ?, ?, ?)
  `);

  // Template 1: Direct Cash Sales with Instant Receipt (2 Steps)
  insertTpl.run(
    'tpl_cash_sales',
    'Direct Cash Sales with Instant Receipt',
    'SALES',
    '2-Step batch: Creates Sales / Receivable entry and immediately executes Cash / Bank receipt settlement.',
    JSON.stringify(['#CashSale', '#Retail']),
    JSON.stringify([
      { key: 'customer_account', label: 'Customer / Debtor Account', account_type: 'ASSET', default_account_id: 'acc_1130' }
    ]),
    JSON.stringify([
      {
        id: 'step_1',
        step_number: 1,
        title: 'Step 1: Sales / Receivable Entry',
        narration_template: 'Being amount receivable towards the sale of {purpose} vide invoice no {document_no} dated {document_date}',
        reference_template: '{document_no}',
        lines: [
          { direction: 'DEBIT', account_mode: 'VARIABLE', variable_key: 'customer_account', memo_template: 'Receivable for {document_no}', default_tags: ['#CashSale'] },
          { direction: 'CREDIT', account_mode: 'CONSTANT', account_id: 'acc_4100', memo_template: 'Sales revenue for {purpose}', default_tags: ['#CashSale'] }
        ]
      },
      {
        id: 'step_2',
        step_number: 2,
        title: 'Step 2: Receipt / Cash Settlement',
        narration_template: 'Being amount received towards the sale of {purpose} vide invoice no {document_no} dated {document_date}',
        reference_template: 'RCP:{document_no}',
        lines: [
          { direction: 'DEBIT', account_mode: 'CONSTANT', account_id: 'acc_1110', memo_template: 'Cash/Bank collection for {document_no}', default_tags: ['#CashSale'] },
          { direction: 'CREDIT', account_mode: 'VARIABLE', variable_key: 'customer_account', memo_template: 'Clearance of receivable {document_no}', default_tags: ['#CashSale'] }
        ]
      }
    ]),
    now
  );

  // Template 2: Vendor Bill & Direct Bank Payout (2 Steps)
  insertTpl.run(
    'tpl_vendor_payout',
    'Vendor Purchase Bill & Direct Bank Payment',
    'PURCHASES',
    '2-Step batch: Accrues vendor payable against expense and executes immediate bank payout.',
    JSON.stringify(['#VendorBill', '#Procurement']),
    JSON.stringify([
      { key: 'vendor_account', label: 'Vendor / Creditor Account', account_type: 'LIABILITY', default_account_id: 'acc_2110' },
      { key: 'expense_account', label: 'Expense / Asset Account', account_type: 'EXPENSE', default_account_id: 'acc_5200' }
    ]),
    JSON.stringify([
      {
        id: 'step_1',
        step_number: 1,
        title: 'Step 1: Vendor Expense Accrual',
        narration_template: 'Being expense recognized for {purpose} vide vendor bill no {document_no} dated {document_date}',
        reference_template: '{document_no}',
        lines: [
          { direction: 'DEBIT', account_mode: 'VARIABLE', variable_key: 'expense_account', memo_template: 'Expense for {purpose}', default_tags: ['#VendorBill'] },
          { direction: 'CREDIT', account_mode: 'VARIABLE', variable_key: 'vendor_account', memo_template: 'Payable to vendor for {document_no}', default_tags: ['#VendorBill'] }
        ]
      },
      {
        id: 'step_2',
        step_number: 2,
        title: 'Step 2: Bank Payout Settlement',
        narration_template: 'Being bank payment released towards {purpose} against bill no {document_no} dated {document_date}',
        reference_template: 'PAY:{document_no}',
        lines: [
          { direction: 'DEBIT', account_mode: 'VARIABLE', variable_key: 'vendor_account', memo_template: 'Settlement of bill {document_no}', default_tags: ['#VendorBill'] },
          { direction: 'CREDIT', account_mode: 'CONSTANT', account_id: 'acc_1110', memo_template: 'Bank payout for {document_no}', default_tags: ['#VendorBill'] }
        ]
      }
    ]),
    now
  );

  // Template 3: Monthly Staff Payroll Accrual & Disbursal (2 Steps)
  insertTpl.run(
    'tpl_payroll_batch',
    'Monthly Staff Payroll Accrual & Bank Disbursal',
    'PAYROLL',
    '2-Step batch: Accrues monthly gross staff salaries and records the net direct bank payout.',
    JSON.stringify(['#Payroll', '#HR']),
    JSON.stringify([]),
    JSON.stringify([
      {
        id: 'step_1',
        step_number: 1,
        title: 'Step 1: Payroll Accrual',
        narration_template: 'Being salary accrual for the month of {purpose} vide payroll register {document_no} dated {document_date}',
        reference_template: '{document_no}',
        lines: [
          { direction: 'DEBIT', account_mode: 'CONSTANT', account_id: 'acc_5100', memo_template: 'Monthly Gross Salaries - {purpose}', default_tags: ['#Payroll'] },
          { direction: 'CREDIT', account_mode: 'CONSTANT', account_id: 'acc_2120', memo_template: 'Net Accrued Payroll - {purpose}', default_tags: ['#Payroll'] }
        ]
      },
      {
        id: 'step_2',
        step_number: 2,
        title: 'Step 2: Bank Salary Disbursal',
        narration_template: 'Being bank salary payout executed for {purpose} vide bank batch advice {document_no}',
        reference_template: 'DISB:{document_no}',
        lines: [
          { direction: 'DEBIT', account_mode: 'CONSTANT', account_id: 'acc_2120', memo_template: 'Payroll clearance - {purpose}', default_tags: ['#Payroll'] },
          { direction: 'CREDIT', account_mode: 'CONSTANT', account_id: 'acc_1110', memo_template: 'Bank salary wire for {purpose}', default_tags: ['#Payroll'] }
        ]
      }
    ]),
    now
  );
}

function upgradeTemplatesIfLegacy(db: DatabaseSync) {
  try {
    const existing = db.prepare("SELECT * FROM flow_templates WHERE id = 'tpl_cash_sales'").get() as any;
    if (existing) {
      const steps = JSON.parse(existing.steps || '[]');
      if (steps.length > 0) return; // Already up to date!
    }
    // Delete legacy templates and re-seed
    db.prepare('DELETE FROM flow_templates').run();
    seedMultiStepTemplates(db, new Date().toISOString());
  } catch {}
}

function seedSampleJournalEntries(db: DatabaseSync, now: string) {
  // JV 1: Opening Share Capital ($800,000)
  db.prepare(`
    INSERT INTO journal_entries (id, company_id, entry_number, entry_date, memo, reference, is_reversal, is_non_financial, status, created_by, created_at)
    VALUES ('jv_2026_001', 'cmp_utharam_global', 'JV-2026-0001', '2026-01-01', 'Initial Common Share Capital Inflow', 'EQUITY-INIT', 0, 0, 'POSTED', 'System', ?)
  `).run(now);

  db.prepare(`
    INSERT INTO journal_lines (id, entry_id, account_id, currency, exchange_rate, foreign_amount, amount, memo, tags, created_at)
    VALUES 
      ('ln_1', 'jv_2026_001', 'acc_1110', 'USD', 1.0, -800000, -800000, 'Operating Bank Capital Deposit', '["#Capital"]', ?),
      ('ln_2', 'jv_2026_001', 'acc_3100', 'USD', 1.0, 800000, 800000, 'Common Equity Shares Issued', '["#Capital"]', ?)
  `).run(now, now);

  // JV 2: Acquisition of Commercial Unit #1206 ($500,000)
  db.prepare(`
    INSERT INTO journal_entries (id, company_id, entry_number, entry_date, memo, reference, is_reversal, is_non_financial, status, created_by, created_at)
    VALUES ('jv_2026_002', 'cmp_utharam_global', 'JV-2026-0002', '2026-01-05', 'Acquisition of Commercial Property Unit #1206', 'TITLE-DEED-1206', 0, 0, 'POSTED', 'System', ?)
  `).run(now);

  db.prepare(`
    INSERT INTO journal_lines (id, entry_id, account_id, currency, exchange_rate, foreign_amount, amount, memo, tags, created_at)
    VALUES 
      ('ln_3', 'jv_2026_002', 'acc_1510', 'USD', 1.0, -500000, -500000, 'Property Purchase Unit #1206', '["#1206", "#RealEstate"]', ?),
      ('ln_4', 'jv_2026_002', 'acc_1110', 'USD', 1.0, 500000, 500000, 'Bank Wire Payout for Property Acquisition', '["#1206", "#RealEstate"]', ?)
  `).run(now, now);

  // JV 3: Enterprise Subscription Revenue from European Client (EUR 50,000 @ 1.08 = USD 54,000)
  db.prepare(`
    INSERT INTO journal_entries (id, company_id, entry_number, entry_date, memo, reference, is_reversal, is_non_financial, status, created_by, created_at)
    VALUES ('jv_2026_003', 'cmp_utharam_global', 'JV-2026-0003', '2026-01-15', 'Q1 Enterprise License - DACH Region Client', 'INV-EUR-2026-01', 0, 0, 'POSTED', 'System', ?)
  `).run(now);

  db.prepare(`
    INSERT INTO journal_lines (id, entry_id, account_id, currency, exchange_rate, foreign_amount, amount, memo, tags, created_at)
    VALUES 
      ('ln_5', 'jv_2026_003', 'acc_1120', 'EUR', 1.08, -50000, -54000, 'EUR Treasury Inflow (50k EUR @ 1.08 USD)', '["#SaaS", "#Europe"]', ?),
      ('ln_6', 'jv_2026_003', 'acc_4100', 'USD', 1.0, 54000, 54000, 'Recognized SaaS Revenue Q1', '["#SaaS", "#Europe"]', ?)
  `).run(now, now);

  // JV 4: Commercial Unit #1206 Monthly Rental Income ($4,500)
  db.prepare(`
    INSERT INTO journal_entries (id, company_id, entry_number, entry_date, memo, reference, is_reversal, is_non_financial, status, created_by, created_at)
    VALUES ('jv_2026_004', 'cmp_utharam_global', 'JV-2026-0004', '2026-02-01', 'Monthly Lease Rent Unit #1206 - Feb 2026', 'LEASE-RENT-FEB', 0, 0, 'POSTED', 'System', ?)
  `).run(now);

  db.prepare(`
    INSERT INTO journal_lines (id, entry_id, account_id, currency, exchange_rate, foreign_amount, amount, memo, tags, created_at)
    VALUES 
      ('ln_7', 'jv_2026_004', 'acc_1110', 'USD', 1.0, -4500, -4500, 'Bank Deposit - Unit 1206 Rental', '["#1206"]', ?),
      ('ln_8', 'jv_2026_004', 'acc_4200', 'USD', 1.0, 4500, 4500, 'Rental Income - Unit 1206 Feb', '["#1206"]', ?)
  `).run(now, now);

  // JV 5: Office Rent Payment ($4,000)
  db.prepare(`
    INSERT INTO journal_entries (id, company_id, entry_number, entry_date, memo, reference, is_reversal, is_non_financial, status, created_by, created_at)
    VALUES ('jv_2026_005', 'cmp_utharam_global', 'JV-2026-0005', '2026-02-10', 'Corporate HQ Office Rent - Feb 2026', 'HQ-LEASE-FEB', 0, 0, 'POSTED', 'System', ?)
  `).run(now);

  db.prepare(`
    INSERT INTO journal_lines (id, entry_id, account_id, currency, exchange_rate, foreign_amount, amount, memo, tags, created_at)
    VALUES 
      ('ln_9', 'jv_2026_005', 'acc_5200', 'USD', 1.0, -4000, -4000, 'HQ Office Rent Payment', '["#HQ-Rent"]', ?),
      ('ln_10', 'jv_2026_005', 'acc_1110', 'USD', 1.0, 4000, 4000, 'Bank Wire to Landlord', '["#HQ-Rent"]', ?)
  `).run(now, now);

  // JV 6: Cloud Server Infrastructure ($2,500)
  db.prepare(`
    INSERT INTO journal_entries (id, company_id, entry_number, entry_date, memo, reference, is_reversal, is_non_financial, status, created_by, created_at)
    VALUES ('jv_2026_006', 'cmp_utharam_global', 'JV-2026-0006', '2026-02-28', 'AWS Cloud Cluster Infrastructure Bill', 'AWS-2026-02', 0, 0, 'POSTED', 'System', ?)
  `).run(now);

  db.prepare(`
    INSERT INTO journal_lines (id, entry_id, account_id, currency, exchange_rate, foreign_amount, amount, memo, tags, created_at)
    VALUES 
      ('ln_11', 'jv_2026_006', 'acc_5400', 'USD', 1.0, -2500, -2500, 'Production Server Cluster & Storage', '["#Infrastructure"]', ?),
      ('ln_12', 'jv_2026_006', 'acc_1110', 'USD', 1.0, 2500, 2500, 'Corporate Card Settlement', '["#Infrastructure"]', ?)
  `).run(now, now);

  // Seed sample action queue item
  db.prepare(`
    INSERT INTO action_queue (id, company_id, type, title, description, severity, status, metadata, created_at)
    VALUES (
      'q_demo_01', 'cmp_utharam_global', 'INTERCOMPANY_MIRROR_DRAFT',
      'Pending Intercompany Mirror Voucher from Utharam MEA',
      'Utharam MEA recorded an intercompany software development service invoice of AED 36,700 ($10,000). Awaiting parent review.',
      'HIGH', 'PENDING',
      '{"source_company":"Utharam MEA FZ-LLC","source_entry":"JV-2026-0012","proposed_amount":10000,"debit_account":"acc_5400","credit_account":"acc_2130","memo":"Intercompany Software Consulting Service"}',
      ?
    )
  `).run(now);
}
