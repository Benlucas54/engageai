import { PageHeader } from "@/components/dashboard/PageHeader";
import { OverviewView } from "@/components/dashboard/OverviewView";

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Overview" />
      <OverviewView />
    </>
  );
}
