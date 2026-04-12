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
      if (user.role === 'admin') {
        const data = await tenantApi.list();
        setTenants(data.tenants ?? []);
        const saved = localStorage.getItem('currentTenantId');
        const found = data.tenants?.find((t: Tenant) => t.id === saved) ?? data.tenants?.[0] ?? null;
        if (found && !currentTenant) setCurrentTenantState(found);
      } else {
        // Non-admin users only see their own tenant
        const tenant = await tenantApi.getOne(user.tenantId);
        setTenants([tenant]);
        setCurrentTenantState(tenant);
      }
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
