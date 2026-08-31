import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { Company, JournalEntry, JournalLine } from '@/lib/db/schema';
import { postJournalEntry, CreateJournalEntryInput } from '@/lib/engine/accounting';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId') || 'cmp_utharam_global';
    const tag = searchParams.get('tag');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const db = getDb();

    let query = `
      SELECT je.*, 
        json_group_array(
          json_object(
            'id', jl.id,
            'account_id', jl.account_id,
            'account_code', acc.code,
            'account_name', acc.name,
            'currency', jl.currency,
            'exchange_rate', jl.exchange_rate,
            'foreign_amount', jl.foreign_amount,
            'amount', jl.amount,
            'memo', jl.memo,
            'tags', jl.tags
          )
        ) as lines_json
      FROM journal_entries je
      LEFT JOIN journal_lines jl ON je.id = jl.entry_id
      LEFT JOIN accounts acc ON jl.account_id = acc.id
      WHERE je.company_id = ?
    `;
    const params: any[] = [companyId];

    if (startDate) {
      query += ` AND je.entry_date >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND je.entry_date <= ?`;
      params.push(endDate);
    }
    if (tag) {
      query += ` AND jl.tags LIKE ?`;
      params.push(`%"${tag}"%`);
    }

    query += ` GROUP BY je.id ORDER BY je.entry_date DESC, je.created_at DESC`;

    const rawEntries = db.prepare(query).all(...params) as any[];

    const entries = rawEntries.map(e => {
      let lines = [];
      try {
        lines = JSON.parse(e.lines_json).filter((l: any) => l && l.id !== null);
      } catch {}
      return {
        ...e,
        lines
      };
    });

    return NextResponse.json({ success: true, entries });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const db = getDb();
    const body: CreateJournalEntryInput = await req.json();

    const company = (db.prepare('SELECT * FROM companies WHERE id = ?').get(body.companyId) as unknown) as Company;
    if (!company) {
      return NextResponse.json({ success: false, error: 'Company not found' }, { status: 404 });
    }

    const result = postJournalEntry(company, body);
    if (!result.success) {
      return NextResponse.json({ success: false, errors: result.errors }, { status: 400 });
    }

    return NextResponse.json({ success: true, entry: result.entry });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
