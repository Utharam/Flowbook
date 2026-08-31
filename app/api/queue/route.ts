import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ActionQueueItem, Company } from '@/lib/db/schema';
import { postJournalEntry } from '@/lib/engine/accounting';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId') || 'cmp_utharam_global';
    const status = searchParams.get('status');

    const db = getDb();
    let query = `SELECT * FROM action_queue WHERE company_id = ?`;
    const params: any[] = [companyId];

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC`;

    const items = db.prepare(query).all(...params) as any[];
    const parsed = items.map(item => ({
      ...item,
      metadata: JSON.parse(item.metadata || '{}')
    }));

    return NextResponse.json({ success: true, items: parsed });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const db = getDb();
    const body = await req.json();
    const { id, action, companyId, batchPayload } = body;

    // Direct Queue Creation (e.g. from Flow Launcher "Send to Action Queue")
    if (action === 'QUEUE_BATCH') {
      if (!companyId || !batchPayload) {
        return NextResponse.json({ success: false, error: 'Missing companyId or batchPayload' }, { status: 400 });
      }

      const queueId = `q_flow_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO action_queue (id, company_id, type, title, description, severity, status, metadata, created_at)
        VALUES (?, ?, 'FLOW_TEMPLATE_BATCH', ?, ?, 'MEDIUM', 'PENDING', ?, ?)
      `).run(
        queueId,
        companyId,
        `Flow Batch: ${batchPayload.template_name || 'Multi-Voucher Flow'} (${batchPayload.entries?.length || 0} Vouchers)`,
        batchPayload.description || `Generated ${batchPayload.entries?.length || 0} sequential entries for ${batchPayload.purpose || 'business operation'}.`,
        JSON.stringify(batchPayload),
        now
      );

      return NextResponse.json({ success: true, queueId, message: 'Batch successfully queued for approval' });
    }

    // Queue Item Action Handlers
    const item = db.prepare('SELECT * FROM action_queue WHERE id = ?').get(id) as any;
    if (!item) {
      return NextResponse.json({ success: false, error: 'Queue item not found' }, { status: 404 });
    }

    if (action === 'DISMISS') {
      db.prepare('UPDATE action_queue SET status = ? WHERE id = ?').run('DISMISSED', id);
      return NextResponse.json({ success: true, message: 'Item dismissed' });
    }

    const targetCompanyId = companyId || item.company_id;
    const company = (db.prepare('SELECT * FROM companies WHERE id = ?').get(targetCompanyId) as unknown) as Company;

    if (!company) {
      return NextResponse.json({ success: false, error: 'Company not found' }, { status: 404 });
    }

    // Handle FLOW_TEMPLATE_BATCH Approval & Posting
    if (action === 'APPROVE_BATCH' || item.type === 'FLOW_TEMPLATE_BATCH') {
      const meta = JSON.parse(item.metadata || '{}');
      const entriesToPost = meta.entries || [];

      if (entriesToPost.length === 0) {
        return NextResponse.json({ success: false, error: 'No vouchers found in batch' }, { status: 400 });
      }

      const postedEntries = [];
      for (const entryInput of entriesToPost) {
        const postRes = postJournalEntry(company, entryInput);
        if (!postRes.success) {
          return NextResponse.json({
            success: false,
            error: `Failed to post voucher '${entryInput.memo}': ${postRes.errors?.join(', ')}`
          }, { status: 400 });
        }
        postedEntries.push(postRes.entry);
      }

      db.prepare('UPDATE action_queue SET status = ? WHERE id = ?').run('PROCESSED', id);
      return NextResponse.json({
        success: true,
        message: `Successfully posted ${postedEntries.length} batch vouchers to ledger!`,
        entries: postedEntries
      });
    }

    // Handle INTERCOMPANY_MIRROR_DRAFT Approval
    if (action === 'APPROVE_MIRROR') {
      const meta = JSON.parse(item.metadata || '{}');
      
      if (company && meta.debit_account && meta.credit_account && meta.proposed_amount) {
        const mirrorRes = postJournalEntry(company, {
          companyId: company.id,
          entryDate: new Date().toISOString().substring(0, 10),
          memo: `Intercompany Mirror Voucher: ${meta.memo || 'Approved Service Draft'}`,
          reference: `IC-MIRROR-${item.id.substring(0, 6)}`,
          lines: [
            { accountId: meta.debit_account, debit: meta.proposed_amount, currency: company.base_currency },
            { accountId: meta.credit_account, credit: meta.proposed_amount, currency: company.base_currency }
          ]
        });

        if (mirrorRes.success) {
          db.prepare('UPDATE action_queue SET status = ? WHERE id = ?').run('PROCESSED', id);
          return NextResponse.json({ success: true, message: 'Mirror voucher posted and queue item resolved', entry: mirrorRes.entry });
        } else {
          return NextResponse.json({ success: false, error: mirrorRes.errors?.join(', ') }, { status: 400 });
        }
      }
    }

    db.prepare('UPDATE action_queue SET status = ? WHERE id = ?').run('APPROVED', id);
    return NextResponse.json({ success: true, message: 'Queue item updated' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
