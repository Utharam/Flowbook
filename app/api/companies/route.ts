import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { Company } from '@/lib/db/schema';

export async function GET() {
  try {
    const db = getDb();
    const companies = (db.prepare('SELECT * FROM companies ORDER BY created_at ASC').all() as unknown) as Company[];
    return NextResponse.json({ success: true, companies });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const db = getDb();
    const body = await req.json();
    
    const {
      action,
      id,
      legal_name,
      trade_name,
      jurisdiction,
      registration_number,
      tax_identifier,
      company_type,
      base_currency,
      decimal_places,
      financial_year_start_month,
      lock_date,
      seed_standard_coa = true
    } = body;

    // 1. CREATE NEW COMPANY ACTION
    if (action === 'CREATE_COMPANY' || !id) {
      if (!legal_name || !jurisdiction || !registration_number) {
        return NextResponse.json({ 
          success: false, 
          error: 'Legal Name, Jurisdiction, and Registration Number are required.' 
        }, { status: 400 });
      }

      const newCompanyId = `cmp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const now = new Date().toISOString();
      const curr = base_currency || 'USD';
      const decimals = decimal_places !== undefined ? Number(decimal_places) : 2;
      const fyMonth = financial_year_start_month !== undefined ? Number(financial_year_start_month) : 4;

      db.prepare(`
        INSERT INTO companies (
          id, legal_name, trade_name, jurisdiction, registration_number,
          tax_identifier, company_type, base_currency, decimal_places,
          financial_year_start_month, lock_date, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        newCompanyId,
        legal_name,
        trade_name || null,
        jurisdiction,
        registration_number,
        tax_identifier || null,
        company_type || 'PVT_LTD',
        curr,
        decimals,
        fyMonth,
        lock_date || null,
        now
      );

      // Seed Standard Chart of Accounts if requested
      if (seed_standard_coa) {
        const standardAccounts = [
          // Top Groups
          { id: `acc_${newCompanyId}_1000`, code: '1000', name: 'Assets', type: 'ASSET', parent_id: null, path: '1000', is_group: 1 },
          { id: `acc_${newCompanyId}_2000`, code: '2000', name: 'Liabilities', type: 'LIABILITY', parent_id: null, path: '2000', is_group: 1 },
          { id: `acc_${newCompanyId}_3000`, code: '3000', name: 'Equity', type: 'EQUITY', parent_id: null, path: '3000', is_group: 1 },
          { id: `acc_${newCompanyId}_4000`, code: '4000', name: 'Revenue', type: 'REVENUE', parent_id: null, path: '4000', is_group: 1 },
          { id: `acc_${newCompanyId}_5000`, code: '5000', name: 'Expenses', type: 'EXPENSE', parent_id: null, path: '5000', is_group: 1 },

          // Current Assets
          { id: `acc_${newCompanyId}_1100`, code: '1100', name: 'Current Assets', type: 'ASSET', parent_id: `acc_${newCompanyId}_1000`, path: '1000.1100', is_group: 1 },
          { id: `acc_${newCompanyId}_1110`, code: '1110', name: 'Bank - Main Operating Account', type: 'ASSET', parent_id: `acc_${newCompanyId}_1100`, path: '1000.1100.1110', is_group: 0, currency: curr },
          { id: `acc_${newCompanyId}_1120`, code: '1120', name: 'Petty Cash', type: 'ASSET', parent_id: `acc_${newCompanyId}_1100`, path: '1000.1100.1120', is_group: 0, currency: curr },
          { id: `acc_${newCompanyId}_1130`, code: '1130', name: 'Accounts Receivable (Trade Debtors)', type: 'ASSET', parent_id: `acc_${newCompanyId}_1100`, path: '1000.1100.1130', is_group: 0, currency: curr },
          { id: `acc_${newCompanyId}_1140`, code: '1140', name: 'Prepaid Expenses', type: 'ASSET', parent_id: `acc_${newCompanyId}_1100`, path: '1000.1100.1140', is_group: 0, currency: curr },

          // Fixed Assets
          { id: `acc_${newCompanyId}_1500`, code: '1500', name: 'Fixed Assets', type: 'ASSET', parent_id: `acc_${newCompanyId}_1000`, path: '1000.1500', is_group: 1 },
          { id: `acc_${newCompanyId}_1510`, code: '1510', name: 'Office Equipment & Computers', type: 'ASSET', parent_id: `acc_${newCompanyId}_1500`, path: '1000.1500.1510', is_group: 0, currency: curr },
          { id: `acc_${newCompanyId}_1520`, code: '1520', name: 'Accumulated Depreciation - Equipment', type: 'ASSET', parent_id: `acc_${newCompanyId}_1500`, path: '1000.1500.1520', is_group: 0, currency: curr },

          // Current Liabilities
          { id: `acc_${newCompanyId}_2100`, code: '2100', name: 'Current Liabilities', type: 'LIABILITY', parent_id: `acc_${newCompanyId}_2000`, path: '2000.2100', is_group: 1 },
          { id: `acc_${newCompanyId}_2110`, code: '2110', name: 'Accounts Payable (Trade Creditors)', type: 'LIABILITY', parent_id: `acc_${newCompanyId}_2100`, path: '2000.2100.2110', is_group: 0, currency: curr },
          { id: `acc_${newCompanyId}_2120`, code: '2120', name: 'Accrued Payroll & Taxes', type: 'LIABILITY', parent_id: `acc_${newCompanyId}_2100`, path: '2000.2100.2120', is_group: 0, currency: curr },
          { id: `acc_${newCompanyId}_2130`, code: '2130', name: 'GST / VAT / Sales Tax Payable', type: 'LIABILITY', parent_id: `acc_${newCompanyId}_2100`, path: '2000.2100.2130', is_group: 0, currency: curr },

          // Equity
          { id: `acc_${newCompanyId}_3100`, code: '3100', name: 'Common Share Capital', type: 'EQUITY', parent_id: `acc_${newCompanyId}_3000`, path: '3000.3100', is_group: 0, currency: curr },
          { id: `acc_${newCompanyId}_3200`, code: '3200', name: 'Retained Earnings', type: 'EQUITY', parent_id: `acc_${newCompanyId}_3000`, path: '3000.3200', is_group: 0, currency: curr },

          // Revenue
          { id: `acc_${newCompanyId}_4100`, code: '4100', name: 'Sales & Service Revenue', type: 'REVENUE', parent_id: `acc_${newCompanyId}_4000`, path: '4000.4100', is_group: 0, currency: curr },
          { id: `acc_${newCompanyId}_4200`, code: '4200', name: 'Other Income & Interest', type: 'REVENUE', parent_id: `acc_${newCompanyId}_4000`, path: '4000.4200', is_group: 0, currency: curr },
          { id: `acc_${newCompanyId}_4900`, code: '4900', name: 'Realized FX Gain / Loss', type: 'REVENUE', parent_id: `acc_${newCompanyId}_4000`, path: '4000.4900', is_group: 0, currency: curr },

          // Expenses
          { id: `acc_${newCompanyId}_5100`, code: '5100', name: 'Salaries & Staff Costs', type: 'EXPENSE', parent_id: `acc_${newCompanyId}_5000`, path: '5000.5100', is_group: 0, currency: curr },
          { id: `acc_${newCompanyId}_5200`, code: '5200', name: 'Rent & Premises Expenses', type: 'EXPENSE', parent_id: `acc_${newCompanyId}_5000`, path: '5000.5200', is_group: 0, currency: curr },
          { id: `acc_${newCompanyId}_5300`, code: '5300', name: 'Utilities & Communication', type: 'EXPENSE', parent_id: `acc_${newCompanyId}_5000`, path: '5000.5300', is_group: 0, currency: curr },
          { id: `acc_${newCompanyId}_5400`, code: '5400', name: 'Software & Technology Services', type: 'EXPENSE', parent_id: `acc_${newCompanyId}_5000`, path: '5000.5400', is_group: 0, currency: curr },
          { id: `acc_${newCompanyId}_5500`, code: '5500', name: 'Depreciation Expense', type: 'EXPENSE', parent_id: `acc_${newCompanyId}_5000`, path: '5000.5500', is_group: 0, currency: curr },
        ];

        const stmtAcc = db.prepare(`
          INSERT INTO accounts (id, company_id, code, name, type, parent_id, path, is_group, currency, is_active, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        `);

        for (const acc of standardAccounts) {
          stmtAcc.run(acc.id, newCompanyId, acc.code, acc.name, acc.type, acc.parent_id, acc.path, acc.is_group, acc.currency || curr, now);
        }
      }

      const created = (db.prepare('SELECT * FROM companies WHERE id = ?').get(newCompanyId) as unknown) as Company;
      return NextResponse.json({ success: true, company: created, message: 'Company created successfully' });
    }

    // 2. UPDATE EXISTING COMPANY
    db.prepare(`
      UPDATE companies SET
        legal_name = ?,
        trade_name = ?,
        jurisdiction = ?,
        registration_number = ?,
        tax_identifier = ?,
        company_type = ?,
        base_currency = ?,
        decimal_places = ?,
        financial_year_start_month = ?,
        lock_date = ?
      WHERE id = ?
    `).run(
      legal_name,
      trade_name || null,
      jurisdiction,
      registration_number,
      tax_identifier || null,
      company_type,
      base_currency,
      decimal_places !== undefined ? Number(decimal_places) : 2,
      financial_year_start_month !== undefined ? Number(financial_year_start_month) : 4,
      lock_date || null,
      id
    );

    const updated = (db.prepare('SELECT * FROM companies WHERE id = ?').get(id) as unknown) as Company;
    return NextResponse.json({ success: true, company: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
