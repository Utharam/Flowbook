import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { Company } from '@/lib/db/schema';
import { getHierarchicalCoa, flattenCoaTree, AccountTreeNode } from '@/lib/engine/coa-tree';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId') || 'cmp_utharam_global';
    const reportType = searchParams.get('type') || 'trial-balance'; // 'trial-balance', 'balance-sheet', 'income-statement', 'tag-matrix', 'comparative'
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const tag = searchParams.get('tag') || undefined;

    const db = getDb();

    // 1. MULTI-COMPANY COMPARATIVE REPORT
    if (reportType === 'comparative') {
      const companyIdsParam = searchParams.get('companyIds');
      let targetCompanyIds: string[] = [];

      if (companyIdsParam) {
        targetCompanyIds = companyIdsParam.split(',').map(s => s.trim()).filter(Boolean);
      } else {
        const allComps = (db.prepare('SELECT id FROM companies LIMIT 5').all() as unknown) as Array<{ id: string }>;
        targetCompanyIds = allComps.map(c => c.id);
      }

      const comparativeData = [];

      for (const cId of targetCompanyIds) {
        const comp = (db.prepare('SELECT * FROM companies WHERE id = ?').get(cId) as unknown) as Company;
        if (!comp) continue;

        const tree = getHierarchicalCoa(cId, { startDate, endDate, tag });
        const flattened = flattenCoaTree(tree);

        // Calculate Totals
        const leafAccounts = flattened.filter(a => a.is_group === 0);
        const totalDebits = leafAccounts.reduce((sum, a) => sum + (a.debitTotal || 0), 0);
        const totalCredits = leafAccounts.reduce((sum, a) => sum + (a.creditTotal || 0), 0);

        const assetNodes = tree.filter(n => n.type === 'ASSET');
        const liabilityNodes = tree.filter(n => n.type === 'LIABILITY');
        const equityNodes = tree.filter(n => n.type === 'EQUITY');
        const revenueNodes = tree.filter(n => n.type === 'REVENUE');
        const expenseNodes = tree.filter(n => n.type === 'EXPENSE');

        const totalAssets = assetNodes.reduce((sum, n) => sum + n.displayBalance, 0);
        const totalLiabilities = liabilityNodes.reduce((sum, n) => sum + n.displayBalance, 0);
        const totalEquityBase = equityNodes.reduce((sum, n) => sum + n.displayBalance, 0);
        const totalRevenue = revenueNodes.reduce((sum, n) => sum + n.displayBalance, 0);
        const totalExpenses = expenseNodes.reduce((sum, n) => sum + n.displayBalance, 0);
        const netProfit = totalRevenue - totalExpenses;
        const marginPercentage = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

        comparativeData.push({
          company: comp,
          trial_balance: {
            totalDebits,
            totalCredits,
            variance: totalDebits - totalCredits,
            leafAccountsCount: leafAccounts.length
          },
          balance_sheet: {
            totalAssets,
            totalLiabilities,
            totalEquityBase,
            currentPeriodEarnings: netProfit,
            totalEquityWithEarnings: totalEquityBase + netProfit,
            totalLiabilitiesAndEquity: totalLiabilities + (totalEquityBase + netProfit),
            isBalanced: Math.abs(totalAssets - (totalLiabilities + (totalEquityBase + netProfit))) < 0.01
          },
          income_statement: {
            totalRevenue,
            totalExpenses,
            netProfit,
            marginPercentage
          },
          accounts_summary: {
            assets: assetNodes.map(n => ({ code: n.code, name: n.name, balance: n.displayBalance })),
            liabilities: liabilityNodes.map(n => ({ code: n.code, name: n.name, balance: n.displayBalance })),
            equity: equityNodes.map(n => ({ code: n.code, name: n.name, balance: n.displayBalance })),
            revenue: revenueNodes.map(n => ({ code: n.code, name: n.name, balance: n.displayBalance })),
            expenses: expenseNodes.map(n => ({ code: n.code, name: n.name, balance: n.displayBalance }))
          }
        });
      }

      return NextResponse.json({
        success: true,
        reportType: 'comparative',
        filters: { startDate, endDate, tag },
        comparativeData
      });
    }

    // SINGLE COMPANY REPORTS
    const company = (db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as unknown) as Company;
    if (!company) {
      return NextResponse.json({ success: false, error: 'Company not found' }, { status: 404 });
    }

    const tree = getHierarchicalCoa(companyId, { startDate, endDate, tag });
    const flattened = flattenCoaTree(tree);

    if (reportType === 'trial-balance') {
      const leafAccounts = flattened.filter(a => a.is_group === 0);
      const totalDebits = leafAccounts.reduce((sum, a) => sum + (a.debitTotal || 0), 0);
      const totalCredits = leafAccounts.reduce((sum, a) => sum + (a.creditTotal || 0), 0);
      const variance = totalDebits - totalCredits;

      return NextResponse.json({
        success: true,
        reportType,
        company,
        filters: { startDate, endDate, tag },
        tree,
        flattened,
        totals: {
          totalDebits,
          totalCredits,
          variance,
          isBalanced: Math.abs(variance) < 0.01
        }
      });
    }

    if (reportType === 'balance-sheet') {
      const assetNodes = tree.filter(n => n.type === 'ASSET');
      const liabilityNodes = tree.filter(n => n.type === 'LIABILITY');
      const equityNodes = tree.filter(n => n.type === 'EQUITY');

      const totalAssets = assetNodes.reduce((sum, n) => sum + n.displayBalance, 0);
      const totalLiabilities = liabilityNodes.reduce((sum, n) => sum + n.displayBalance, 0);
      const totalEquityBase = equityNodes.reduce((sum, n) => sum + n.displayBalance, 0);

      const revenueNodes = tree.filter(n => n.type === 'REVENUE');
      const expenseNodes = tree.filter(n => n.type === 'EXPENSE');
      const totalRevenue = revenueNodes.reduce((sum, n) => sum + n.displayBalance, 0);
      const totalExpenses = expenseNodes.reduce((sum, n) => sum + n.displayBalance, 0);
      const currentPeriodEarnings = totalRevenue - totalExpenses;

      const totalEquityWithEarnings = totalEquityBase + currentPeriodEarnings;
      const totalLiabilitiesAndEquity = totalLiabilities + totalEquityWithEarnings;
      const balanceCheck = totalAssets - totalLiabilitiesAndEquity;

      return NextResponse.json({
        success: true,
        reportType,
        company,
        filters: { startDate, endDate, tag },
        assets: assetNodes,
        liabilities: liabilityNodes,
        equity: equityNodes,
        totals: {
          totalAssets,
          totalLiabilities,
          totalEquityBase,
          currentPeriodEarnings,
          totalEquityWithEarnings,
          totalLiabilitiesAndEquity,
          balanceCheck,
          isBalanced: Math.abs(balanceCheck) < 0.01
        }
      });
    }

    if (reportType === 'income-statement') {
      const revenueNodes = tree.filter(n => n.type === 'REVENUE');
      const expenseNodes = tree.filter(n => n.type === 'EXPENSE');

      const totalRevenue = revenueNodes.reduce((sum, n) => sum + n.displayBalance, 0);
      const totalExpenses = expenseNodes.reduce((sum, n) => sum + n.displayBalance, 0);
      const netProfit = totalRevenue - totalExpenses;
      const marginPercentage = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

      return NextResponse.json({
        success: true,
        reportType,
        company,
        filters: { startDate, endDate, tag },
        revenue: revenueNodes,
        expenses: expenseNodes,
        totals: {
          totalRevenue,
          totalExpenses,
          netProfit,
          marginPercentage
        }
      });
    }

    if (reportType === 'tag-matrix') {
      const tagRows = db.prepare(`
        SELECT jl.tags FROM journal_lines jl
        JOIN journal_entries je ON jl.entry_id = je.id
        WHERE je.company_id = ? AND je.status = 'POSTED'
      `).all(companyId) as Array<{ tags: string }>;

      const tagSet = new Set<string>();
      for (const row of tagRows) {
        try {
          const list = JSON.parse(row.tags || '[]');
          for (const t of list) {
            if (t) tagSet.add(t);
          }
        } catch {}
      }

      const allTags = Array.from(tagSet);
      const tagSummaries = [];

      for (const t of allTags) {
        const tTree = getHierarchicalCoa(companyId, { startDate, endDate, tag: t });
        const rev = tTree.filter(n => n.type === 'REVENUE').reduce((s, n) => s + n.displayBalance, 0);
        const exp = tTree.filter(n => n.type === 'EXPENSE').reduce((s, n) => s + n.displayBalance, 0);
        const assets = tTree.filter(n => n.type === 'ASSET').reduce((s, n) => s + n.displayBalance, 0);
        const liab = tTree.filter(n => n.type === 'LIABILITY').reduce((s, n) => s + n.displayBalance, 0);

        tagSummaries.push({
          tag: t,
          totalRevenue: rev,
          totalExpenses: exp,
          netProfit: rev - exp,
          totalAssets: assets,
          totalLiabilities: liab
        });
      }

      return NextResponse.json({
        success: true,
        reportType,
        company,
        filters: { startDate, endDate },
        tags: allTags,
        tagSummaries
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid report type' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
