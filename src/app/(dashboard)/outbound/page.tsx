"use client";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { OutboundView } from "@/components/dashboard/OutboundView";

export default function OutboundPage() {
  return (
    <>
      <PageHeader title="Outbound" />
      <OutboundView />
    </>
  );
}
