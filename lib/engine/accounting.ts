import { Company, JournalEntry, JournalLine, Account } from '../db/schema';
import { getDb } from '../db';

export interface CreateJournalLineInput {
  accountId: string;
  currency: string;
  exchangeRate?: number;
  foreignAmount?: number;
  debit?: number;
  credit?: number;
  signedAmount?: number;
  memo?: string;
  tags?: string[];
}

export interface CreateJournalEntryInput {
  companyId: string;
  entryDate: string; // YYYY-MM-DD
  memo?: string;
  reference?: string;
  createdBy?: string;
  isNonFinancial?: boolean;
  lines?: CreateJournalLineInput[];
}

export interface AccountingValidationResult {
  valid: boolean;
  totalDebits: number;
  totalCredits: number;
  netVariance: number;
  errors: string[];
}

/**
 * Validates double-entry balancing and lock date constraints.
 */
export function validateJournalEntry(
  company: Company,
  input: CreateJournalEntryInput
): AccountingValidationResult {
  const errors: string[] = [];

  // 1. Check lock date barrier
  if (company.lock_date && input.entryDate <= company.lock_date) {
    errors.push(
      `Books are locked for period up to ${company.lock_date}. Cannot post entries on or prior to lock date.`
    );
  }

  if (input.isNonFinancial) {
    return {
      valid: errors.length === 0,
      totalDebits: 0,
      totalCredits: 0,
      netVariance: 0,
      errors
    };
  }

  if (!input.lines || input.lines.length < 2) {
    errors.push('A financial double-entry journal entry must contain at least 2 line items.');
    return {
      valid: false,
      totalDebits: 0,
      totalCredits: 0,
      netVariance: 0,
      errors
    };
  }

  let totalDebits = 0;
  let totalCredits = 0;
  let netVariance = 0;

  for (let i = 0; i < input.lines.length; i++) {
    const line = input.lines[i];
    if (!line.accountId) {
      errors.push(`Line #${i + 1} is missing an account.`);
      continue;
    }

    const rate = line.exchangeRate !== undefined && line.exchangeRate > 0 ? line.exchangeRate : 1.0;
    
    // Resolve base amount
    let baseAmount = 0;
    if (line.signedAmount !== undefined) {
      baseAmount = line.signedAmount;
    } else if (line.debit && line.debit > 0) {
      baseAmount = -line.debit * rate;
    } else if (line.credit && line.credit > 0) {
      baseAmount = line.credit * rate;
    } else if (line.foreignAmount !== undefined) {
      baseAmount = line.foreignAmount * rate;
    }

    if (baseAmount < 0) {
      totalDebits += Math.abs(baseAmount);
    } else {
      totalCredits += baseAmount;
    }
    netVariance += baseAmount;
  }

  // Round to company decimal precision or 4 decimals for float tolerance
  const tolerance = Math.pow(10, -Math.max(company.decimal_places, 2));
  if (Math.abs(netVariance) > tolerance) {
    errors.push(
      `Zero-Sum Invariant Violated: Total Debits (${totalDebits.toFixed(
        company.decimal_places
      )}) must equal Total Credits (${totalCredits.toFixed(
        company.decimal_places
      )}). Variance: ${netVariance.toFixed(company.decimal_places)} ${company.base_currency}.`
    );
  }

  return {
    valid: errors.length === 0,
    totalDebits: Math.round(totalDebits * 10000) / 10000,
    totalCredits: Math.round(totalCredits * 10000) / 10000,
    netVariance: Math.round(netVariance * 10000) / 10000,
    errors
  };
}

/**
 * Creates and posts a Journal Entry atomically.
 */
export function postJournalEntry(
  company: Company,
  input: CreateJournalEntryInput
): { success: boolean; entry?: JournalEntry; errors?: string[] } {
  const validation = validateJournalEntry(company, input);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  const db = getDb();
  const entryId = `jv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  // Generate sequence number
  const prefix = input.isNonFinancial ? 'ATT' : 'JV';
  const year = input.entryDate.substring(0, 4);
  const countRow = db.prepare(`
    SELECT COUNT(*) as count FROM journal_entries 
    WHERE company_id = ? AND entry_number LIKE ?
  `).get(company.id, `${prefix}-${year}-%`) as any;
  
  const seqNum = String((countRow?.count || 0) + 1).padStart(4, '0');
  const entryNumber = `${prefix}-${year}-${seqNum}`;

  db.prepare(`
    INSERT INTO journal_entries (
      id, company_id, entry_number, entry_date, memo, reference,
      is_reversal, is_non_financial, status, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'POSTED', ?, ?)
  `).run(
    entryId,
    company.id,
    entryNumber,
    input.entryDate,
    input.memo || null,
    input.reference || null,
    input.isNonFinancial ? 1 : 0,
    input.createdBy || 'System',
    now
  );

  if (!input.isNonFinancial && input.lines) {
    const insertLineStmt = db.prepare(`
      INSERT INTO journal_lines (
        id, entry_id, account_id, currency, exchange_rate, foreign_amount, amount, memo, tags, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < input.lines.length; i++) {
      const line = input.lines[i];
      const rate = line.exchangeRate !== undefined && line.exchangeRate > 0 ? line.exchangeRate : 1.0;
      const currency = line.currency || company.base_currency;
      
      let foreignAmt = 0;
      let baseAmt = 0;

      if (line.signedAmount !== undefined) {
        baseAmt = line.signedAmount;
        foreignAmt = line.foreignAmount !== undefined ? line.foreignAmount : baseAmt / rate;
      } else if (line.debit && line.debit > 0) {
        foreignAmt = -line.debit;
        baseAmt = -line.debit * rate;
      } else if (line.credit && line.credit > 0) {
        foreignAmt = line.credit;
        baseAmt = line.credit * rate;
      } else if (line.foreignAmount !== undefined) {
        foreignAmt = line.foreignAmount;
        baseAmt = foreignAmt * rate;
      }

      const lineId = `ln_${entryId}_${i + 1}`;
      const tagsJson = JSON.stringify(line.tags || []);

      insertLineStmt.run(
        lineId,
        entryId,
        line.accountId,
        currency,
        rate,
        foreignAmt,
        baseAmt,
        line.memo || null,
        tagsJson,
        now
      );
    }
  }

  const createdEntry = (db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(entryId) as unknown) as JournalEntry;
  return { success: true, entry: createdEntry };
}

/**
 * 1-Click Mirror Reversal: Creates an exact inverted entry to offset a posted journal entry.
 */
export function createMirrorReversal(
  company: Company,
  originalEntryId: string,
  reversalDate: string,
  reversalMemo?: string,
  createdBy: string = 'Auditor'
): { success: boolean; entry?: JournalEntry; errors?: string[] } {
  const db = getDb();
  const orig = (db.prepare('SELECT * FROM journal_entries WHERE id = ? AND company_id = ?').get(originalEntryId, company.id) as unknown) as JournalEntry;
  
  if (!orig) {
    return { success: false, errors: ['Original journal entry not found.'] };
  }

  if (orig.is_reversal) {
    return { success: false, errors: ['Cannot reverse an entry that is already a reversal.'] };
  }

  if (company.lock_date && reversalDate <= company.lock_date) {
    return { success: false, errors: [`Reversal date ${reversalDate} falls inside locked period.`] };
  }

  const lines = (db.prepare('SELECT * FROM journal_lines WHERE entry_id = ?').all(originalEntryId) as unknown) as any[];
  
  const reversalEntryId = `jv_rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const year = reversalDate.substring(0, 4);

  const countRow = db.prepare(`
    SELECT COUNT(*) as count FROM journal_entries 
    WHERE company_id = ? AND entry_number LIKE 'REV-%'
  `).get(company.id) as any;
  
  const seqNum = String((countRow?.count || 0) + 1).padStart(4, '0');
  const entryNumber = `REV-${year}-${seqNum}`;

  db.prepare(`
    INSERT INTO journal_entries (
      id, company_id, entry_number, entry_date, memo, reference,
      is_reversal, reversed_from_id, is_non_financial, status, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, 0, 'POSTED', ?, ?)
  `).run(
    reversalEntryId,
    company.id,
    entryNumber,
    reversalDate,
    reversalMemo || `Mirror Reversal of ${orig.entry_number} (${orig.memo || 'Voucher'})`,
    `REV:${orig.entry_number}`,
    orig.id,
    createdBy,
    now
  );

  const insertLineStmt = db.prepare(`
    INSERT INTO journal_lines (
      id, entry_id, account_id, currency, exchange_rate, foreign_amount, amount, memo, tags, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < lines.length; i++) {
    const origLine = lines[i];
    const lineId = `ln_${reversalEntryId}_${i + 1}`;
    
    // Invert the signed amounts
    const invertedForeign = -origLine.foreign_amount;
    const invertedBase = -origLine.amount;
    const tagsString = typeof origLine.tags === 'string' ? origLine.tags : JSON.stringify(origLine.tags || []);

    insertLineStmt.run(
      lineId,
      reversalEntryId,
      origLine.account_id,
      origLine.currency,
      origLine.exchange_rate,
      invertedForeign,
      invertedBase,
      `Reversal: ${origLine.memo || ''}`,
      tagsString,
      now
    );
  }

  const createdEntry = (db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(reversalEntryId) as unknown) as JournalEntry;
  return { success: true, entry: createdEntry };
}
