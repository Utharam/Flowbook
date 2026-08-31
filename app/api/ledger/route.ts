import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { Company, Account } from '@/lib/db/schema';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId') || 'cmp_utharam_global';
    const accountId = searchParams.get('accountId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const tag = searchParams.get('tag');

    const db = getDb();
    const company = (db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as unknown) as Company;
    if (!company) {
      return NextResponse.json({ success: false, error: 'Company not found' }, { status: 404 });
    }

    // If no accountId provided, default to first active posting account (e.g. Bank or first account)
    let activeAccount: Account | null = null;
    if (accountId) {
      activeAccount = (db.prepare('SELECT * FROM accounts WHERE id = ? AND company_id = ?').get(accountId, companyId) as unknown) as Account;
    } else {
      activeAccount = (db.prepare('SELECT * FROM accounts WHERE company_id = ? AND is_group = 0 ORDER BY code ASC LIMIT 1').get(companyId) as unknown) as Account;
    }

    if (!activeAccount) {
      return NextResponse.json({ success: false, error: 'No account found' }, { status: 404 });
    }

    // 1. Calculate Opening Balance (all posted transactions before startDate)
    let openingDebit = 0;
    let openingCredit = 0;
    let openingNet = 0;

    if (startDate) {
      let openQuery = `
        SELECT 
          SUM(CASE WHEN jl.amount < 0 THEN ABS(jl.amount) ELSE 0 END) as debit_total,
          SUM(CASE WHEN jl.amount > 0 THEN jl.amount ELSE 0 END) as credit_total,
          SUM(jl.amount) as net_amount
        FROM journal_lines jl
        JOIN journal_entries je ON jl.entry_id = je.id
        WHERE je.company_id = ? AND jl.account_id = ? AND je.status = 'POSTED' AND je.is_non_financial = 0
          AND je.entry_date < ?
      `;
      const openParams: any[] = [companyId, activeAccount.id, startDate];
      if (tag) {
        openQuery += ` AND jl.tags LIKE ?`;
        openParams.push(`%"${tag}"%`);
      }

      const openRes = db.prepare(openQuery).get(...openParams) as any;
      openingDebit = openRes?.debit_total || 0;
      openingCredit = openRes?.credit_total || 0;
      openingNet = openRes?.net_amount || 0;
    }

    // Normal balance conversion for opening balance
    // Asset/Expense: normal balance = Debit (negative signed store -> positive display)
    // Liability/Equity/Revenue: normal balance = Credit (positive signed store -> positive display)
    const isDrNormal = activeAccount.type === 'ASSET' || activeAccount.type === 'EXPENSE';
    const openingDisplayBalance = isDrNormal ? -openingNet : openingNet;

    // 2. Fetch Period Transactions
    let txQuery = `
      SELECT 
        jl.id as line_id,
        jl.amount,
        jl.foreign_amount,
        jl.currency as line_currency,
        jl.exchange_rate,
        jl.memo as line_memo,
        jl.tags,
        je.id as entry_id,
        je.entry_number,
        je.entry_date,
        je.memo as entry_memo,
        je.reference,
        je.is_reversal,
        je.is_non_financial,
        je.created_by
      FROM journal_lines jl
      JOIN journal_entries je ON jl.entry_id = je.id
      WHERE je.company_id = ? AND jl.account_id = ? AND je.status = 'POSTED'
    `;
    const txParams: any[] = [companyId, activeAccount.id];

    if (startDate) {
      txQuery += ` AND je.entry_date >= ?`;
      txParams.push(startDate);
    }
    if (endDate) {
      txQuery += ` AND je.entry_date <= ?`;
      txParams.push(endDate);
    }
    if (tag) {
      txQuery += ` AND jl.tags LIKE ?`;
      txParams.push(`%"${tag}"%`);
    }

    txQuery += ` ORDER BY je.entry_date ASC, je.created_at ASC, jl.id ASC`;

    const txRows = db.prepare(txQuery).all(...txParams) as any[];

    // 3. Compute running balances and parse lines
    let runningNet = openingNet;
    let periodDebitTotal = 0;
    let periodCreditTotal = 0;

    const transactions = txRows.map((tx) => {
      const isDr = tx.amount < 0;
      const isCr = tx.amount > 0;
      const debitAmt = isDr ? Math.abs(tx.amount) : 0;
      const creditAmt = isCr ? tx.amount : 0;

      periodDebitTotal += debitAmt;
      periodCreditTotal += creditAmt;
      runningNet += tx.amount;

      let parsedTags: string[] = [];
      try {
        parsedTags = JSON.parse(tx.tags || '[]');
      } catch {}

      const runningDisplay = isDrNormal ? -runningNet : runningNet;

      return {
        line_id: tx.line_id,
        entry_id: tx.entry_id,
        entry_number: tx.entry_number,
        entry_date: tx.entry_date,
        particulars: tx.line_memo || tx.entry_memo || 'Journal voucher line',
        reference: tx.reference,
        is_reversal: tx.is_reversal === 1,
        is_non_financial: tx.is_non_financial === 1,
        tags: parsedTags,
        currency: tx.line_currency,
        exchange_rate: tx.exchange_rate,
        foreign_amount: tx.foreign_amount,
        debit: debitAmt,
        credit: creditAmt,
        signed_amount: tx.amount,
        running_net_amount: runningNet,
        running_display_balance: runningDisplay,
        running_balance_type: runningNet < 0 ? 'Dr' : runningNet > 0 ? 'Cr' : '-'
      };
    });

    const closingNet = runningNet;
    const closingDisplayBalance = isDrNormal ? -closingNet : closingNet;

    return NextResponse.json({
      success: true,
      company,
      account: activeAccount,
      filters: { startDate, endDate, tag },
      summary: {
        isDrNormal,
        openingDebit,
        openingCredit,
        openingNet,
        openingDisplayBalance,
        openingBalanceType: openingNet < 0 ? 'Dr' : openingNet > 0 ? 'Cr' : '-',
        periodDebitTotal,
        periodCreditTotal,
        periodNetMovement: isDrNormal ? periodDebitTotal - periodCreditTotal : periodCreditTotal - periodDebitTotal,
        closingNet,
        closingDisplayBalance,
        closingBalanceType: closingNet < 0 ? 'Dr' : closingNet > 0 ? 'Cr' : '-'
      },
      transactions
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
