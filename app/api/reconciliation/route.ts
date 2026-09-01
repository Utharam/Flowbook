import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { Company, Account } from '@/lib/db/schema';
import { generateBankImportTemplate, validateBankImportContent, executeBankImportBatch } from '@/lib/engine/bank-import';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId') || 'cmp_utharam_global';
    const accountId = searchParams.get('accountId');
    const action = searchParams.get('action') || 'template';

    const db = getDb();
    const company = (db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as unknown) as Company;
    if (!company) {
      return NextResponse.json({ success: false, error: 'Company not found' }, { status: 404 });
    }

    if (!accountId) {
      return NextResponse.json({ success: false, error: 'accountId is required' }, { status: 400 });
    }

    const account = (db.prepare('SELECT * FROM accounts WHERE id = ? AND company_id = ?').get(accountId, companyId) as unknown) as Account;
    if (!account) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }

    // Calculate current running balance up to last_reconciled_date
    const isDebitNormal = account.type === 'ASSET' || account.type === 'EXPENSE';
    let startingBalance = 0;

    if (account.last_reconciled_date) {
      const priorLines = db.prepare(`
        SELECT jl.amount
        FROM journal_lines jl
        JOIN journal_entries je ON jl.entry_id = je.id
        WHERE je.company_id = ? AND jl.account_id = ? AND je.status = 'POSTED' AND je.entry_date <= ?
      `).all(companyId, accountId, account.last_reconciled_date) as Array<{ amount: number }>;

      let debits = 0;
      let credits = 0;
      for (const l of priorLines) {
        if (l.amount < 0) debits += Math.abs(l.amount);
        else credits += l.amount;
      }
      startingBalance = isDebitNormal ? (debits - credits) : (credits - debits);
    }

    if (action === 'template') {
      const csvTemplate = generateBankImportTemplate(company, account, startingBalance);
      return new Response(csvTemplate, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="Bank_Import_${account.code}_${new Date().toISOString().substring(0, 10)}.csv"`
        }
      });
    }

    return NextResponse.json({
      success: true,
      account,
      reconciledTillDate: account.last_reconciled_date,
      startingBalance
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const db = getDb();
    const body = await req.json();
    const { action, companyId, accountId, fileContent, validatedRows, actor } = body;

    const company = (db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId || 'cmp_utharam_global') as unknown) as Company;
    if (!company) {
      return NextResponse.json({ success: false, error: 'Company not found' }, { status: 404 });
    }

    const account = (db.prepare('SELECT * FROM accounts WHERE id = ? AND company_id = ?').get(accountId, company.id) as unknown) as Account;
    if (!account) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }

    // 1. VALIDATE UPLOADED STATEMENT CONTENT
    if (action === 'VALIDATE') {
      if (!fileContent) {
        return NextResponse.json({ success: false, error: 'fileContent is required for validation' }, { status: 400 });
      }

      const result = validateBankImportContent(company, account, fileContent);
      return NextResponse.json({
        success: true,
        ...result
      });
    }

    // 2. EXECUTE ATOMIC BATCH JOURNAL POSTING
    if (action === 'POST_BATCH') {
      if (!validatedRows || !Array.isArray(validatedRows) || validatedRows.length === 0) {
        return NextResponse.json({ success: false, error: 'No validated rows provided' }, { status: 400 });
      }

      const result = executeBankImportBatch(company, account, validatedRows, actor || 'Accountant');
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        createdCount: result.createdCount,
        newReconciledDate: result.newReconciledDate,
        message: `Successfully posted ${result.createdCount} journal vouchers. Reconciled date advanced to ${result.newReconciledDate}.`
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
