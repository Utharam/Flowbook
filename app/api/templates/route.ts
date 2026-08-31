import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { FlowTemplate } from '@/lib/db/schema';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId') || 'cmp_utharam_global';

    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM flow_templates WHERE company_id = ? ORDER BY created_at DESC
    `).all(companyId) as any[];

    const templates = rows.map((r) => {
      let variables = [];
      let steps = [];
      let default_tags = [];

      try {
        variables = JSON.parse(r.variables || '[]');
      } catch {}

      try {
        steps = JSON.parse(r.steps || '[]');
      } catch {}

      try {
        default_tags = JSON.parse(r.default_tags || '[]');
      } catch {}

      return {
        id: r.id,
        company_id: r.company_id,
        name: r.name,
        category: r.category,
        description: r.description,
        default_tags,
        variables,
        steps,
        created_at: r.created_at
      };
    });

    return NextResponse.json({ success: true, templates });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const db = getDb();
    const body = await req.json();

    const {
      id,
      company_id,
      name,
      category,
      description,
      default_tags,
      variables,
      steps
    } = body;

    if (!company_id || !name) {
      return NextResponse.json({ success: false, error: 'Company ID and Template Name are required.' }, { status: 400 });
    }

    const templateId = id || `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const tagsJson = JSON.stringify(default_tags || []);
    const variablesJson = JSON.stringify(variables || []);
    const stepsJson = JSON.stringify(steps || []);

    // Check if exists
    const existing = db.prepare('SELECT id FROM flow_templates WHERE id = ?').get(templateId);

    if (existing) {
      db.prepare(`
        UPDATE flow_templates SET
          name = ?,
          category = ?,
          description = ?,
          default_tags = ?,
          variables = ?,
          steps = ?
        WHERE id = ?
      `).run(
        name,
        category || 'GENERAL',
        description || null,
        tagsJson,
        variablesJson,
        stepsJson,
        templateId
      );
    } else {
      db.prepare(`
        INSERT INTO flow_templates (
          id, company_id, name, category, description, default_tags, variables, steps, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        templateId,
        company_id,
        name,
        category || 'GENERAL',
        description || null,
        tagsJson,
        variablesJson,
        stepsJson,
        now
      );
    }

    const saved = db.prepare('SELECT * FROM flow_templates WHERE id = ?').get(templateId) as any;
    return NextResponse.json({
      success: true,
      template: {
        ...saved,
        default_tags: JSON.parse(saved.default_tags || '[]'),
        variables: JSON.parse(saved.variables || '[]'),
        steps: JSON.parse(saved.steps || '[]')
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Template ID is required.' }, { status: 400 });
    }

    const db = getDb();
    const result = db.prepare('DELETE FROM flow_templates WHERE id = ?').run(id);

    if (result.changes === 0) {
      return NextResponse.json({ success: false, error: 'Template not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Template deleted successfully.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
