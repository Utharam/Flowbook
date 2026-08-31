# Flowbook by Utharam

**Flowbook by Utharam** is an enterprise-grade financial ERP, multi-currency double-entry ledger, corporate governance, and multi-step process automation platform built with Next.js 15, React 19, TypeScript, Tailwind CSS, and SQLite.

---

## Key Highlights

- **Multi-Currency Double-Entry Engine**:
  - Single-column signed arithmetic with zero-sum invariant check ($\sum \text{Base Amount} = 0$).
  - Closed-period lock date barriers.
  - 1-Click mirror reversals (`REV-YYYY-XXXX`).
  - Realized FX gain/loss settlement balancer.
- **Hierarchical Chart of Accounts**:
  - Materialized taxonomy paths (`1000.1100.1110`).
  - Group vs. posting accounts with automatic recursive sub-tree rollups.
  - On-the-fly multi-level hierarchical ledger & parent group creation directly inside transaction forms.
- **Flow Engine 2.0 (Process Automation)**:
  - Multi-voucher sequential batch blueprints (e.g. Sales Invoice $\to$ Immediate Cash Receipt).
  - Constant vs. Variable ledgers with dynamic token placeholder narrations (`{purpose}`, `{document_no}`, `{document_date}`, `{amount}`).
  - Live execution preview with 1-click posting or routing to the Action Queue.
- **Dedicated Account Ledger Viewer**:
  - Searchable account statement with custom date ranges, quick presets (*This Month*, *This FY*, *All Time*), historical opening balance forward, and chronological running balances with `Dr`/`Cr` indicators.
  - 1-Click drilldown from Trial Balance and Chart of Accounts.
  - Export to CSV & Print Statement.
- **Corporate Governance & Cap Table**:
  - Statutory company profile (CIN, GSTIN/VAT, base currency, dynamic decimal precision 0–4, FY start month).
  - Director & KMP register (DIN, appointments, active status).
  - Shareholding pattern & Ultimate Beneficial Owners (UBO) controlling interest declarations.
- **Financial Reporting Suite**:
  - Hierarchical Trial Balance (auto Dr = Cr verification, CSV, Print).
  - Balance Sheet with dynamic Current Period Retained Earnings integration.
  - Profit & Loss Statement with gross/net margins.
  - Multidimensional `#Tag` Sliced P&L / mini-financials.
  - Custom Pivot Matrix Report Designer.
- **Multi-Entity Management**:
  - Create new companies from scratch with standard COA initialization.
  - Instant 1-click entity switching in the header.

---

## Quick Start

### Prerequisites
- **Node.js**: v20+ or Node.js v24+

### Installation
```bash
# Clone the repository
git clone https://github.com/Utharam/Flowbook.git
cd Flowbook

# Install dependencies
npm install

# Run automated double-entry engine unit tests
npm test

# Start local development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Architecture Overview

```
flowbook/
├── app/
│   ├── layout.tsx                # Root layout with sidebar & header
│   ├── page.tsx                  # Executive Financial Dashboard
│   ├── accounts/                 # Hierarchical Chart of Accounts & Tree Rollups
│   ├── ledger/                   # Account Ledger Viewer & Running Balances
│   ├── vouchers/                 # Daybook & Interactive Voucher Runner
│   ├── templates/                # Multi-Step Flow Blueprints & Process Automation
│   ├── assets/                   # Fixed Asset Clusters & Performance
│   ├── queue/                    # Action Queue & Month-End Inactivity Scanner
│   ├── governance/               # Legal Profile, Directors & UBO Cap Table
│   ├── reports/
│   │   ├── trial-balance/        # Hierarchical Trial Balance
│   │   ├── balance-sheet/        # Balance Sheet (Assets = Liab + Eq)
│   │   ├── income-statement/     # Profit & Loss Statement
│   │   ├── tag-matrix/           # Sliced Tag (#) Financials
│   │   └── designer/             # Custom Pivot Report Designer
│   └── api/                      # REST API routes
├── components/
│   ├── context/                  # Multi-entity & currency formatting context
│   ├── layout/                   # Branded Sidebar & Header with Entity Switcher
│   ├── accounts/                 # On-The-Fly Hierarchical Creation Modal
│   └── templates/                # Flow Launcher Wizard & Preview
├── lib/
│   ├── db/                       # SQLite connection & seed data
│   └── engine/                   # Core double-entry, FX, and COA algorithms
└── package.json
```

---

## License
Proprietary & Confidential - Flowbook by Utharam
