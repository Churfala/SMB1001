import React, { createContext, useContext, useState, useEffect } from 'react';
import { tenantApi } from '../services/api';
import { useAuth } from './AuthContext';
import type { Tenant } from '../types';

interface TenantContextValue {
  tenants: Tenant[];
  currentTenant: Tenant | null;
  setCurrentTenant: (tenant: Tenant) => void;
  isLoading: boolean;
  reload: () => void;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenant, setCurrentTenantState] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // Both admin and non-admin call the same endpoint.
      // Admin: server returns all tenants.
      // Non-admin: server returns home tenant + explicitly granted tenants.
      const data = await tenantApi.list();
      const accessible: Tenant[] = data.tenants ?? [];
      setTenants(accessible);
      const saved = localStorage.getItem('currentTenantId');
      const found = accessible.find((t: Tenant) => t.id === saved) ?? accessible[0] ?? null;
      if (found && !currentTenant) setCurrentTenantState(found);
    } catch (err) {
      console.error('Failed to load tenants:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [user?.id]);

  const setCurrentTenant = (tenant: Tenant) => {
    setCurrentTenantState(tenant);
    localStorage.setItem('currentTenantId', tenant.id);
  };

  return (
    <TenantContext.Provider value={{ tenants, currentTenant, setCurrentTenant, isLoading, reload: load }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
}
