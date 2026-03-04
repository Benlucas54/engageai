import { PageHeader } from "@/components/dashboard/PageHeader";
import { CustomersView } from "@/components/dashboard/CustomersView";

export default function CustomersPage() {
  return (
    <>
      <PageHeader title="Customers" />
      <CustomersView />
    </>
  );
}
