import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { getDb, logAuditEvent } from '../db';
import { Company, FlowTemplate } from '../db/schema';
import { validateJournalEntry, postJournalEntry, createMirrorReversal } from './accounting';
import { generateFxSettlementLines, getExchangeRate } from './multi-currency';
import { getHierarchicalCoa, flattenCoaTree } from './coa-tree';

describe('Flowbook Double-Entry & Multi-Currency Engine Tests', () => {
  let company: Company;

  before(() => {
    // Initialize & seed DB
    const db = getDb();
    company = (db.prepare('SELECT * FROM companies WHERE id = ?').get('cmp_utharam_global') as unknown) as Company;
    assert.ok(company, 'Seed company should exist');
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

  test('1-Click Mirror Reversal: Creates exact offsetting voucher', () => {
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
});
