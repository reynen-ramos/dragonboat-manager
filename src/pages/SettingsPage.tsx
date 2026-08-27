import { Download, Sparkles, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog';
import { NumberField } from '@/components/ui/NumberField';
import { Card, LoadFailed, PageHeader, Spinner } from '@/components/ui/misc';
import type { BoatSize, Snapshot } from '@/domain/types';
import {
  UnreadableSnapshotError,
  exportSnapshot,
  useClearAllData,
  useImportSnapshot,
  useLoadDemoClub,
  useSaveSettings,
  useSettings,
  useSettingsQuery,
} from '@/queries/hooks';
import { downloadTextFile } from '@/utils/download';

/** A fraction stored as 0.03 is shown as 3, without a float tail. */
const asPercent = (fraction: number) => Math.round(fraction * 1000) / 10;

export function SettingsPage() {
  const settingsQuery = useSettingsQuery();
  const settings = useSettings();
  const saveSettings = useSaveSettings();
  const loadDemo = useLoadDemoClub();
  const clearAll = useClearAllData();
  const importSnapshot = useImportSnapshot();
  const fileInput = useRef<HTMLInputElement>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [importError, setImportError] = useState<string>();

  const setMinWomen = (boatSize: BoatSize, value: number) =>
    saveSettings.mutate({
      ...settings,
      minWomenMixed: { ...settings.minWomenMixed, [boatSize]: value },
    });

  const setTolerance = (key: 'sideBalanceTolerance' | 'bowSternBalanceTolerance', percent: number) =>
    saveSettings.mutate({ ...settings, [key]: percent / 100 });

  const readSnapshot = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Snapshot;
      if (!Array.isArray(parsed.members)) throw new Error('missing members');
      await importSnapshot.mutateAsync(parsed);
      setImportError(undefined);
    } catch (error) {
      // A refusal carries a sentence worth reading — "made by a newer
      // version", "damaged rows" — that the generic line would bury.
      setImportError(
        error instanceof UnreadableSnapshotError
          ? error.message
          : 'That file is not a Dragonboat Manager backup.',
      );
    }
  };

  // Without this, a keystroke landing before the query resolves would save the
  // defaults `useSettings` substitutes, over whatever the club had stored.
  if (settingsQuery.isPending) return <Spinner />;
  if (settingsQuery.isError) return <LoadFailed onRetry={() => void settingsQuery.refetch()} />;

  return (
    <>
      <PageHeader title="Settings" description="Rules and thresholds used across the app." />

      <div className="flex flex-col gap-4">
        <Card className="p-5">
          <h2 className="font-semibold">Crew rules</h2>
          <p className="mt-1 text-sm text-muted">
            Minimum women in a mixed crew. Governing bodies differ, so set what your regatta uses.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {([10, 20] as BoatSize[]).map((boatSize) => (
              <NumberField
                key={boatSize}
                label={`Mixed ${boatSize}s — minimum women`}
                value={settings.minWomenMixed[boatSize]}
                min={0}
                max={boatSize}
                onCommit={(value) => setMinWomen(boatSize, value)}
              />
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold">Balance tolerances</h2>
          <p className="mt-1 text-sm text-muted">
            How far the weight can differ before the balance bars warn, as a percentage of total
            crew weight.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <NumberField
              label="Left / right"
              hint="Default 3%"
              value={asPercent(settings.sideBalanceTolerance)}
              min={0}
              max={25}
              step={0.5}
              onCommit={(value) => setTolerance('sideBalanceTolerance', value)}
            />
            <NumberField
              label="Bow / stern"
              hint="Default 5%"
              value={asPercent(settings.bowSternBalanceTolerance)}
              min={0}
              max={25}
              step={0.5}
              onCommit={(value) => setTolerance('bowSternBalanceTolerance', value)}
            />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold">Your data</h2>
          <p className="mt-1 text-sm text-muted">
            Everything is stored in this browser only. Export regularly — clearing your browser data
            deletes it.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={async () =>
                downloadTextFile(
                  `dragonboat-backup-${new Date().toISOString().slice(0, 10)}.json`,
                  JSON.stringify(await exportSnapshot(), null, 2),
                  'application/json',
                )
              }
            >
              <Download /> Export backup
            </Button>
            <Button onClick={() => fileInput.current?.click()}>
              <Upload /> Restore backup
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void readSnapshot(file);
                e.target.value = '';
              }}
            />
            <Button onClick={() => loadDemo.mutate(undefined)} disabled={loadDemo.isPending}>
              <Sparkles /> Load demo club
            </Button>
            <Button variant="danger" onClick={() => setConfirmingClear(true)}>
              <Trash2 /> Clear everything
            </Button>
          </div>
          {importError && <p className="mt-3 text-sm text-red-600">{importError}</p>}
        </Card>
      </div>

      <Dialog open={confirmingClear} onOpenChange={setConfirmingClear}>
        <DialogContent
          title="Clear all data?"
          description="Every member, event, and lineup will be deleted from this browser."
          footer={
            <>
              <DialogClose asChild>
                <Button>Cancel</Button>
              </DialogClose>
              <Button
                variant="danger"
                onClick={async () => {
                  await clearAll.mutateAsync(undefined);
                  setConfirmingClear(false);
                }}
              >
                Delete everything
              </Button>
            </>
          }
        >
          <p className="text-sm text-muted">
            Export a backup first if there is any chance you will want this back.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
