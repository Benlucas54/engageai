import { PageHeader } from "@/components/dashboard/PageHeader";
import { FlaggedView } from "@/components/dashboard/FlaggedView";

export default function FlaggedPage() {
  return (
    <>
      <PageHeader title="Flagged" />
      <FlaggedView />
    </>
  );
}
