import { PageHeader } from "@/components/dashboard/PageHeader";
import { UsersView } from "@/components/dashboard/UsersView";

export default function UsersPage() {
  return (
    <>
      <PageHeader title="Users" />
      <UsersView />
    </>
  );
}
