import { Company } from '../db/schema';
import { CreateJournalLineInput } from './accounting';

export interface CurrencyRatePair {
  currency: string;
  rateToBase: number; // 1 Foreign = rateToBase Base Currency
}

export const DEFAULT_BENCHMARK_RATES: Record<string, Record<string, number>> = {
  USD: {
    USD: 1.0,
    EUR: 1.085,
    GBP: 1.285,
    INR: 0.0118, // 1 INR = 0.0118 USD (~84.7 INR/USD)
    AED: 0.2723, // 1 AED = 0.2723 USD (~3.67 AED/USD)
    SGD: 0.745,
    JPY: 0.0066,
    CAD: 0.735
  },
  AED: {
    AED: 1.0,
    USD: 3.6725,
    EUR: 3.985,
    GBP: 4.72,
    INR: 0.0433
  },
  INR: {
    INR: 1.0,
    USD: 85.2,
    EUR: 92.4,
    GBP: 109.5,
    AED: 23.2
  }
};

/**
 * Gets default exchange rate to company base currency.
 */
export function getExchangeRate(baseCurrency: string, foreignCurrency: string): number {
  if (baseCurrency === foreignCurrency) return 1.0;
  
  const baseTable = DEFAULT_BENCHMARK_RATES[baseCurrency];
  if (baseTable && baseTable[foreignCurrency]) {
    return baseTable[foreignCurrency];
  }

  // Inverse check
  const foreignTable = DEFAULT_BENCHMARK_RATES[foreignCurrency];
  if (foreignTable && foreignTable[baseCurrency]) {
    return 1.0 / foreignTable[baseCurrency];
  }

  return 1.0;
}

export interface FxSettlementInput {
  company: Company;
  settlementCurrency: string;
  originalExchangeRate: number;
  settlementExchangeRate: number;
  foreignAmount: number; // e.g. 1000 EUR
  receivableOrPayableAccountId: string;
  bankAccountId: string;
  fxGainLossAccountId: string;
  tags?: string[];
  memo?: string;
}

/**
 * Generates the balanced multi-currency settlement lines with automated Realized FX Gain/Loss.
 */
export function generateFxSettlementLines(input: FxSettlementInput): CreateJournalLineInput[] {
  const {
    company,
    settlementCurrency,
    originalExchangeRate,
    settlementExchangeRate,
    foreignAmount,
    receivableOrPayableAccountId,
    bankAccountId,
    fxGainLossAccountId,
    tags = [],
    memo = 'Settlement of foreign currency item'
  } = input;

  const originalBaseAmount = foreignAmount * originalExchangeRate;
  const settlementBaseAmount = foreignAmount * settlementExchangeRate;
  const fxVariance = settlementBaseAmount - originalBaseAmount;

  const lines: CreateJournalLineInput[] = [];

  // Line 1: Bank Leg (Inflow or Outflow at settlement exchange rate)
  // If positive foreignAmount (e.g. customer payment received): Debit Bank (negative in signed math)
  lines.push({
    accountId: bankAccountId,
    currency: settlementCurrency,
    exchangeRate: settlementExchangeRate,
    foreignAmount: -foreignAmount,
    signedAmount: -settlementBaseAmount,
    memo: `${memo} - Cash Movement (${foreignAmount} ${settlementCurrency} @ ${settlementExchangeRate})`,
    tags
  });

  // Line 2: Clearing AR / AP Leg (at original exchange rate)
  lines.push({
    accountId: receivableOrPayableAccountId,
    currency: settlementCurrency,
    exchangeRate: originalExchangeRate,
    foreignAmount: foreignAmount,
    signedAmount: originalBaseAmount,
    memo: `${memo} - Clearing Invoice Balance (${foreignAmount} ${settlementCurrency} @ ${originalExchangeRate})`,
    tags
  });

  // Line 3: Realized FX Gain/Loss Balancing Leg
  if (Math.abs(fxVariance) > 0.0001) {
    lines.push({
      accountId: fxGainLossAccountId,
      currency: company.base_currency,
      exchangeRate: 1.0,
      foreignAmount: fxVariance,
      signedAmount: fxVariance,
      memo: `Automated Realized FX ${fxVariance >= 0 ? 'Gain' : 'Loss'} Balancing Leg`,
      tags: [...tags, '#FX-GainLoss']
    });
  }

  return lines;
}
