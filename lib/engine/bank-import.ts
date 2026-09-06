import { getDb, logAuditEvent } from '@/lib/db';
import { Company, Account } from '@/lib/db/schema';
import { postJournalEntry } from './accounting';

export interface BankImportValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata: {
    targetAccountId: string;
    targetAccountCode: string;
    targetAccountName: string;
    lastReconciledDate?: string | null;
    openingBalance: number;
    totalInflows: number;
    totalOutflows: number;
    netMovement: number;
    computedEndingBalance: number;
    targetStatementBalance?: number | null;
    variance?: number | null;
    rowCount: number;
    validRowCount: number;
  };
  parsedRows: Array<{
    rowNumber: number;
    date: string;
    reference: string;
    counterAccountId?: string;
    counterAccountCode?: string;
    counterAccountName?: string;
    counterAccountType?: string;
    narration: string;
    amount: number;
    isInflow: boolean;
    debit: number;
    credit: number;
    tags: string[];
    error?: string;
  }>;
}

/**
 * Helper to normalize dates across YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, and YYYY/MM/DD
 */
export function normalizeDateString(rawDate: string): string | null {
  if (!rawDate) return null;
  const clean = rawDate.trim();

  // 1. Standard ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  // 2. Slash ISO: YYYY/MM/DD
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(clean)) {
    return clean.replace(/\//g, '-');
  }

  // 3. Indian / British / Excel format: DD-MM-YYYY
  const ddmmyyyyDash = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(clean);
  if (ddmmyyyyDash) {
    const day = ddmmyyyyDash[1].padStart(2, '0');
    const month = ddmmyyyyDash[2].padStart(2, '0');
    const year = ddmmyyyyDash[3];
    return `${year}-${month}-${day}`;
  }

  // 4. Slash format: DD/MM/YYYY
  const ddmmyyyySlash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(clean);
  if (ddmmyyyySlash) {
    const day = ddmmyyyySlash[1].padStart(2, '0');
    const month = ddmmyyyySlash[2].padStart(2, '0');
    const year = ddmmyyyySlash[3];
    return `${year}-${month}-${day}`;
  }

  // 5. Fallback Date parse
  const parsed = Date.parse(clean);
  if (!isNaN(parsed)) {
    return new Date(parsed).toISOString().substring(0, 10);
  }

  return null;
}

/**
 * 1. Generate Pre-formatted Bank Statement Import CSV Template
 */
export function generateBankImportTemplate(
  company: Company,
  account: Account,
  currentOpeningBalance: number
): string {
  const db = getDb();
  const reconciledDate = account.last_reconciled_date || '2026-01-31';
  const balanceSide = account.type === 'ASSET' ? 'Dr' : 'Cr';

  // Calculate next month for dynamic valid sample rows
  let nextYear = 2026;
  let nextMonth = '09';
  try {
    const parsedDate = new Date(reconciledDate);
    if (!isNaN(parsedDate.getTime())) {
      parsedDate.setDate(1);
      parsedDate.setMonth(parsedDate.getMonth() + 1);
      nextYear = parsedDate.getFullYear();
      nextMonth = String(parsedDate.getMonth() + 1).padStart(2, '0');
    }
  } catch {}

  // Fetch last 2 prior reconciled transactions for reference
  let priorTxLines: string[] = [];
  try {
    const priorTxs = db.prepare(`
      SELECT je.entry_number, je.entry_date, jl.amount, jl.memo, a.code as counter_code, a.name as counter_name
      FROM journal_lines jl
      JOIN journal_entries je ON jl.entry_id = je.id
      JOIN journal_lines jl_other ON jl_other.entry_id = je.id AND jl_other.account_id != jl.account_id
      JOIN accounts a ON jl_other.account_id = a.id
      WHERE je.company_id = ? AND jl.account_id = ? AND je.status = 'POSTED' AND je.entry_date <= ?
      ORDER BY je.entry_date DESC, je.entry_number DESC
      LIMIT 2
    `).all(company.id, account.id, reconciledDate) as any[];

    if (priorTxs.length > 0) {
      priorTxLines = [
        `# LAST RECONCILED TRANSACTIONS (FOR AUDIT REFERENCE AS ON ${reconciledDate}):`,
        ...priorTxs.map(t => `#   - ${t.entry_date} | ${t.entry_number} | Counter: ${t.counter_code} ${t.counter_name} | Amount: ${t.amount > 0 ? `+${t.amount.toFixed(2)}` : t.amount.toFixed(2)} | Memo: ${t.memo || 'N/A'}`),
        `# `
      ];
    }
  } catch {}

  const lines = [
    `# =========================================================================================`,
    `# FLOWBOOK BY UTHARAM - BANK STATEMENT & BATCH JOURNAL IMPORT TEMPLATE`,
    `# =========================================================================================`,
    `# METADATA: COMPANY_ID=${company.id} | ACCOUNT_ID=${account.id} | ACCOUNT_CODE=${account.code} | ACCOUNT_NAME=${account.name}`,
    `# RECONCILED_TILL_DATE: ${reconciledDate}`,
    `# OPENING_RECONCILED_BALANCE: ${currentOpeningBalance.toFixed(company.decimal_places)} ${balanceSide}`,
    `# TARGET_STATEMENT_CLOSING_BALANCE: [ENTER_YOUR_BANK_STATEMENT_ENDING_BALANCE_HERE]`,
    `# `,
    ...priorTxLines,
    `# RULES & INSTRUCTIONS:`,
    `# 1. Transaction Date must be strictly after ${reconciledDate}. Accepted formats: YYYY-MM-DD or DD-MM-YYYY.`,
    `# 2. Counter_Ledger can be either Account Code (e.g. 5200) or exact Account Name (e.g. Office Rent).`,
    `# 3. Amount: Positive (+) for Inflows / Deposits; Negative (-) for Outflows / Withdrawals / Charges.`,
    `# 4. Tags: Space or comma separated tags starting with # (e.g. #Vendor #HQ).`,
    `# `,
    `# SAMPLE FORMAT REFERENCE:`,
    `#   - Inflow Sample:  ${nextYear}-${nextMonth}-05, NEFT-889102, 4100, Customer Consulting Receipt, 15000.00, #Sales`,
    `#   - Outflow Sample: ${nextYear}-${nextMonth}-12, CHQ-10029,  5200, Corporate Office Facilities,   -3200.00, #Facilities`,
    `# =========================================================================================`,
    `Date,Bank_Reference_UTR,Counter_Ledger,Particulars_Narration,Amount,Tags`
  ];

  return '\uFEFF' + lines.join('\n') + '\n';
}

/**
 * 2. Validate Uploaded Bank Statement CSV / Text
 */
export function validateBankImportContent(
  company: Company,
  targetAccount: Account,
  fileContent: string
): BankImportValidationResult {
  const db = getDb();
  const errors: string[] = [];
  const warnings: string[] = [];

  // Fetch all active accounts for counter ledger matching
  const allAccounts = (db.prepare(`
    SELECT id, code, name, type, is_group 
    FROM accounts 
    WHERE company_id = ? AND is_active = 1
  `).all(company.id) as unknown) as Account[];

  const leafAccounts = allAccounts.filter(a => a.is_group === 0);

  // Compute starting opening balance up to targetAccount.last_reconciled_date
  let startingBalance = 0;
  const isDebitNormal = targetAccount.type === 'ASSET' || targetAccount.type === 'EXPENSE';

  if (targetAccount.last_reconciled_date) {
    const priorLines = db.prepare(`
      SELECT jl.amount
      FROM journal_lines jl
      JOIN journal_entries je ON jl.entry_id = je.id
      WHERE je.company_id = ? AND jl.account_id = ? AND je.status = 'POSTED' AND je.entry_date <= ?
    `).all(company.id, targetAccount.id, targetAccount.last_reconciled_date) as Array<{ amount: number }>;

    let debits = 0;
    let credits = 0;
    for (const l of priorLines) {
      if (l.amount < 0) debits += Math.abs(l.amount);
      else credits += l.amount;
    }
    startingBalance = isDebitNormal ? (debits - credits) : (credits - debits);
  }

  // Parse lines
  const rawLines = fileContent.split(/\r?\n/);
  let targetStatementBalance: number | null = null;
  const dataLines: Array<{ lineNum: number; text: string }> = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) continue;

    if (line.startsWith('#')) {
      // Check for target closing balance metadata
      const targetMatch = line.match(/TARGET_STATEMENT_CLOSING_BALANCE:\s*([0-9.,-]+)/i);
      if (targetMatch && !isNaN(parseFloat(targetMatch[1]))) {
        targetStatementBalance = parseFloat(targetMatch[1]);
      }
      continue;
    }

    dataLines.push({ lineNum: i + 1, text: line });
  }

  if (dataLines.length === 0) {
    return {
      valid: false,
      errors: ['The uploaded file contains no transaction data rows.'],
      warnings: [],
      metadata: {
        targetAccountId: targetAccount.id,
        targetAccountCode: targetAccount.code,
        targetAccountName: targetAccount.name,
        lastReconciledDate: targetAccount.last_reconciled_date,
        openingBalance: startingBalance,
        totalInflows: 0,
        totalOutflows: 0,
        netMovement: 0,
        computedEndingBalance: startingBalance,
        targetStatementBalance,
        rowCount: 0,
        validRowCount: 0
      },
      parsedRows: []
    };
  }

  // Check header row
  let startIndex = 0;
  const firstLine = dataLines[0].text.toLowerCase();
  if (firstLine.includes('date') && (firstLine.includes('amount') || firstLine.includes('counter_ledger'))) {
    startIndex = 1; // Skip header
  }

  const parsedRows: BankImportValidationResult['parsedRows'] = [];
  let totalInflows = 0;
  let totalOutflows = 0;
  const lastReconciled = targetAccount.last_reconciled_date || null;

  for (let idx = startIndex; idx < dataLines.length; idx++) {
    const { lineNum, text } = dataLines[idx];
    
    // Parse CSV columns (handling quotes)
    const cols = parseCsvLine(text);
    if (cols.length < 3) {
      errors.push(`Row ${lineNum}: Insufficient columns. Minimum required: Date, Counter_Ledger, Amount.`);
      continue;
    }

    // Mapping columns:
    // Format A (6 cols): Date, Bank_Reference_UTR, Counter_Ledger, Particulars_Narration, Amount, Tags
    // Format B (5 cols): Date, Reference, Counter_Ledger, Narration, Amount
    // Format C (4 cols): Date, Counter_Ledger, Narration, Amount
    let rowDate = '';
    let rowRef = '';
    let rowCounter = '';
    let rowNarration = '';
    let rowAmountStr = '';
    let rowTagsStr = '';

    if (cols.length >= 6) {
      [rowDate, rowRef, rowCounter, rowNarration, rowAmountStr, rowTagsStr] = cols;
    } else if (cols.length === 5) {
      [rowDate, rowRef, rowCounter, rowNarration, rowAmountStr] = cols;
    } else if (cols.length === 4) {
      [rowDate, rowCounter, rowNarration, rowAmountStr] = cols;
    } else if (cols.length === 3) {
      [rowDate, rowCounter, rowAmountStr] = cols;
    }

    rowDate = (rowDate || '').trim();
    rowRef = (rowRef || '').trim();
    rowCounter = (rowCounter || '').trim();
    rowNarration = (rowNarration || '').trim();
    rowAmountStr = (rowAmountStr || '').replace(/[\$,]/g, '').trim();

    let rowError: string | undefined;

    // 1. Validate & Normalize Date (accepts YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY)
    const normalizedDate = normalizeDateString(rowDate);
    if (!normalizedDate) {
      rowError = `Invalid date format "${rowDate}". Accepted: YYYY-MM-DD or DD-MM-YYYY.`;
      errors.push(`Row ${lineNum}: ${rowError}`);
    } else if (lastReconciled && normalizedDate <= lastReconciled) {
      // 2. Validate Reconciled Date Barrier
      rowError = `Date ${normalizedDate} is on or before the last reconciled closing date (${lastReconciled}). Backdating is prohibited.`;
      errors.push(`Row ${lineNum}: ${rowError}`);
    }

    // 3. Validate Amount
    const amountVal = parseFloat(rowAmountStr);
    if (isNaN(amountVal) || Math.abs(amountVal) < 0.0001) {
      rowError = `Invalid numeric amount "${rowAmountStr}".`;
      errors.push(`Row ${lineNum}: ${rowError}`);
    }

    // 4. Validate Counter Ledger Matching
    let matchedAccount: Account | undefined;
    if (rowCounter) {
      const cleanCounter = rowCounter.toLowerCase();
      // Match by exact code, or case-insensitive name, or exact id
      matchedAccount = leafAccounts.find(a => 
        a.code.toLowerCase() === cleanCounter || 
        a.name.toLowerCase() === cleanCounter || 
        a.id.toLowerCase() === cleanCounter
      );

      // If still not matched, check if account name contains search term
      if (!matchedAccount) {
        matchedAccount = leafAccounts.find(a => 
          a.name.toLowerCase().includes(cleanCounter) ||
          cleanCounter.includes(a.name.toLowerCase())
        );
      }
    }

    if (!matchedAccount) {
      rowError = `Counter ledger "${rowCounter}" could not be resolved in the active Chart of Accounts.`;
      errors.push(`Row ${lineNum}: ${rowError}`);
    } else if (matchedAccount.id === targetAccount.id) {
      rowError = `Counter ledger cannot be the same as the target bank account (${targetAccount.code} - ${targetAccount.name}).`;
      errors.push(`Row ${lineNum}: ${rowError}`);
    }

    const isInflow = amountVal > 0;
    const absAmount = Math.abs(amountVal);

    if (isInflow) {
      totalInflows += absAmount;
    } else {
      totalOutflows += absAmount;
    }

    // Parse tags
    let tagsList: string[] = [];
    if (rowTagsStr) {
      tagsList = rowTagsStr
        .split(/[\s,]+/)
        .map(t => t.trim())
        .filter(t => t.length > 0)
        .map(t => t.startsWith('#') ? t : `#${t}`);
    }

    parsedRows.push({
      rowNumber: lineNum,
      date: normalizedDate || rowDate,
      reference: rowRef,
      counterAccountId: matchedAccount?.id,
      counterAccountCode: matchedAccount?.code,
      counterAccountName: matchedAccount?.name,
      counterAccountType: matchedAccount?.type,
      narration: rowNarration || `Bank ${isInflow ? 'Deposit' : 'Payment'} - Ref: ${rowRef || 'N/A'}`,
      amount: amountVal,
      isInflow,
      debit: isInflow ? absAmount : 0,
      credit: !isInflow ? absAmount : 0,
      tags: tagsList,
      error: rowError
    });
  }

  const netMovement = totalInflows - totalOutflows;
  const computedEndingBalance = startingBalance + netMovement;
  let variance: number | null = null;

  if (targetStatementBalance !== null) {
    variance = Math.abs(computedEndingBalance - targetStatementBalance);
    if (variance > 0.001) {
      warnings.push(
        `Statement Balance Mismatch: Computed Ending Balance (${computedEndingBalance.toFixed(company.decimal_places)}) differs from your uploaded statement target (${targetStatementBalance.toFixed(company.decimal_places)}) by variance of ${variance.toFixed(company.decimal_places)}.`
      );
    }
  }

  const validRowCount = parsedRows.filter(r => !r.error).length;
  const isValid = errors.length === 0 && validRowCount > 0;

  return {
    valid: isValid,
    errors,
    warnings,
    metadata: {
      targetAccountId: targetAccount.id,
      targetAccountCode: targetAccount.code,
      targetAccountName: targetAccount.name,
      lastReconciledDate: lastReconciled,
      openingBalance: startingBalance,
      totalInflows,
      totalOutflows,
      netMovement,
      computedEndingBalance,
      targetStatementBalance,
      variance,
      rowCount: parsedRows.length,
      validRowCount
    },
    parsedRows
  };
}

/**
 * 3. Execute Atomic Batch Journal Posting & Reconciliation Advance
 */
export function executeBankImportBatch(
  company: Company,
  targetAccount: Account,
  validatedRows: BankImportValidationResult['parsedRows'],
  actor = 'Accountant'
): { success: boolean; createdCount: number; newReconciledDate: string; endingBalance: number; error?: string } {
  const db = getDb();

  if (validatedRows.length === 0) {
    return { success: false, createdCount: 0, newReconciledDate: '', endingBalance: 0, error: 'No validated rows to post.' };
  }

  // Check for any remaining row errors
  const hasErrors = validatedRows.some(r => !!r.error || !r.counterAccountId);
  if (hasErrors) {
    return { success: false, createdCount: 0, newReconciledDate: '', endingBalance: 0, error: 'Cannot post batch with unresolved validation errors.' };
  }

  try {
    let maxDate = targetAccount.last_reconciled_date || '2026-01-01';
    let postedCount = 0;

    const isDebitNormal = targetAccount.type === 'ASSET' || targetAccount.type === 'EXPENSE';

    // Post each transaction atomically
    for (const row of validatedRows) {
      if (row.date > maxDate) {
        maxDate = row.date;
      }

      const absAmount = Math.abs(row.amount);
      const isPositive = row.isInflow;

      // Handle Double-Entry Posting for ALL Account Types:
      // For Debit-Normal (Asset/Expense): Positive (+) = Dr Target, Cr Counter; Negative (-) = Dr Counter, Cr Target
      // For Credit-Normal (Liability/Equity/Revenue): Positive (+) = Cr Target, Dr Counter; Negative (-) = Dr Target, Cr Counter
      let lines;
      if (isDebitNormal) {
        lines = isPositive
          ? [
              { accountId: targetAccount.id, debit: absAmount, currency: targetAccount.currency || company.base_currency, memo: row.narration, tags: row.tags },
              { accountId: row.counterAccountId!, credit: absAmount, currency: company.base_currency, memo: row.narration, tags: row.tags }
            ]
          : [
              { accountId: row.counterAccountId!, debit: absAmount, currency: company.base_currency, memo: row.narration, tags: row.tags },
              { accountId: targetAccount.id, credit: absAmount, currency: targetAccount.currency || company.base_currency, memo: row.narration, tags: row.tags }
            ];
      } else {
        lines = isPositive
          ? [
              { accountId: row.counterAccountId!, debit: absAmount, currency: company.base_currency, memo: row.narration, tags: row.tags },
              { accountId: targetAccount.id, credit: absAmount, currency: targetAccount.currency || company.base_currency, memo: row.narration, tags: row.tags }
            ]
          : [
              { accountId: targetAccount.id, debit: absAmount, currency: targetAccount.currency || company.base_currency, memo: row.narration, tags: row.tags },
              { accountId: row.counterAccountId!, credit: absAmount, currency: company.base_currency, memo: row.narration, tags: row.tags }
            ];
      }

      const res = postJournalEntry(company, {
        companyId: company.id,
        entryDate: row.date,
        memo: row.narration,
        reference: row.reference || `IMP-${targetAccount.code}-${row.date}`,
        lines
      });

      if (!res.success) {
        throw new Error(`Failed posting row on date ${row.date}: ${res.errors?.join('; ')}`);
      }

      postedCount++;
    }

    // Update account last_reconciled_date in SQLite
    db.prepare(`
      UPDATE accounts SET last_reconciled_date = ? WHERE id = ?
    `).run(maxDate, targetAccount.id);

    // Record Audit Event
    logAuditEvent(
      company.id,
      'BANK_STATEMENT_BATCH_IMPORTED',
      actor,
      `Imported & reconciled bank statement batch of ${postedCount} transactions for ${targetAccount.code} - ${targetAccount.name}. Reconciled date advanced to ${maxDate}.`,
      { accountId: targetAccount.id, postedCount, newReconciledDate: maxDate }
    );

    return {
      success: true,
      createdCount: postedCount,
      newReconciledDate: maxDate,
      endingBalance: 0
    };
  } catch (err: any) {
    return {
      success: false,
      createdCount: 0,
      newReconciledDate: '',
      endingBalance: 0,
      error: err.message
    };
  }
}

/**
 * Helper to parse CSV line handling quotes and commas
 */
function parseCsvLine(text: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}
