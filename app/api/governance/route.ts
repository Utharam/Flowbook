import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { CompanyOfficer, ShareholdingStructure } from '@/lib/db/schema';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId') || 'cmp_utharam_global';
    
    const db = getDb();
    const officers = (db.prepare(`
      SELECT * FROM company_officers 
      WHERE company_id = ? 
      ORDER BY is_active DESC, appointed_date ASC
    `).all(companyId) as unknown) as CompanyOfficer[];

    const shareholders = (db.prepare(`
      SELECT * FROM shareholding_structure 
      WHERE company_id = ? 
      ORDER BY percentage_holding DESC
    `).all(companyId) as unknown) as ShareholdingStructure[];

    return NextResponse.json({ success: true, officers, shareholders });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const db = getDb();
    const body = await req.json();
    const { action, payload } = body;

    if (action === 'ADD_OFFICER') {
      const { company_id, full_name, role, identification_number, appointed_date, resigned_date } = payload;
      const id = `off_${Date.now()}`;
      const isActive = resigned_date ? 0 : 1;

      db.prepare(`
        INSERT INTO company_officers (id, company_id, full_name, role, identification_number, appointed_date, resigned_date, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, company_id, full_name, role, identification_number || null, appointed_date, resigned_date || null, isActive);

      return NextResponse.json({ success: true, message: 'Officer added successfully' });
    }

    if (action === 'UPDATE_OFFICER_STATUS') {
      const { id, resigned_date } = payload;
      const isActive = resigned_date ? 0 : 1;
      db.prepare(`
        UPDATE company_officers SET resigned_date = ?, is_active = ? WHERE id = ?
      `).run(resigned_date || null, isActive, id);

      return NextResponse.json({ success: true, message: 'Officer status updated' });
    }

    if (action === 'ADD_SHAREHOLDER') {
      const {
        company_id,
        shareholder_name,
        shareholder_type,
        share_class,
        number_of_shares,
        percentage_holding,
        is_ubo,
        ubo_controlling_interest_type,
        effective_from
      } = payload;

      const id = `sh_${Date.now()}`;
      db.prepare(`
        INSERT INTO shareholding_structure (
          id, company_id, shareholder_name, shareholder_type, share_class,
          number_of_shares, percentage_holding, is_ubo, ubo_controlling_interest_type,
          effective_from
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        company_id,
        shareholder_name,
        shareholder_type,
        share_class || 'EQUITY',
        Number(number_of_shares),
        Number(percentage_holding),
        is_ubo ? 1 : 0,
        ubo_controlling_interest_type || null,
        effective_from
      );

      return NextResponse.json({ success: true, message: 'Shareholder added successfully' });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
