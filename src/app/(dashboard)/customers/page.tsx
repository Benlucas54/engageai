"use client";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { CustomersView } from "@/components/dashboard/CustomersView";
import { FeatureGate } from "@/components/dashboard/FeatureGate";

export default function CustomersPage() {
  return (
    <>
      <PageHeader title="Customers" />
      <FeatureGate
        feature="crm"
        featureLabel="CRM"
        description="Track customers through your pipeline with conversation history. Available on Pro and above."
      >
        <CustomersView />
      </FeatureGate>
    </>
  );
}
