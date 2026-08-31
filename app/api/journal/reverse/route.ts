import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { Company } from '@/lib/db/schema';
import { createMirrorReversal } from '@/lib/engine/accounting';

export async function POST(req: Request) {
  try {
    const db = getDb();
    const body = await req.json();
    const { companyId, entryId, reversalDate, reversalMemo, createdBy } = body;

    if (!companyId || !entryId || !reversalDate) {
      return NextResponse.json({ success: false, error: 'Missing companyId, entryId, or reversalDate' }, { status: 400 });
    }

    const company = (db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as unknown) as Company;
    if (!company) {
      return NextResponse.json({ success: false, error: 'Company not found' }, { status: 404 });
    }

    const result = createMirrorReversal(company, entryId, reversalDate, reversalMemo, createdBy || 'Auditor');
    if (!result.success) {
      return NextResponse.json({ success: false, errors: result.errors }, { status: 400 });
    }

    return NextResponse.json({ success: true, entry: result.entry });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
