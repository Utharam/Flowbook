import { NextResponse } from 'next/server';
import { 
  getBankReconciliationData, 
  updateLineClearance, 
  bulkUpdateClearance, 
  finalizeBankReconciliation 
} from '@/lib/engine/reconciliation';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId') || 'cmp_utharam_global';
    const accountId = searchParams.get('accountId');
    const asOfDate = searchParams.get('asOfDate') || new Date().toISOString().substring(0, 10);
    const statementBalanceStr = searchParams.get('statementBalance');
    const statementBalance = statementBalanceStr !== null && statementBalanceStr !== '' ? parseFloat(statementBalanceStr) : null;

    if (!accountId) {
      return NextResponse.json({ success: false, error: 'accountId is required' }, { status: 400 });
    }

    const data = getBankReconciliationData(companyId, accountId, asOfDate, statementBalance);
    return NextResponse.json({
      success: true,
      ...data
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, companyId, accountId, asOfDate, statementBalance, lineId, lineIds, isCleared, clearedDate, actor } = body;

    // 1. Update single line clearance
    if (action === 'UPDATE_LINE' && lineId) {
      updateLineClearance(lineId, !!isCleared, clearedDate || null);
      return NextResponse.json({ success: true, message: 'Line clearance updated.' });
    }

    // 2. Bulk update line clearances
    if (action === 'BULK_CLEAR' && Array.isArray(lineIds)) {
      bulkUpdateClearance(lineIds, !!isCleared, clearedDate || null);
      return NextResponse.json({ success: true, message: `Updated ${lineIds.length} lines.` });
    }

    // 3. Finalize & Lock Reconciliation for Period
    if (action === 'FINALIZE' && companyId && accountId && asOfDate && statementBalance !== undefined) {
      const res = finalizeBankReconciliation(companyId, accountId, asOfDate, parseFloat(statementBalance), actor || 'Accountant');
      return NextResponse.json({
        ...res,
        message: `Bank reconciliation locked as of ${asOfDate}.`
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
