import { Upload } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog';
import { Badge } from '@/components/ui/misc';
import { useImportMembers } from '@/queries/hooks';
import { parseMembersCsv, type CsvImportResult } from '@/utils/csv';
import { formatWeight, pluralise, SIDE_PREFERENCE_LABEL } from '@/utils/format';

/**
 * CSV import with a dry run.
 *
 * Nothing is written until the parsed result has been shown, because a bad
 * import into a roster is tedious to unpick by hand.
 */
export function CsvImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [preview, setPreview] = useState<CsvImportResult>();
  const [filename, setFilename] = useState<string>();
  const importMembers = useImportMembers();

  const readFile = async (file: File) => {
    setFilename(file.name);
    setPreview(parseMembersCsv(await file.text()));
  };

  const confirm = async () => {
    if (!preview?.members.length) return;
    await importMembers.mutateAsync(preview.members);
    setPreview(undefined);
    setFilename(undefined);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setPreview(undefined);
          setFilename(undefined);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        title="Import members from CSV"
        description="Nothing is saved until you confirm."
        className="w-[min(44rem,calc(100vw-2rem))]"
        footer={
          <>
            <DialogClose asChild>
              <Button>Cancel</Button>
            </DialogClose>
            <Button
              variant="primary"
              onClick={confirm}
              disabled={!preview?.members.length || importMembers.isPending}
            >
              {importMembers.isPending
                ? 'Importing…'
                : `Import ${pluralise(preview?.members.length ?? 0, 'member')}`}
            </Button>
          </>
        }
      >
        {!preview ? (
          <div className="flex flex-col gap-4">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-subtle px-6 py-10 text-center hover:surface-sunken">
              <Upload className="size-6 text-muted" />
              <span className="font-medium">Choose a CSV file</span>
              <span className="text-sm text-muted">
                A header row is required. Column names are matched loosely.
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void readFile(file);
                }}
              />
            </label>

            <div className="text-sm text-muted">
              <p className="mb-1 font-medium text-[var(--text-strong)]">Recognised columns</p>
              <p>
                First name, Last name, Gender, Date of birth, Weight, Side, Drummer, Cox, Status,
                Email, Phone, Emergency contact, Emergency phone, Notes.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{filename}</span>
              <Badge tone={preview.members.length ? 'good' : 'bad'}>
                {pluralise(preview.members.length, 'member')} ready
              </Badge>
              {preview.errors.length > 0 && (
                <Badge tone="warn">{pluralise(preview.errors.length, 'row')} skipped</Badge>
              )}
            </div>

            {preview.unmatchedHeaders.length > 0 && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                Ignored {preview.unmatchedHeaders.length === 1 ? 'column' : 'columns'}:{' '}
                {preview.unmatchedHeaders.join(', ')}
              </p>
            )}

            {preview.errors.length > 0 && (
              <ul className="rounded-lg surface-sunken px-3 py-2 text-sm text-muted">
                {preview.errors.slice(0, 5).map((error) => (
                  <li key={error.row}>
                    Row {error.row}: {error.message}
                  </li>
                ))}
                {preview.errors.length > 5 && <li>…and {preview.errors.length - 5} more</li>}
              </ul>
            )}

            <div className="overflow-x-auto rounded-lg border border-subtle">
              <table className="w-full text-sm">
                <thead className="surface-sunken text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Gender</th>
                    <th className="px-3 py-2 font-medium">Weight</th>
                    <th className="px-3 py-2 font-medium">Side</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.members.slice(0, 10).map((member, i) => (
                    <tr key={i} className="border-t border-subtle">
                      <td className="px-3 py-2">
                        {member.firstName} {member.lastName}
                      </td>
                      <td className="px-3 py-2 capitalize">{member.gender}</td>
                      <td className="tabular px-3 py-2">{formatWeight(member.weightKg)}</td>
                      <td className="px-3 py-2">
                        {SIDE_PREFERENCE_LABEL[member.sidePreference]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {preview.members.length > 10 && (
              <p className="text-sm text-muted">
                Showing the first 10 of {preview.members.length}.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
