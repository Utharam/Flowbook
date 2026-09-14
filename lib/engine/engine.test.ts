import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { getDb, closeDb, logAuditEvent, getNextDocumentSequence } from '../db';
import { Company, Account, FlowTemplate } from '../db/schema';
import { validateJournalEntry, postJournalEntry, createMirrorReversal } from './accounting';
import { generateFxSettlementLines, getExchangeRate } from './multi-currency';
import { getHierarchicalCoa, flattenCoaTree } from './coa-tree';
import { generateBankImportTemplate, validateBankImportContent, executeBankImportBatch } from './bank-import';
import { getBankReconciliationData, updateLineClearance, finalizeBankReconciliation } from './reconciliation';

describe('Flowbook Double-Entry & Multi-Currency Engine Tests', () => {
  let company: Company;

  before(() => {
    // Initialize & seed DB
    const db = getDb();
    company = (db.prepare('SELECT * FROM companies WHERE id = ?').get('cmp_utharam_global') as unknown) as Company;
    assert.ok(company, 'Seed company should exist');
  });

  after(() => {
    closeDb();
  });

  test('Single-Column Math: Unbalanced entry should be rejected', () => {
    const invalidEntry = {
      companyId: company.id,
      entryDate: '2026-03-01',
      memo: 'Unbalanced Test Entry',
      lines: [
        { accountId: 'acc_1110', debit: 500, currency: 'USD' },
        { accountId: 'acc_4100', credit: 400, currency: 'USD' }, // 100 variance
      ]
    };

    const validation = validateJournalEntry(company, invalidEntry);
    assert.strictEqual(validation.valid, false);
    assert.ok(validation.errors.some(e => e.includes('Zero-Sum Invariant Violated')));
  });

  test('Single-Column Math: Balanced entry should pass and post atomically', () => {
    const validEntry = {
      companyId: company.id,
      entryDate: '2026-03-05',
      memo: 'Consulting Revenue Received',
      lines: [
        { accountId: 'acc_1110', debit: 1500, currency: 'USD', memo: 'Bank deposit' },
        { accountId: 'acc_4200', credit: 1500, currency: 'USD', memo: 'Consulting fees' },
      ]
    };

    const res = postJournalEntry(company, validEntry);
    assert.strictEqual(res.success, true);
    assert.ok(res.entry);
    assert.strictEqual(res.entry.status, 'POSTED');
  });

  test('Multi-Currency: Correctly converts EUR to base USD and balances', () => {
    // 1000 EUR @ 1.08 = 1080 USD
    const foreignEntry = {
      companyId: company.id,
      entryDate: '2026-03-10',
      memo: 'Software Sale to Munich Client',
      lines: [
        { accountId: 'acc_1120', currency: 'EUR', exchangeRate: 1.08, debit: 1000, memo: 'Bank EUR 1000' },
        { accountId: 'acc_4100', currency: 'USD', exchangeRate: 1.0, credit: 1080, memo: 'Revenue USD 1080' },
      ]
    };

    const res = postJournalEntry(company, foreignEntry);
    assert.strictEqual(res.success, true);
    assert.ok(res.entry);
  });

  test('Automated Realized FX Settlement Generation', () => {
    // Invoiced 1000 EUR @ 1.05 = $1050 USD base
    // Settled / Paid 1000 EUR @ 1.10 = $1100 USD base
    // FX Gain = $50 USD
    const settlementLines = generateFxSettlementLines({
      company,
      settlementCurrency: 'EUR',
      originalExchangeRate: 1.05,
      settlementExchangeRate: 1.10,
      foreignAmount: 1000,
      receivableOrPayableAccountId: 'acc_1130',
      bankAccountId: 'acc_1110',
      fxGainLossAccountId: 'acc_4900',
      tags: ['#FX-Test']
    });

    assert.strictEqual(settlementLines.length, 3);
    
    // Check sum of signed amounts in base USD
    const totalSum = settlementLines.reduce((sum, line) => sum + (line.signedAmount || 0), 0);
    assert.ok(Math.abs(totalSum) < 0.001, 'Settlement lines must zero-balance in base currency');

    // Post settlement
    const res = postJournalEntry(company, {
      companyId: company.id,
      entryDate: '2026-03-15',
      memo: 'Foreign AR Settlement with FX Gain',
      lines: settlementLines
    });
    assert.strictEqual(res.success, true);
  });

  test('Locked Period Barrier: Entries on/before lock date are rejected', () => {
    const lockedCompany: Company = { ...company, lock_date: '2026-01-31' };
    
    const backdatedEntry = {
      companyId: lockedCompany.id,
      entryDate: '2026-01-15', // Inside locked period
      memo: 'Backdated entry attempt',
      lines: [
        { accountId: 'acc_1110', debit: 200, currency: 'USD' },
        { accountId: 'acc_4100', credit: 200, currency: 'USD' },
      ]
    };

    const res = postJournalEntry(lockedCompany, backdatedEntry);
    assert.strictEqual(res.success, false);
    assert.ok(res.errors?.some(e => e.includes('Books are locked')));
  });

  test('1-Click Mirror Reversal: Creates exact offsetting voucher and prevents double reversal', () => {
    // 1. Post original entry
    const origRes = postJournalEntry(company, {
      companyId: company.id,
      entryDate: '2026-03-20',
      memo: 'Office Supplies to be reversed',
      lines: [
        { accountId: 'acc_5200', debit: 350, currency: 'USD' },
        { accountId: 'acc_1110', credit: 350, currency: 'USD' },
      ]
    });
    assert.strictEqual(origRes.success, true);
    assert.ok(origRes.entry);

    // 2. Perform 1-click mirror reversal
    const revRes = createMirrorReversal(company, origRes.entry.id, '2026-03-22');
    assert.strictEqual(revRes.success, true);
    assert.ok(revRes.entry);
    assert.strictEqual(revRes.entry.is_reversal, 1);
    assert.strictEqual(revRes.entry.reversed_from_id, origRes.entry.id);

    // Verify original entry was marked as REVERSED
    const db = getDb();
    const updatedOrig = db.prepare('SELECT status FROM journal_entries WHERE id = ?').get(origRes.entry.id) as any;
    assert.strictEqual(updatedOrig.status, 'REVERSED');

    // 3. Attempting to reverse again should be rejected
    const secondRev = createMirrorReversal(company, origRes.entry.id, '2026-03-23');
    assert.strictEqual(secondRev.success, false);
    assert.ok(secondRev.errors?.some(e => e.includes('already been reversed')));
  });

  test('Hierarchical COA: Recursive Rollup & Subtree Balances', () => {
    const tree = getHierarchicalCoa(company.id);
    assert.ok(tree.length > 0);

    const assetNode = tree.find(n => n.code === '1000');
    assert.ok(assetNode, 'Top level Asset group node must exist');
    assert.ok(assetNode.children.length > 0, 'Asset node must have children');
    assert.ok(assetNode.debitTotal > 0, 'Asset group must aggregate child debit totals');

    // Test Tag filtering on #1206 (Commercial Unit #1206)
    const tagTree = getHierarchicalCoa(company.id, { tag: '#1206' });
    const flattened = flattenCoaTree(tagTree);
    const propertyAcc = flattened.find(n => n.code === '1510');
    assert.ok(propertyAcc, 'Property account for #1206 should be present');
    assert.ok(propertyAcc.displayBalance > 0, 'Property cost for #1206 should be non-zero');
  });

  test('Multi-Step Flow Template: Cash Sales 2-Step Batch Execution & Placeholders', () => {
    const db = getDb();
    const tplRow = db.prepare("SELECT * FROM flow_templates WHERE id = 'tpl_cash_sales'").get() as any;
    assert.ok(tplRow, 'Cash Sales template should be seeded');

    const steps = JSON.parse(tplRow.steps || '[]');
    assert.strictEqual(steps.length, 2, 'Cash Sales must have 2 steps');

    const purpose = 'Advisory Consulting Q3';
    const documentNo = 'INV-2026-8801';
    const documentDate = '2026-03-25';
    const amount = 5000;
    const customerAccountId = 'acc_1130';
    const salesAccountId = 'acc_4100';
    const cashAccountId = 'acc_1110';

    // Step 1: Dr Customer, Cr Sales
    const step1Narration = steps[0].narration_template
      .replace('{purpose}', purpose)
      .replace('{document_no}', documentNo)
      .replace('{document_date}', documentDate);

    assert.ok(step1Narration.includes(purpose));
    assert.ok(step1Narration.includes(documentNo));

    const step1Res = postJournalEntry(company, {
      companyId: company.id,
      entryDate: documentDate,
      memo: step1Narration,
      reference: documentNo,
      lines: [
        { accountId: customerAccountId, debit: amount, currency: 'USD' },
        { accountId: salesAccountId, credit: amount, currency: 'USD' }
      ]
    });
    assert.strictEqual(step1Res.success, true);
    assert.ok(step1Res.entry);

    // Step 2: Dr Cash, Cr Customer
    const step2Narration = steps[1].narration_template
      .replace('{purpose}', purpose)
      .replace('{document_no}', documentNo)
      .replace('{document_date}', documentDate);

    const step2Res = postJournalEntry(company, {
      companyId: company.id,
      entryDate: documentDate,
      memo: step2Narration,
      reference: `RCP:${documentNo}`,
      lines: [
        { accountId: cashAccountId, debit: amount, currency: 'USD' },
        { accountId: customerAccountId, credit: amount, currency: 'USD' }
      ]
    });
    assert.strictEqual(step2Res.success, true);
    assert.ok(step2Res.entry);
  });

  test('Ledger Governance: SOP Steps & Scrutiny Trigger Rules Persistence', () => {
    const db = getDb();
    const testSop = [
      { step_number: 1, title: 'Check Driver Logbook', instruction: 'Record vehicle KM and odometer reading' },
      { step_number: 2, title: 'Verify Fuel Invoice', instruction: 'Match petrol pump receipt with corporate card charge' }
    ];
    const testTriggers = {
      min_monthly_transactions: 2,
      max_single_transaction_limit: 7500,
      alert_on_unusual_variance: true
    };

    db.prepare(`
      UPDATE accounts SET 
        sop_steps = ?,
        trigger_rules = ?,
        tags = ?
      WHERE id = 'acc_5300'
    `).run(JSON.stringify(testSop), JSON.stringify(testTriggers), JSON.stringify(['#Fuel', '#Fleet']));

    const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get('acc_5300') as any;
    assert.ok(row);

    const parsedSop = JSON.parse(row.sop_steps);
    assert.strictEqual(parsedSop.length, 2);
    assert.strictEqual(parsedSop[0].title, 'Check Driver Logbook');

    const parsedTriggers = JSON.parse(row.trigger_rules);
    assert.strictEqual(parsedTriggers.min_monthly_transactions, 2);
    assert.strictEqual(parsedTriggers.max_single_transaction_limit, 7500);

    const parsedTags = JSON.parse(row.tags);
    assert.ok(parsedTags.includes('#Fuel'));
  });

  test('Audit Event Logging & Immutable Trail', () => {
    const db = getDb();
    logAuditEvent(company.id, 'PROFILE_ALTERED', 'Auditor SID', 'Altered registered address for tax filing', { tax_year: 2026 });

    const event = db.prepare(`
      SELECT * FROM audit_events 
      WHERE company_id = ? AND event_type = 'PROFILE_ALTERED'
      ORDER BY created_at DESC LIMIT 1
    `).get(company.id) as any;

    assert.ok(event, 'Audit event must be logged');
    assert.strictEqual(event.actor, 'Auditor SID');
    assert.ok(event.description.includes('registered address'));
  });

  test('Smart Bank Statement Import: Template Generation with Embedded Metadata', () => {
    const db = getDb();
    const bankAcc = (db.prepare("SELECT * FROM accounts WHERE id = 'acc_1110'").get() as unknown) as Account;
    assert.ok(bankAcc);

    const templateCsv = generateBankImportTemplate(company, bankAcc, 300000);
    assert.ok(templateCsv.includes(`ACCOUNT_ID=${bankAcc.id}`));
    assert.ok(templateCsv.includes(`ACCOUNT_CODE=${bankAcc.code}`));
    assert.ok(templateCsv.includes('TARGET_STATEMENT_CLOSING_BALANCE:'));
    assert.ok(templateCsv.includes('Date,Bank_Reference_UTR,Counter_Ledger,Particulars_Narration,Amount,Tags'));
  });

  test('Smart Bank Statement Import: Rejects Backdated Entries on/before Reconciled Date Barrier', () => {
    const db = getDb();
    const bankAcc: Account = {
      ...(db.prepare("SELECT * FROM accounts WHERE id = 'acc_1110'").get() as any),
      last_reconciled_date: '2026-01-31'
    };

    const invalidContent = `
Date,Reference,Counter_Ledger,Narration,Amount,Tags
2026-01-15,NEFT-001,4100,Backdated Deposit in Locked Period,5000,#Sales
2026-02-05,NEFT-002,4100,Valid Feb Deposit,10000,#Sales
`;

    const validation = validateBankImportContent(company, bankAcc, invalidContent);
    assert.strictEqual(validation.valid, false);
    assert.ok(validation.errors.some(e => e.includes('2026-01-15') && e.includes('last reconciled closing date')));
    assert.strictEqual(validation.parsedRows[0].error !== undefined, true);
    assert.strictEqual(validation.parsedRows[1].error, undefined);
  });

  test('Smart Bank Statement Import: Rejects Unresolved Counter Ledgers', () => {
    const db = getDb();
    const bankAcc: Account = {
      ...(db.prepare("SELECT * FROM accounts WHERE id = 'acc_1110'").get() as any),
      last_reconciled_date: '2026-01-31'
    };

    const invalidLedgerContent = `
Date,Reference,Counter_Ledger,Narration,Amount,Tags
2026-02-05,NEFT-002,NonExistentLedger999,Random Inflow,8000,#Sales
`;

    const validation = validateBankImportContent(company, bankAcc, invalidLedgerContent);
    assert.strictEqual(validation.valid, false);
    assert.ok(validation.errors.some(e => e.includes('NonExistentLedger999') && e.includes('could not be resolved')));
  });

  test('Smart Bank Statement Import: Validates Mathematical Closing Balance & Executes Atomic Batch Posting', () => {
    const db = getDb();
    const bankAcc: Account = {
      ...(db.prepare("SELECT * FROM accounts WHERE id = 'acc_1110'").get() as any),
      last_reconciled_date: '2026-01-31'
    };

    // Opening Balance + Deposits ($20,000) - Withdrawals ($4,500)
    const validContent = `
# TARGET_STATEMENT_CLOSING_BALANCE: 315500.00
Date,Reference,Counter_Ledger,Narration,Amount,Tags
2026-02-15,NEFT-991,4100,Enterprise Retainer Fee Feb,20000.00,#Consulting
2026-02-22,CHQ-441,5200,Office Additional Maintenance Facility,-4500.00,#HQ
`;

    const validation = validateBankImportContent(company, bankAcc, validContent);
    assert.strictEqual(validation.valid, true);
    assert.strictEqual(validation.errors.length, 0);
    assert.strictEqual(validation.parsedRows.length, 2);
    assert.strictEqual(validation.metadata.totalInflows, 20000);
    assert.strictEqual(validation.metadata.totalOutflows, 4500);
    assert.strictEqual(validation.metadata.netMovement, 15500);

    // Execute atomic batch post
    const postRes = executeBankImportBatch(company, bankAcc, validation.parsedRows, 'Test Auditor');
    assert.strictEqual(postRes.success, true);
    assert.strictEqual(postRes.createdCount, 2);
    assert.strictEqual(postRes.newReconciledDate, '2026-02-22');

    // Verify account's new reconciled date in DB
    const updatedAcc = db.prepare("SELECT last_reconciled_date FROM accounts WHERE id = 'acc_1110'").get() as any;
    assert.strictEqual(updatedAcc.last_reconciled_date, '2026-02-22');

    // Verify audit event was logged
    const auditEvt = db.prepare(`
      SELECT * FROM audit_events 
      WHERE company_id = ? AND event_type = 'BANK_STATEMENT_BATCH_IMPORTED'
      ORDER BY created_at DESC LIMIT 1
    `).get(company.id) as any;

    assert.ok(auditEvt);
    assert.strictEqual(auditEvt.actor, 'Test Auditor');
    assert.ok(auditEvt.description.includes('2026-02-22'));
  });

  test('Bank Reconciliation Statement (BRS): Formula Proof, Timing Differences & Line Clearance Matching', () => {
    const db = getDb();
    const bankAccId = 'acc_1110';

    // 1. Fetch initial BRS data
    const brsData = getBankReconciliationData(company.id, bankAccId, '2026-03-31', 300000);
    assert.ok(brsData);
    assert.ok(brsData.transactions.length > 0, 'Should have bank transactions');
    assert.strictEqual(typeof brsData.bookBalance, 'number');
    assert.strictEqual(typeof brsData.reconciledBankBalance, 'number');

    // 2. Test updating a line clearance
    const targetLine = brsData.transactions[0];
    updateLineClearance(targetLine.lineId, true, '2026-03-05');

    const updatedLine = db.prepare('SELECT is_bank_cleared, bank_cleared_date FROM journal_lines WHERE id = ?').get(targetLine.lineId) as any;
    assert.strictEqual(updatedLine.is_bank_cleared, 1);
    assert.strictEqual(updatedLine.bank_cleared_date, '2026-03-05');

    // 3. Test finalizing and locking BRS: fails on unresolved variance without override, succeeds with override
    const failRes = finalizeBankReconciliation(company.id, bankAccId, '2026-03-31', 350000, 'Senior Auditor', false);
    assert.strictEqual(failRes.success, false);
    assert.ok(failRes.error?.includes('unresolved variance'));

    const finalizeRes = finalizeBankReconciliation(company.id, bankAccId, '2026-03-31', 350000, 'Senior Auditor', true);
    assert.strictEqual(finalizeRes.success, true);
    assert.strictEqual(finalizeRes.newReconciledDate, '2026-03-31');

    const updatedAcc = db.prepare('SELECT last_reconciled_date, last_reconciled_balance FROM accounts WHERE id = ?').get(bankAccId) as any;
    assert.strictEqual(updatedAcc.last_reconciled_date, '2026-03-31');
    assert.strictEqual(updatedAcc.last_reconciled_balance, 350000);

    // 4. Verify audit event
    const auditEvt = db.prepare(`
      SELECT * FROM audit_events 
      WHERE company_id = ? AND event_type = 'BANK_RECONCILIATION_FINALIZED'
      ORDER BY created_at DESC LIMIT 1
    `).get(company.id) as any;

    assert.ok(auditEvt);
    assert.strictEqual(auditEvt.actor, 'Senior Auditor');
    assert.ok(auditEvt.description.includes('2026-03-31'));
  });

  test('Strict Account Validation: Rejects group accounts, inactive accounts, cross-company accounts, and non-existent accounts', () => {
    // 1. Group account rejection (acc_1000 has is_group = 1)
    const groupEntry = {
      companyId: company.id,
      entryDate: '2026-03-25',
      lines: [
        { accountId: 'acc_1000', debit: 100, currency: 'USD' }, // Parent group
        { accountId: 'acc_1110', credit: 100, currency: 'USD' }
      ]
    };
    const groupVal = validateJournalEntry(company, groupEntry);
    assert.strictEqual(groupVal.valid, false);
    assert.ok(groupVal.errors.some(e => e.includes('parent group account')));

    // 2. Inactive account rejection
    const db = getDb();
    db.prepare("UPDATE accounts SET is_active = 0 WHERE id = 'acc_5400'").run();
    const inactiveEntry = {
      companyId: company.id,
      entryDate: '2026-03-25',
      lines: [
        { accountId: 'acc_5400', debit: 100, currency: 'USD' }, // Inactive
        { accountId: 'acc_1110', credit: 100, currency: 'USD' }
      ]
    };
    const inactVal = validateJournalEntry(company, inactiveEntry);
    assert.strictEqual(inactVal.valid, false);
    assert.ok(inactVal.errors.some(e => e.includes('inactive')));
    db.prepare("UPDATE accounts SET is_active = 1 WHERE id = 'acc_5400'").run(); // restore

    // 3. Cross-company account rejection (MEA account acc_mea_1110 vs company cmp_utharam_global)
    db.prepare(`
      INSERT OR IGNORE INTO accounts (id, company_id, code, name, type, parent_id, path, is_group, currency, is_active, created_at)
      VALUES ('acc_mea_1110', 'cmp_utharam_mea', '1110', 'MEA Operating Bank (AED)', 'ASSET', null, '1110', 0, 'AED', 1, ?)
    `).run(new Date().toISOString());

    const crossEntry = {
      companyId: company.id,
      entryDate: '2026-03-25',
      lines: [
        { accountId: 'acc_mea_1110', debit: 100, currency: 'USD' }, // MEA account
        { accountId: 'acc_1110', credit: 100, currency: 'USD' }
      ]
    };
    const crossVal = validateJournalEntry(company, crossEntry);
    assert.strictEqual(crossVal.valid, false);
    assert.ok(crossVal.errors.some(e => e.includes('belongs to a different entity')));

    // 4. Non-existent account rejection
    const nonExistEntry = {
      companyId: company.id,
      entryDate: '2026-03-25',
      lines: [
        { accountId: 'acc_non_existent_999', debit: 100, currency: 'USD' },
        { accountId: 'acc_1110', credit: 100, currency: 'USD' }
      ]
    };
    const nonExistVal = validateJournalEntry(company, nonExistEntry);
    assert.strictEqual(nonExistVal.valid, false);
    assert.ok(nonExistVal.errors.some(e => e.includes('does not exist in Chart of Accounts')));

    // 5. Conflicting debit and credit on same line
    const conflictEntry = {
      companyId: company.id,
      entryDate: '2026-03-25',
      lines: [
        { accountId: 'acc_1110', debit: 100, credit: 50, currency: 'USD' },
        { accountId: 'acc_4100', credit: 50, currency: 'USD' }
      ]
    };
    const conflictVal = validateJournalEntry(company, conflictEntry);
    assert.strictEqual(conflictVal.valid, false);
    assert.ok(conflictVal.errors.some(e => e.includes('conflicting debit and credit')));

    // 6. Invalid date format
    const invalidDateEntry = {
      companyId: company.id,
      entryDate: '25-03-2026', // non-ISO
      lines: [
        { accountId: 'acc_1110', debit: 100, currency: 'USD' },
        { accountId: 'acc_4100', credit: 100, currency: 'USD' }
      ]
    };
    const dateVal = validateJournalEntry(company, invalidDateEntry);
    assert.strictEqual(dateVal.valid, false);
    assert.ok(dateVal.errors.some(e => e.includes('valid entry date in YYYY-MM-DD')));
  });

  test('Multi-Currency AP Vendor Payment: Correct Dr/Cr legs, Outflow, and Realized FX Loss sign', () => {
    // We owe vendor EUR 1,000 at invoice booking rate 1.05 = $1,050 USD base.
    // We pay vendor EUR 1,000 when rate rises to 1.15 = $1,150 USD base.
    // Bank outflow: Credit Bank (+$1,150).
    // AP settled: Debit AP (-$1,050).
    // Realized FX Loss: Debit FX (-$100).
    const settlementLines = generateFxSettlementLines({
      company,
      settlementCurrency: 'EUR',
      originalExchangeRate: 1.05,
      settlementExchangeRate: 1.15,
      foreignAmount: 1000,
      receivableOrPayableAccountId: 'acc_2110', // AP
      bankAccountId: 'acc_1110',               // Bank
      fxGainLossAccountId: 'acc_4900',
      direction: 'PAYMENT',
      tags: ['#AP-Vendor-Payment']
    });

    assert.strictEqual(settlementLines.length, 3);

    const bankLeg = settlementLines.find(l => l.accountId === 'acc_1110');
    assert.ok(bankLeg);
    assert.strictEqual(bankLeg.signedAmount, 1150, 'Bank leg must be Credit (positive / outflow)');
    assert.strictEqual(bankLeg.foreignAmount, 1000);

    const apLeg = settlementLines.find(l => l.accountId === 'acc_2110');
    assert.ok(apLeg);
    assert.strictEqual(apLeg.signedAmount, -1050, 'AP leg must be Debit (negative / liability reduction)');
    assert.strictEqual(apLeg.foreignAmount, -1000);

    const fxLeg = settlementLines.find(l => l.accountId === 'acc_4900');
    assert.ok(fxLeg);
    assert.strictEqual(fxLeg.signedAmount, -100, 'FX leg must be Debit (negative / expense / loss)');
    assert.ok(fxLeg.memo?.includes('Loss'), 'Memo must indicate FX Loss');

    // Total must zero balance
    const sum = settlementLines.reduce((acc, l) => acc + (l.signedAmount || 0), 0);
    assert.strictEqual(Math.round(sum * 100) / 100, 0);

    // Post to ledger
    const postRes = postJournalEntry(company, {
      companyId: company.id,
      entryDate: '2026-03-26',
      memo: 'Vendor Bill Payment in EUR with FX Loss',
      lines: settlementLines
    });
    assert.strictEqual(postRes.success, true);
    assert.ok(postRes.entry);
  });

  test('Atomic Database Sequences: Unique document sequences eliminate duplicate numbers', () => {
    const db = getDb();
    const seq1 = getNextDocumentSequence(db, company.id, 'JV', 2026);
    const seq2 = getNextDocumentSequence(db, company.id, 'JV', 2026);
    assert.strictEqual(seq2, seq1 + 1, 'Sequences must be monotonically increasing');
  });

  test('Exact Tag Matching via SQLite json_each: Avoids substring collisions', () => {
    // Post entry with tag '#12'
    const res1 = postJournalEntry(company, {
      companyId: company.id,
      entryDate: '2026-03-27',
      memo: 'Project #12 Material Cost',
      lines: [
        { accountId: 'acc_5200', debit: 120, currency: 'USD', tags: ['#12'] },
        { accountId: 'acc_1110', credit: 120, currency: 'USD', tags: ['#12'] }
      ]
    });
    assert.strictEqual(res1.success, true);

    // Filter by tag '#12'
    const tree12 = getHierarchicalCoa(company.id, { tag: '#12' });
    const flattened12 = flattenCoaTree(tree12);
    const officeExpense12 = flattened12.find(n => n.code === '5200');
    assert.ok(officeExpense12, 'Account 5200 should have records for tag #12');
    assert.strictEqual(officeExpense12.displayBalance, 120);

    // Filtering by '#12' should NOT match '#1206' transactions
    const propertyCost12 = flattened12.find(n => n.code === '1510');
    assert.strictEqual(propertyCost12?.displayBalance || 0, 0, '#12 must not match #1206');
  });

  test('Schema Integrity: Assets and Governance Tables persist with created_at timestamps', () => {
    const db = getDb();
    const now = new Date().toISOString();

    // 1. Assets table with all columns
    const assetId = `ast_test_${Date.now()}`;
    db.prepare(`
      INSERT INTO assets (
        id, company_id, name, asset_code, category, tag,
        cost_account_id, purchase_cost, currency, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
    `).run(assetId, company.id, 'MacBook Pro M3', 'AST-IT-001', 'IT Equipment', '#IT-MBP', 'acc_1510', 3500, 'USD', now);

    const assetRow = db.prepare('SELECT * FROM assets WHERE id = ?').get(assetId) as any;
    assert.ok(assetRow);
    assert.strictEqual(assetRow.asset_code, 'AST-IT-001');
    assert.strictEqual(assetRow.category, 'IT Equipment');
    assert.strictEqual(assetRow.purchase_cost, 3500);
    assert.ok(assetRow.created_at);

    // 2. Company Officers with created_at
    const officerId = `off_test_${Date.now()}`;
    db.prepare(`
      INSERT INTO company_officers (
        id, company_id, full_name, role, appointed_date, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, 1, ?)
    `).run(officerId, company.id, 'John Doe', 'Director', '2026-01-01', now);

    const offRow = db.prepare('SELECT * FROM company_officers WHERE id = ?').get(officerId) as any;
    assert.ok(offRow);
    assert.strictEqual(offRow.full_name, 'John Doe');
    assert.ok(offRow.created_at);

    // 3. Shareholding Structure with created_at
    const shareId = `sh_test_${Date.now()}`;
    db.prepare(`
      INSERT INTO shareholding_structure (
        id, company_id, shareholder_name, shareholder_type, share_class,
        number_of_shares, percentage_holding, is_ubo, effective_from, created_at
      ) VALUES (?, ?, ?, 'INDIVIDUAL', 'EQUITY', 1000, 10.0, 0, '2026-01-01', ?)
    `).run(shareId, company.id, 'Jane Doe', now);

    const shRow = db.prepare('SELECT * FROM shareholding_structure WHERE id = ?').get(shareId) as any;
    assert.ok(shRow);
    assert.strictEqual(shRow.shareholder_name, 'Jane Doe');
    assert.ok(shRow.created_at);
  });
});

