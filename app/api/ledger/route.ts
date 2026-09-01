import { NextResponse } from 'next/server';
import { getDb, logAuditEvent } from '@/lib/db';
import { Company, Account } from '@/lib/db/schema';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId') || 'cmp_utharam_global';
    const accountId = searchParams.get('accountId');
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const tag = searchParams.get('tag') || undefined;

    const db = getDb();

    const company = (db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as unknown) as Company;
    if (!company) {
      return NextResponse.json({ success: false, error: 'Company not found' }, { status: 404 });
    }

    // 1. TIER 1: LEDGER DIRECTORY SUMMARY (When accountId is omitted)
    if (!accountId) {
      const accounts = (db.prepare(`
        SELECT * FROM accounts 
        WHERE company_id = ? 
        ORDER BY code ASC
      `).all(companyId) as unknown) as Account[];

      // Compute summary metrics for each leaf account
      const directoryList = accounts.map(acc => {
        const lines = db.prepare(`
          SELECT jl.amount, jl.currency
          FROM journal_lines jl
          JOIN journal_entries je ON jl.entry_id = je.id
          WHERE je.company_id = ? AND jl.account_id = ? AND je.status = 'POSTED'
        `).all(companyId, acc.id) as Array<{ amount: number; currency: string }>;

        let debitTotal = 0;
        let creditTotal = 0;
        let signedTotal = 0;

        for (const line of lines) {
          if (line.amount < 0) {
            debitTotal += Math.abs(line.amount);
          } else {
            creditTotal += line.amount;
          }
          signedTotal += line.amount;
        }

        // Display balance according to account normal sign
        const isDebitNormal = acc.type === 'ASSET' || acc.type === 'EXPENSE';
        const displayBalance = isDebitNormal ? Math.abs(debitTotal - creditTotal) : Math.abs(creditTotal - debitTotal);
        const normalSide = isDebitNormal
          ? (debitTotal >= creditTotal ? 'Dr' : 'Cr')
          : (creditTotal >= debitTotal ? 'Cr' : 'Dr');

        let parsedTags: string[] = [];
        let parsedSops: any[] = [];
        let parsedTriggers: any = {};

        try { parsedTags = typeof acc.tags === 'string' ? JSON.parse(acc.tags || '[]') : acc.tags || []; } catch {}
        try { parsedSops = typeof acc.sop_steps === 'string' ? JSON.parse(acc.sop_steps || '[]') : acc.sop_steps || []; } catch {}
        try { parsedTriggers = typeof acc.trigger_rules === 'string' ? JSON.parse(acc.trigger_rules || '{}') : acc.trigger_rules || {}; } catch {}

        return {
          id: acc.id,
          code: acc.code,
          name: acc.name,
          type: acc.type,
          path: acc.path,
          is_group: acc.is_group,
          currency: acc.currency || company.base_currency,
          description: acc.description,
          tags: parsedTags,
          sop_count: parsedSops.length,
          has_triggers: Object.keys(parsedTriggers).length > 0,
          transaction_count: lines.length,
          debitTotal,
          creditTotal,
          displayBalance,
          normalSide
        };
      });

      return NextResponse.json({
        success: true,
        isDirectory: true,
        company,
        accounts: directoryList
      });
    }

    // 2. TIER 2: DEDICATED FOCUSED LEDGER WORKSPACE (When accountId is given)
    const account = (db.prepare('SELECT * FROM accounts WHERE id = ? AND company_id = ?').get(accountId, companyId) as unknown) as Account;
    if (!account) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }

    // Parse governance fields
    let parsedTags: string[] = [];
    let parsedSops: any[] = [];
    let parsedTriggers: any = {};

    try { parsedTags = typeof account.tags === 'string' ? JSON.parse(account.tags || '[]') : account.tags || []; } catch {}
    try { parsedSops = typeof account.sop_steps === 'string' ? JSON.parse(account.sop_steps || '[]') : account.sop_steps || []; } catch {}
    try { parsedTriggers = typeof account.trigger_rules === 'string' ? JSON.parse(account.trigger_rules || '{}') : account.trigger_rules || {}; } catch {}

    const isDebitNormal = account.type === 'ASSET' || account.type === 'EXPENSE';

    // 2.1. Compute Historical Opening Balance before startDate
    let openingBalance = 0;
    let openingDebits = 0;
    let openingCredits = 0;

    if (startDate) {
      const priorLines = db.prepare(`
        SELECT jl.amount
        FROM journal_lines jl
        JOIN journal_entries je ON jl.entry_id = je.id
        WHERE je.company_id = ? AND jl.account_id = ? AND je.status = 'POSTED' AND je.entry_date < ?
      `).all(companyId, accountId, startDate) as Array<{ amount: number }>;

      for (const line of priorLines) {
        if (line.amount < 0) {
          openingDebits += Math.abs(line.amount);
        } else {
          openingCredits += line.amount;
        }
      }

      openingBalance = isDebitNormal ? (openingDebits - openingCredits) : (openingCredits - openingDebits);
    }

    // 2.2. Fetch Chronological Postings within the selected date range
    let query = `
      SELECT 
        je.id as entry_id,
        je.entry_number,
        je.entry_date,
        je.memo as entry_memo,
        je.reference,
        je.is_reversal,
        je.created_by,
        jl.id as line_id,
        jl.currency as line_currency,
        jl.exchange_rate,
        jl.foreign_amount,
        jl.amount as base_amount,
        jl.memo as line_memo,
        jl.tags as line_tags
      FROM journal_lines jl
      JOIN journal_entries je ON jl.entry_id = je.id
      WHERE je.company_id = ? AND jl.account_id = ? AND je.status = 'POSTED'
    `;

    const params: any[] = [companyId, accountId];

    if (startDate) {
      query += ` AND je.entry_date >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND je.entry_date <= ?`;
      params.push(endDate);
    }

    query += ` ORDER BY je.entry_date ASC, je.entry_number ASC, jl.id ASC`;

    const rows = db.prepare(query).all(...params) as any[];

    // Filter by tag if requested
    const filteredRows = tag
      ? rows.filter(r => {
          try {
            const tags = JSON.parse(r.line_tags || '[]');
            return tags.includes(tag);
          } catch {
            return false;
          }
        })
      : rows;

    // 2.3. Compute Period Totals & Chronological Running Balance
    let runningBalance = openingBalance;
    let periodDebits = 0;
    let periodCredits = 0;
    const currenciesUsed = new Set<string>();

    const transactions = filteredRows.map(row => {
      currenciesUsed.add(row.line_currency);

      const debit = row.base_amount < 0 ? Math.abs(row.base_amount) : 0;
      const credit = row.base_amount > 0 ? row.base_amount : 0;

      periodDebits += debit;
      periodCredits += credit;

      if (isDebitNormal) {
        runningBalance += (debit - credit);
      } else {
        runningBalance += (credit - debit);
      }

      let parsedLineTags: string[] = [];
      try {
        parsedLineTags = JSON.parse(row.line_tags || '[]');
      } catch {}

      return {
        lineId: row.line_id,
        entryId: row.entry_id,
        entryNumber: row.entry_number,
        entryDate: row.entry_date,
        particulars: row.line_memo || row.entry_memo || 'General Journal Entry',
        reference: row.reference || '',
        isReversal: row.is_reversal === 1,
        createdBy: row.created_by,
        lineCurrency: row.line_currency,
        exchangeRate: row.exchange_rate,
        foreignAmount: Math.abs(row.foreign_amount),
        debit,
        credit,
        runningBalance,
        balanceSide: runningBalance >= 0 ? (isDebitNormal ? 'Dr' : 'Cr') : (isDebitNormal ? 'Cr' : 'Dr'),
        tags: parsedLineTags
      };
    });

    const closingBalance = runningBalance;
    const netMovement = isDebitNormal ? (periodDebits - periodCredits) : (periodCredits - periodDebits);

    return NextResponse.json({
      success: true,
      isDirectory: false,
      company,
      account: {
        ...account,
        tags: parsedTags,
        sop_steps: parsedSops,
        trigger_rules: parsedTriggers
      },
      filters: { startDate, endDate, tag },
      totals: {
        openingBalance,
        openingSide: openingBalance >= 0 ? (isDebitNormal ? 'Dr' : 'Cr') : (isDebitNormal ? 'Cr' : 'Dr'),
        periodDebits,
        periodCredits,
        netMovement,
        closingBalance,
        closingSide: closingBalance >= 0 ? (isDebitNormal ? 'Dr' : 'Cr') : (isDebitNormal ? 'Cr' : 'Dr'),
        transactionCount: transactions.length
      },
      availableCurrencies: Array.from(currenciesUsed),
      transactions
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const db = getDb();
    const body = await req.json();
    const { action, companyId, accountId, tags, description, sop_steps, trigger_rules } = body;

    if (action === 'UPDATE_GOVERNANCE' && accountId) {
      const tagsStr = JSON.stringify(tags || []);
      const sopsStr = JSON.stringify(sop_steps || []);
      const triggersStr = JSON.stringify(trigger_rules || {});

      db.prepare(`
        UPDATE accounts SET 
          description = ?,
          tags = ?,
          sop_steps = ?,
          trigger_rules = ?
        WHERE id = ? AND company_id = ?
      `).run(description || null, tagsStr, sopsStr, triggersStr, accountId, companyId);

      const acc = db.prepare('SELECT name, code FROM accounts WHERE id = ?').get(accountId) as any;

      logAuditEvent(
        companyId,
        'LEDGER_GOVERNANCE_UPDATED',
        'Accountant / Manager',
        `Updated SOP workflows & trigger limits for ledger ${acc?.code || ''} - ${acc?.name || ''}`
      );

      return NextResponse.json({
        success: true,
        message: 'Ledger governance parameters updated successfully.'
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
