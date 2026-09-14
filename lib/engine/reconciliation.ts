import { getDb, logAuditEvent } from '@/lib/db';
import { Company, Account } from '@/lib/db/schema';

export interface BrsTransactionRow {
  lineId: string;
  entryId: string;
  entryNumber: string;
  entryDate: string;
  particulars: string;
  reference: string;
  counterLedgerText: string;
  counterAccountId?: string;
  debit: number;
  credit: number;
  isCleared: boolean;
  clearedDate: string | null;
  tags: string[];
}

export interface BankReconciliationData {
  company: Company;
  account: Account;
  asOfDate: string;
  bookBalance: number;
  bookBalanceSide: 'Dr' | 'Cr';
  totalBookDebits: number;
  totalBookCredits: number;
  unpresentedChequesTotal: number;
  unpresentedChequesCount: number;
  unclearedDepositsTotal: number;
  unclearedDepositsCount: number;
  reconciledBankBalance: number;
  reconciledBankSide: 'Dr' | 'Cr';
  statementBalance: number | null;
  variance: number | null;
  isReconciled: boolean;
  transactions: BrsTransactionRow[];
}

/**
 * 1. Fetch Complete Bank Reconciliation Statement (BRS) Data
 */
export function getBankReconciliationData(
  companyId: string,
  accountId: string,
  asOfDate: string,
  statementBalance?: number | null
): BankReconciliationData {
  const db = getDb();

  const company = (db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as unknown) as Company;
  if (!company) throw new Error('Company not found');

  const account = (db.prepare('SELECT * FROM accounts WHERE id = ? AND company_id = ?').get(accountId, companyId) as unknown) as Account;
  if (!account) throw new Error('Account not found');

  const isDebitNormal = account.type === 'ASSET' || account.type === 'EXPENSE';

  // 1. Fetch All Book Entries up to asOfDate
  const query = `
    SELECT 
      jl.id as line_id,
      jl.entry_id,
      jl.amount as base_amount,
      jl.memo as line_memo,
      jl.tags as line_tags,
      jl.bank_cleared_date,
      jl.is_bank_cleared,
      je.entry_number,
      je.entry_date,
      je.memo as entry_memo,
      je.reference,
      je.is_reversal
    FROM journal_lines jl
    JOIN journal_entries je ON jl.entry_id = je.id
    WHERE je.company_id = ? AND jl.account_id = ? AND je.status = 'POSTED' AND je.entry_date <= ?
    ORDER BY je.entry_date ASC, je.entry_number ASC, jl.id ASC
  `;

  const rows = db.prepare(query).all(companyId, accountId, asOfDate) as any[];

  let totalBookDebits = 0;
  let totalBookCredits = 0;
  let unpresentedChequesTotal = 0; // Credits in books not cleared in bank
  let unpresentedChequesCount = 0;
  let unclearedDepositsTotal = 0;  // Debits in books not cleared in bank
  let unclearedDepositsCount = 0;

  const transactions: BrsTransactionRow[] = rows.map(row => {
    const debit = row.base_amount < 0 ? Math.abs(row.base_amount) : 0;
    const credit = row.base_amount > 0 ? row.base_amount : 0;

    totalBookDebits += debit;
    totalBookCredits += credit;

    // Check clearance timing relative to asOfDate
    const isClearedInBank = row.is_bank_cleared === 1 && !!row.bank_cleared_date && row.bank_cleared_date <= asOfDate;

    if (!isClearedInBank) {
      if (credit > 0) {
        unpresentedChequesTotal += credit;
        unpresentedChequesCount++;
      }
      if (debit > 0) {
        unclearedDepositsTotal += debit;
        unclearedDepositsCount++;
      }
    }

    let parsedTags: string[] = [];
    try { parsedTags = JSON.parse(row.line_tags || '[]'); } catch {}

    // Find Counter Ledger
    const otherLines = db.prepare(`
      SELECT a.id, a.code, a.name, a.type
      FROM journal_lines jl
      JOIN accounts a ON jl.account_id = a.id
      WHERE jl.entry_id = ? AND jl.account_id != ?
    `).all(row.entry_id, accountId) as Array<{ id: string; code: string; name: string; type: string }>;

    let counterLedgerText = '—';
    let counterAccountId: string | undefined;

    if (otherLines.length === 1) {
      counterAccountId = otherLines[0].id;
      counterLedgerText = `${otherLines[0].code} - ${otherLines[0].name}`;
    } else if (otherLines.length > 1) {
      counterAccountId = otherLines[0].id;
      counterLedgerText = `${otherLines[0].code} - ${otherLines[0].name} (+${otherLines.length - 1} split)`;
    }

    return {
      lineId: row.line_id,
      entryId: row.entry_id,
      entryNumber: row.entry_number,
      entryDate: row.entry_date,
      particulars: row.line_memo || row.entry_memo || 'General Voucher',
      reference: row.reference || '',
      counterLedgerText,
      counterAccountId,
      debit,
      credit,
      isCleared: isClearedInBank,
      clearedDate: row.bank_cleared_date || null,
      tags: parsedTags
    };
  });

  // Calculate Net Book Balance
  const netBookSigned = totalBookDebits - totalBookCredits;
  const bookBalance = Math.abs(netBookSigned);
  const bookBalanceSide: 'Dr' | 'Cr' = netBookSigned >= 0 ? 'Dr' : 'Cr';

  // Traditional BRS Formula:
  // Reconciled Bank Balance = Book Balance (Dr) + Unpresented Cheques (Credit in books) - Uncleared Deposits (Debit in books)
  const reconciledBankSigned = netBookSigned + unpresentedChequesTotal - unclearedDepositsTotal;
  const reconciledBankBalance = Math.abs(reconciledBankSigned);
  const reconciledBankSide: 'Dr' | 'Cr' = reconciledBankSigned >= 0 ? 'Dr' : 'Cr';

  let variance: number | null = null;
  let isReconciled = false;

  if (statementBalance !== undefined && statementBalance !== null) {
    variance = Math.abs(reconciledBankBalance - statementBalance);
    isReconciled = variance < 0.001;
  }

  return {
    company,
    account,
    asOfDate,
    bookBalance,
    bookBalanceSide,
    totalBookDebits,
    totalBookCredits,
    unpresentedChequesTotal,
    unpresentedChequesCount,
    unclearedDepositsTotal,
    unclearedDepositsCount,
    reconciledBankBalance,
    reconciledBankSide,
    statementBalance: statementBalance ?? null,
    variance,
    isReconciled,
    transactions
  };
}

/**
 * 2. Update Single Line Bank Clearance Status & Date
 */
export function updateLineClearance(
  lineId: string,
  isCleared: boolean,
  clearedDate?: string | null
): void {
  const db = getDb();
  db.prepare(`
    UPDATE journal_lines SET 
      is_bank_cleared = ?,
      bank_cleared_date = ?
    WHERE id = ?
  `).run(isCleared ? 1 : 0, isCleared ? (clearedDate || null) : null, lineId);
}

/**
 * 3. Bulk Clear / Unclear Lines
 */
export function bulkUpdateClearance(
  lineIds: string[],
  isCleared: boolean,
  clearedDate?: string | null
): void {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE journal_lines SET 
      is_bank_cleared = ?,
      bank_cleared_date = ?
    WHERE id = ?
  `);

  for (const id of lineIds) {
    stmt.run(isCleared ? 1 : 0, isCleared ? (clearedDate || null) : null, id);
  }
}

/**
 * 4. Finalize & Lock Bank Reconciliation for a Period
 */
export function finalizeBankReconciliation(
  companyId: string,
  accountId: string,
  asOfDate: string,
  statementBalance: number,
  actor = 'Accountant',
  allowDiscrepancyOverride = false
): {
  success: boolean;
  newReconciledDate: string;
  statementBalance: number;
  variance?: number;
  error?: string;
} {
  const db = getDb();

  const account = (db.prepare('SELECT * FROM accounts WHERE id = ? AND company_id = ?').get(accountId, companyId) as unknown) as Account;
  if (!account) throw new Error('Account not found');

  const brsData = getBankReconciliationData(companyId, accountId, asOfDate, statementBalance);
  const variance = brsData.variance ?? 0;

  if (variance > 0.005 && !allowDiscrepancyOverride) {
    return {
      success: false,
      newReconciledDate: account.last_reconciled_date || '',
      statementBalance,
      variance,
      error: `Cannot finalize BRS with unresolved variance of ${variance.toFixed(2)}. Reconciled bank balance is ${brsData.reconciledBankBalance.toFixed(2)}, statement balance is ${statementBalance.toFixed(2)}. Set allowDiscrepancyOverride to true to force finalize.`
    };
  }

  db.prepare(`
    UPDATE accounts SET 
      last_reconciled_date = ?,
      last_reconciled_balance = ?
    WHERE id = ? AND company_id = ?
  `).run(asOfDate, statementBalance, accountId, companyId);

  logAuditEvent(
    companyId,
    'BANK_RECONCILIATION_FINALIZED',
    actor,
    `Finalized bank reconciliation (BRS) for ${account.code} - ${account.name} as of ${asOfDate} with statement balance of ${statementBalance}${variance > 0.005 ? ` (Override approved: variance ${variance.toFixed(2)})` : ''}.`,
    { accountId, asOfDate, statementBalance, variance, allowDiscrepancyOverride }
  );

  return {
    success: true,
    newReconciledDate: asOfDate,
    statementBalance,
    variance
  };
}
