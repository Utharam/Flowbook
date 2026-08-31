'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Company } from '@/lib/db/schema';

interface CompanyContextType {
  companies: Company[];
  activeCompany: Company | null;
  activeCompanyId: string;
  setActiveCompanyId: (id: string) => void;
  isLoading: boolean;
  refreshCompanies: () => Promise<void>;
  formatAmount: (amount: number, currency?: string) => string;
  formatSignedAmount: (amount: number, currency?: string) => { text: string; isDr: boolean; isCr: boolean };
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string>('cmp_utharam_global');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCompanies = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/companies');
      const data = await res.json();
      if (data.success && data.companies) {
        setCompanies(data.companies);
        if (!data.companies.some((c: Company) => c.id === activeCompanyId) && data.companies.length > 0) {
          setActiveCompanyId(data.companies[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load companies:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const activeCompany = companies.find(c => c.id === activeCompanyId) || companies[0] || null;

  const formatAmount = (amount: number, currency?: string): string => {
    const decimals = activeCompany?.decimal_places ?? 2;
    const curr = currency || activeCompany?.base_currency || 'USD';
    const formattedNum = Math.abs(amount).toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
    return `${curr} ${formattedNum}`;
  };

  const formatSignedAmount = (amount: number, currency?: string) => {
    const isDr = amount < 0;
    const isCr = amount > 0;
    const formatted = formatAmount(amount, currency);
    return {
      text: isDr ? `${formatted} Dr` : isCr ? `${formatted} Cr` : `${formatted} -`,
      isDr,
      isCr
    };
  };

  return (
    <CompanyContext.Provider
      value={{
        companies,
        activeCompany,
        activeCompanyId,
        setActiveCompanyId,
        isLoading,
        refreshCompanies: fetchCompanies,
        formatAmount,
        formatSignedAmount
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
