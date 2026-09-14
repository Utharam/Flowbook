/**
 * FLOWBOOK BY UTHARAM
 * Enterprise-Grade Accounting & Multi-Currency Engine Database Schema
 */

export type CompanyType = 'PVT_LTD' | 'LLC' | 'HOLDING' | 'PARTNERSHIP' | 'PUBLIC_LTD';
export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type OfficerRole = 'DIRECTOR' | 'MANAGING_DIRECTOR' | 'CFO' | 'COMPANY_SECRETARY' | 'CEO';
export type ShareholderType = 'INDIVIDUAL' | 'CORPORATE_BODY' | 'TRUST' | 'INSTITUTIONAL';
export type UboInterestType = 'VOTING_RIGHTS' | 'DIRECT_EQUITY' | 'EFFECTIVE_CONTROL';
export type EntryStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'POSTED' | 'REVERSED';
export type QueueStatus = 'PENDING' | 'APPROVED' | 'DISMISSED' | 'PROCESSED';
export type ActionQueueType = 'MISSING_RECURRING_BILL' | 'ATTESTATION_DUE' | 'INTERCOMPANY_MIRROR_DRAFT' | 'FLOW_TEMPLATE_BATCH' | 'ANOMALY_DETECTED';

export type AuditEventType = 
  | 'COMPANY_CREATED' 
  | 'PROFILE_ALTERED' 
  | 'BOOKS_LOCKED' 
  | 'VOUCHER_POSTED' 
  | 'VOUCHER_REVERSED' 
  | 'FLOW_BATCH_EXECUTED' 
  | 'BACKUP_GENERATED' 
  | 'BACKUP_RESTORED'
  | 'OFFICER_ALTERED'
  | 'CAP_TABLE_ALTERED'
  | 'LEDGER_GOVERNANCE_UPDATED'
  | 'BANK_STATEMENT_BATCH_IMPORTED'
  | 'BANK_RECONCILIATION_FINALIZED';

export interface Company {
  id: string;
  legal_name: string;
  trade_name?: string;
  jurisdiction: string;
  registration_number: string;
  tax_identifier?: string;
  registered_address?: string;
  company_type: CompanyType;
  base_currency: string;
  decimal_places: number;
  financial_year_start_month: number; // 1 = Jan, 4 = Apr
  lock_date?: string; // YYYY-MM-DD
  created_at: string;
}

export interface CompanyOfficer {
  id: string;
  company_id: string;
  full_name: string;
  role: OfficerRole;
  identification_number?: string;
  appointed_date: string;
  resigned_date?: string;
  is_active: number;
  created_at: string;
}

export interface ShareholdingStructure {
  id: string;
  company_id: string;
  shareholder_name: string;
  shareholder_type: ShareholderType;
  share_class: string;
  number_of_shares: number;
  percentage_holding: number;
  is_ubo: number;
  ubo_controlling_interest_type?: UboInterestType;
  effective_from: string;
  created_at: string;
}

export interface SopStep {
  step_number: number;
  title: string;
  instruction: string;
}

export interface TriggerRules {
  min_monthly_transactions?: number;
  max_single_transaction_limit?: number;
  alert_on_unusual_variance?: boolean;
}

export interface Account {
  id: string;
  company_id: string;
  code: string;
  name: string;
  type: AccountType;
  parent_id?: string | null;
  path: string; // e.g. "1000.1100.1110"
  is_group: number; // 1 = Group/Folder, 0 = Posting Account
  currency?: string;
  description?: string;
  tags?: string[];
  sop_steps?: SopStep[];
  trigger_rules?: TriggerRules;
  last_reconciled_date?: string; // YYYY-MM-DD
  last_reconciled_balance?: number;
  is_active: number;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  company_id: string;
  entry_number: string; // e.g. "JV-2026-0001"
  entry_date: string; // YYYY-MM-DD
  memo?: string;
  reference?: string;
  is_reversal: number;
  reversed_from_id?: string;
  is_non_financial: number;
  status: EntryStatus;
  created_by: string;
  approved_by?: string;
  created_at: string;
}

export interface JournalLine {
  id: string;
  entry_id: string;
  account_id: string;
  currency: string;
  exchange_rate: number;
  foreign_amount: number;
  amount: number; // Single-column signed amount in base currency: Debit = -, Credit = +
  memo?: string;
  tags: string; // JSON array of strings e.g. '["#1206", "#HQ"]'
  bank_cleared_date?: string; // YYYY-MM-DD
  is_bank_cleared?: number; // 1 = Cleared in bank, 0 = Pending/Unpresented
  created_at: string;
}

// Multi-Step Flow Template Definitions
export interface FlowTemplateVariable {
  key: string; // e.g. 'customer_account'
  label: string; // e.g. 'Customer / Debtor Account'
  account_type?: AccountType;
  default_account_id?: string;
}

export interface FlowTemplateStepLine {
  direction: 'DEBIT' | 'CREDIT';
  account_mode: 'CONSTANT' | 'VARIABLE';
  account_id?: string; // If CONSTANT
  variable_key?: string; // If VARIABLE
  memo_template?: string; // e.g. "Receivable for {document_no}"
  default_tags?: string[];
}

export interface FlowTemplateStep {
  id: string;
  step_number: number;
  title: string; // e.g. "Sales & Receivable Entry"
  narration_template: string; // e.g. "Being amount receivable towards the sale of {purpose} vide invoice no {document_no} dated {document_date}"
  reference_template?: string; // e.g. "{document_no}"
  lines: FlowTemplateStepLine[];
}

export interface FlowTemplate {
  id: string;
  company_id: string;
  name: string;
  category: string;
  description?: string;
  default_tags?: string[];
  variables: FlowTemplateVariable[];
  steps: FlowTemplateStep[];
  created_at: string;
}

export interface Asset {
  id: string;
  company_id: string;
  name: string;
  asset_code?: string;
  category?: string;
  tag?: string; // e.g. "#1206"
  cost_account_id?: string;
  accumulated_dep_account_id?: string;
  depreciation_expense_account_id?: string;
  income_account_id?: string;
  maintenance_account_id?: string;
  acquisition_date?: string;
  purchase_cost?: number;
  currency?: string;
  status: 'ACTIVE' | 'DISPOSED' | 'UNDER_MAINTENANCE';
  created_at: string;
}

export interface ActionQueueItem {
  id: string;
  company_id: string;
  type: ActionQueueType;
  title: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  status: QueueStatus;
  metadata?: string; // JSON metadata
  created_at: string;
}

export interface IntercompanyLink {
  id: string;
  source_company_id: string;
  source_account_id: string;
  target_company_id: string;
  target_account_id: string;
  mirror_direction_inverse: number; // 1 = invert debit/credit on target
  created_at: string;
}

export interface AuditEvent {
  id: string;
  company_id: string;
  event_type: AuditEventType;
  actor: string;
  description: string;
  metadata?: string;
  created_at: string;
}
