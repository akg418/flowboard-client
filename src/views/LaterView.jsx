import QuickAdd from '../components/QuickAdd';
import TreeList from '../components/TreeList';
import PageHeader, { Empty } from '../components/PageHeader';
import { useStore } from '../lib/store';

const isLater = (it) => it.someday;

export default function LaterView() {
  const loaded = useStore((s) => s.loaded);
  return (
    <>
      <PageHeader title="Later" subtitle="Ideas and things you'll get to someday — no date, no pressure." />
      <QuickAdd defaults={{ someday: true }} placeholder="Something for later… (no date needed)" />
      <TreeList
        rootFilter={isLater}
        empty={loaded && <Empty icon="🪴" title="Nothing parked" text="Write “بعدين” or “!later” in any task, or press Later in its details." />}
      />
    </>
  );
}
