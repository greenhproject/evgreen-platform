/**
 * TenantBillingTab - Módulo centralizado de facturación electrónica para un tenant específico
 * Utilizado por SuperAdmin dentro del panel lateral de organizaciones (Organizations.tsx)
 */

import ElectronicBillingConfigCard from "@/components/billing/ElectronicBillingConfigCard";
import ElectronicInvoicesHistory from "@/components/billing/ElectronicInvoicesHistory";

interface Props {
  org: any;
}

export default function TenantBillingTab({ org }: Props) {
  if (!org?.id) return null;

  return (
    <div className="space-y-6">
      <ElectronicBillingConfigCard mode="admin" organizationId={org.id} />
      <ElectronicInvoicesHistory mode="admin" organizationId={org.id} />
    </div>
  );
}
