### Expanded Architecture: The Complete Flowbook Model

```
+-----------------------------------------------------------------------------------------+
|                                    FLOWBOOK CORE                                        |
+-----------------------------------------------------------------------------------------+
                                             │
      ┌──────────────────────────────────────┼──────────────────────────────────────┐
      ▼                                      ▼                                      ▼
[Entity Governance]                 [Multi-Currency Core]                [Operational Layer]
• Legal Profile & Jurisdiction      • Base vs Transaction Currency       • Flow Templates (Fixed/Var)
• Directors, Shareholders, UBOs     • Realized/Unrealized FX Engine      • Non-Financial Attestations
• FY Alignment & Decimals           • Triangulated Balancing (∑ Base = 0)• Asset Events & Action Queue

```

---

### 1. Company Setup & Corporate Governance Profile

This module goes beyond typical SaaS profile screens by modeling legal entity ownership, director hierarchies, and compliance structure directly within the workspace.

```sql
-- Extended Companies Table
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    jurisdiction VARCHAR(100) NOT NULL,            -- e.g., 'India', 'UAE', 'Delaware (US)'
    registration_number VARCHAR(100) NOT NULL,     -- CIN / CR / EIN
    tax_identifier VARCHAR(100),                  -- GSTIN / TRN / VAT ID
    company_type VARCHAR(50) NOT NULL,             -- 'PVT_LTD', 'LLC', 'PARTNERSHIP', 'HOLDING'
    base_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    decimal_places SMALLINT NOT NULL DEFAULT 2 CHECK (decimal_places BETWEEN 0 AND 4),
    financial_year_start_month SMALLINT NOT NULL DEFAULT 4 CHECK (financial_year_start_month BETWEEN 1 AND 12), -- 4 = April (IN/UK), 1 = Jan (US/Global)
    lock_date DATE DEFAULT NULL,                   -- Closed books barrier
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Directors & Key Management Personnel (KMP)
CREATE TABLE company_officers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,                     -- 'DIRECTOR', 'MANAGING_DIRECTOR', 'CFO', 'COMPANY_SECRETARY'
    identification_number VARCHAR(100),            -- DIN / SSN / Passport No
    appointed_date DATE NOT NULL,
    resigned_date DATE,
    is_active BOOLEAN GENERATED ALWAYS AS (resigned_date IS NULL) STORED
);

-- Shareholding Pattern & Ultimate Beneficial Owners (UBO)
CREATE TABLE shareholding_structure (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    shareholder_name VARCHAR(255) NOT NULL,
    shareholder_type VARCHAR(30) NOT NULL,         -- 'INDIVIDUAL', 'CORPORATE_BODY', 'TRUST'
    share_class VARCHAR(50) DEFAULT 'EQUITY',      -- 'EQUITY', 'PREFERENCE', 'CLASS_A'
    number_of_shares NUMERIC(18, 4) NOT NULL,
    percentage_holding NUMERIC(5, 2) NOT NULL,     -- e.g., 51.00%
    is_ubo BOOLEAN NOT NULL DEFAULT FALSE,         -- Ultimate Beneficial Owner Flag
    ubo_controlling_interest_type VARCHAR(50),     -- 'VOTING_RIGHTS', 'DIRECT_EQUITY', 'EFFECTIVE_CONTROL'
    effective_from DATE NOT NULL,
    effective_to DATE
);

```

---

### 2. Multi-Currency Double-Entry Engine

To support foreign transactions (e.g., base currency `INR` or `USD`, billing a client in `EUR` or `AED`), every line item stores both the **Transaction Currency (with FX Rate)** and the normalized **Base Currency Amount**.

The zero-sum rule applies strictly to the base currency:


$$\sum \text{Base Amounts} = 0$$

```sql
-- Updated Journal Lines Table
CREATE TABLE journal_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id),
    
    -- Transaction (Foreign) Currency Details
    currency VARCHAR(3) NOT NULL,                  -- e.g., 'EUR'
    exchange_rate NUMERIC(18, 8) NOT NULL DEFAULT 1.00000000, -- Rate to Base (e.g., 1 EUR = 1.08 USD)
    foreign_amount NUMERIC(18, 4) NOT NULL,        -- Signed amount in Foreign Currency
    
    -- Base Currency Amount (The Real Ledger Engine Value)
    amount NUMERIC(18, 4) NOT NULL,                -- foreign_amount * exchange_rate (Signed: Dr = -, Cr = +)
    
    memo TEXT,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

```

#### Multi-Currency Posting Mechanics:

* **Realized FX Gain/Loss:** When clearing a foreign receivable (e.g., Invoiced $1,000 at FX `83.00` = `83,000`, Paid at FX `83.50` = `83,500`), the voucher runner automatically calculates the `500` balancing leg and assigns it to the system-defined **Realized FX Gain/Loss** account.
* **Display Layer:** The UI formats amounts according to the company's `decimal_places` setting (e.g., `2` for USD/EUR/INR, `3` for BHD/KWD).

---

### Complete Consolidated Feature Matrix

| Feature Domain | What We Have Defined & Planned |
| --- | --- |
| **Corporate Identity** | Legal profile, jurisdiction, FY definition, dynamic decimals, Director registers, and Shareholding/UBO equity tracking. |
| **Hierarchical COA** | Unlimited nesting with LTREE materialization, group account posting restrictions, and instant recursive sub-tree rollups. |
| **Single-Column Math** | Signed amounts (Assets/Expenses = `-`, Liab/Income = `+`) with $\sum = 0$ validation, presented as conventional Dr/Cr columns in the UI. |
| **Multi-Currency** | Foreign currency transaction tracking, dynamic FX rates, base currency normalization, and automated FX gain/loss balancing. |
| **Flow Templates** | Reusable transaction blueprints with fixed accounts, runtime variable selectors, and automated tag injection. |
| **Multidimensional Tags** | `#tag` indexing (e.g., `#1206`) across balance sheet and P&L lines for instant project/property mini-financials. |
| **Non-Financial Entries** | Zero-value audit attestations for dormant periods, permanently logging operational verifications to eliminate audit ambiguities. |
| **Asset Events & Linked Accounts** | Contract lifecycle tracking (rent, revaluations) with cluster views linking primary assets to operational accounts. |
| **Action Queue & Inactivity Scrutiny** | Month-end scanner that detects missing recurring bills, triggers alert notifications, and manages approval workflows. |
| **Intercompany Mirroring** | One-sided cross-company notifications that dispatch mirror entry drafts to linked subsidiaries without hazardous automatic cross-posting. |
| **Audit & Reversals** | Immutability enforcement on posted transactions via 1-click mirror reversals and locked-period barriers. |
| **Custom Report Designer** | Searchable drag-and-drop pivot matrix for slicing accounts by tags, dates, and hierarchies into custom Excel/PDF exports. |