import { PageHeader } from "@/components/dashboard/PageHeader";
import { FlaggedView } from "@/components/dashboard/FlaggedView";

export default function InboxPage() {
  return (
    <>
      <PageHeader title="Inbox" />
      <FlaggedView />
    </>
  );
}
