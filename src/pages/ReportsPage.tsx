import { Download, Printer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Badge, Card, EmptyState, LoadFailed, PageHeader, Spinner } from '@/components/ui/misc';
import { RadioCards } from '@/components/ui/RadioCards';
import { formatDate, formatRaceTime, todayIso } from '@/domain/dates';
import {
  buildAttendanceReport,
  buildBenchReport,
  buildCompositionReport,
  buildResultsReport,
  type AttendanceReport,
  type BenchReport,
  type CompositionBucket,
  type CompositionReport,
  type DateRange,
  type ResultsReport,
} from '@/domain/reports';
import { formatDelta } from '@/domain/results';
import type { MemberStatus } from '@/domain/types';
import { useReportsData } from '@/queries/derived';
import { rowsToCsv } from '@/utils/csv';
import { downloadTextFile } from '@/utils/download';
import { categoryName, fullName, ordinal, pluralise } from '@/utils/format';

/**
 * The club's data read back across events: who shows up, how the season
 * raced, what the roster is made of, and who keeps being left on the dock.
 *
 * Every report is one screen, printable as-is (the toolbar is `no-print`;
 * the app chrome already opts out), and downloadable as CSV through
 * `rowsToCsv` so exports carry the same quoting and formula guard as the
 * roster export.
 */

const REPORTS = [
  { value: 'attendance', label: 'Attendance' },
  { value: 'results', label: 'Results' },
  { value: 'composition', label: 'Composition' },
  { value: 'bench', label: 'Bench' },
] as const;

type ReportKind = (typeof REPORTS)[number]['value'];

const PRESETS = [
  { value: 'season', label: 'This season' },
  { value: 'last90', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom range' },
] as const;

type Preset = (typeof PRESETS)[number]['value'];

const shiftDays = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export function ReportsPage() {
  const data = useReportsData();
  const [searchParams, setSearchParams] = useSearchParams();
  const today = todayIso();

  const requested = searchParams.get('report');
  const report: ReportKind = REPORTS.some((r) => r.value === requested)
    ? (requested as ReportKind)
    : 'attendance';

  const [preset, setPreset] = useState<Preset>('season');
  const [customFrom, setCustomFrom] = useState(`${today.slice(0, 4)}-01-01`);
  const [customTo, setCustomTo] = useState(today);
  const [status, setStatus] = useState<MemberStatus | 'all'>('active');

  const range: DateRange =
    preset === 'season'
      ? { from: `${today.slice(0, 4)}-01-01`, to: today }
      : preset === 'last90'
        ? { from: shiftDays(today, -90), to: today }
        : preset === 'all'
          ? { from: '0000-01-01', to: today }
          : { from: customFrom, to: customTo || today };

  const members = useMemo(
    () =>
      data.collections.members.filter((m) => (status === 'all' ? true : m.status === status)),
    [data.collections.members, status],
  );

  // Only the active report is built; a switch keeps the memo honest.
  const active = useMemo(() => {
    const shared = { ...data.collections, range, today };
    switch (report) {
      case 'attendance': {
        const built = buildAttendanceReport({ ...shared, members });
        return { kind: 'attendance' as const, built, ...attendanceCsv(built, range) };
      }
      case 'results': {
        const built = buildResultsReport(shared);
        return { kind: 'results' as const, built, ...resultsCsv(built, range) };
      }
      case 'composition': {
        const built = buildCompositionReport({ today, members });
        return { kind: 'composition' as const, built, ...compositionCsv(built, today) };
      }
      case 'bench': {
        const built = buildBenchReport(shared);
        return { kind: 'bench' as const, built, ...benchCsv(built, range) };
      }
    }
  }, [report, data.collections, members, range.from, range.to, today]); // eslint-disable-line react-hooks/exhaustive-deps -- range is rebuilt each render; its two strings are the real inputs

  if (data.isLoading) return <Spinner />;
  if (data.isError) return <LoadFailed onRetry={data.refetch} />;

  const usesRange = report !== 'composition';
  const usesStatus = report === 'attendance' || report === 'composition';
  const reportLabel = REPORTS.find((r) => r.value === report)!.label;
  const rangeLabel = usesRange
    ? preset === 'all'
      ? 'All time'
      : `${formatDate(range.from)} – ${formatDate(range.to)}`
    : formatDate(today);

  return (
    <>
      <PageHeader title="Reports" />

      <div className="no-print mb-4 flex flex-col gap-3">
        <RadioCards<ReportKind>
          label="Report"
          className="flex w-fit flex-wrap gap-1 rounded-lg surface-sunken p-1"
          optionClassName="rounded-md px-3 py-1.5 text-sm font-medium text-muted transition-colors"
          value={report}
          onChange={(next) => setSearchParams({ report: next }, { replace: true })}
          options={REPORTS.map((r) => ({
            value: r.value,
            label: r.label,
            selectedClassName: 'surface text-[inherit] shadow-sm',
          }))}
          renderOption={(option) => option.label}
        />

        <div className="flex flex-wrap items-center gap-2">
          {usesRange && (
            <>
              <Select
                className="w-auto"
                value={preset}
                onChange={(e) => setPreset(e.target.value as Preset)}
                aria-label="Date range"
              >
                {PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
              {preset === 'custom' && (
                <>
                  <Input
                    type="date"
                    className="w-auto"
                    aria-label="From date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                  />
                  <Input
                    type="date"
                    className="w-auto"
                    aria-label="To date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                  />
                </>
              )}
            </>
          )}
          {usesStatus && (
            <Select
              className="w-auto"
              value={status}
              onChange={(e) => setStatus(e.target.value as MemberStatus | 'all')}
              aria-label="Filter by status"
            >
              <option value="active">Active members</option>
              <option value="inactive">Inactive members</option>
              <option value="alumni">Alumni</option>
              <option value="all">Everyone</option>
            </Select>
          )}
          <Button size="sm" onClick={() => window.print()}>
            <Printer /> Print
          </Button>
          <Button size="sm" onClick={() => downloadTextFile(active.filename, active.csv)}>
            <Download /> Download CSV
          </Button>
        </div>
      </div>

      <p className="hidden text-sm text-muted print:block">
        {reportLabel} · {rangeLabel} · Generated {formatDate(today)}
      </p>

      {active.kind === 'attendance' && <AttendanceView report={active.built} />}
      {active.kind === 'results' && <ResultsView report={active.built} />}
      {active.kind === 'composition' && <CompositionView report={active.built} />}
      {active.kind === 'bench' && <BenchView report={active.built} />}
    </>
  );
}

// --- Attendance --------------------------------------------------------------

function attendanceCsv(report: AttendanceReport, range: DateRange) {
  return {
    filename: `attendance-${range.from}-to-${range.to}.csv`,
    csv: rowsToCsv(
      [
        'Member',
        'Status',
        'Trainings in',
        'Trainings maybe',
        'Trainings out',
        'Trainings unanswered',
        'Trainings seated',
        'Races in',
        'Races maybe',
        'Races out',
        'Races unanswered',
        'Races seated',
      ],
      report.rows.map((row) => [
        fullName(row.member),
        row.member.status,
        row.trainings.saidIn,
        row.trainings.saidMaybe,
        row.trainings.saidOut,
        row.trainings.unanswered,
        row.trainings.seated,
        row.races.saidIn,
        row.races.saidMaybe,
        row.races.saidOut,
        row.races.unanswered,
        row.races.seated,
      ]),
    ),
  };
}

const NUM_CELL = 'tabular px-2 py-1.5 text-right';

function AttendanceView({ report }: { report: AttendanceReport }) {
  if (report.trainingCount + report.raceCount === 0) {
    return <EmptyState title="No trainings or races in this range." />;
  }

  const countCells = (counts: AttendanceReport['rows'][number]['trainings']) => (
    <>
      <td className={NUM_CELL}>{counts.saidIn}</td>
      <td className={NUM_CELL}>{counts.saidMaybe}</td>
      <td className={NUM_CELL}>{counts.saidOut}</td>
      <td className={`${NUM_CELL} text-muted`}>{counts.unanswered}</td>
      <td className={`${NUM_CELL} font-medium`}>{counts.seated}</td>
    </>
  );

  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="text-xs uppercase tracking-wide text-muted">
          <tr className="border-b border-subtle">
            <th />
            <th colSpan={5} className="px-2 py-1.5 text-center font-semibold">
              {pluralise(report.trainingCount, 'training')}
            </th>
            <th colSpan={5} className="px-2 py-1.5 text-center font-semibold">
              {pluralise(report.raceCount, 'race')}
            </th>
          </tr>
          <tr className="border-b border-subtle">
            <th className="px-3 py-1.5 text-left font-semibold">Member</th>
            {['In', 'Maybe', 'Out', '—', 'Seated', 'In', 'Maybe', 'Out', '—', 'Seated'].map(
              (label, i) => (
                <th key={i} className="px-2 py-1.5 text-right font-semibold">
                  {label}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {report.rows.map((row) => (
            <tr key={row.member.id}>
              <td className="max-w-48 truncate px-3 py-1.5 font-medium">{fullName(row.member)}</td>
              {countCells(row.trainings)}
              {countCells(row.races)}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// --- Results -----------------------------------------------------------------

function resultsCsv(report: ResultsReport, range: DateRange) {
  const rows: unknown[][] = [];
  for (const block of report.events) {
    for (const categoryBlock of block.categories) {
      for (const group of categoryBlock.groups) {
        for (const row of group.rows) {
          rows.push([
            block.event.name,
            block.event.startDate,
            categoryName(categoryBlock.category),
            group.label,
            row.crew.name,
            row.lane ?? '',
            row.placement ?? '',
            row.timeMs != null ? formatRaceTime(row.timeMs) : '',
            formatDelta(row.deltaMs),
          ]);
        }
      }
    }
  }
  return {
    filename: `results-${range.from}-to-${range.to}.csv`,
    csv: rowsToCsv(
      ['Event', 'Date', 'Category', 'Race', 'Crew', 'Lane', 'Place', 'Time', 'Delta'],
      rows,
    ),
  };
}

function ResultsView({ report }: { report: ResultsReport }) {
  if (report.events.length === 0) {
    return <EmptyState title="No race results in this range." />;
  }

  return (
    <div className="flex flex-col gap-6">
      {report.events.map((block) => (
        <section key={block.event.id}>
          <h2 className="text-base font-semibold">{block.event.name}</h2>
          <p className="mb-2 text-sm text-muted">{formatDate(block.event.startDate)}</p>
          <div className="flex flex-col gap-3">
            {block.categories.map((categoryBlock) => (
              <Card key={categoryBlock.category.id} className="p-4">
                <h3 className="text-sm font-semibold">{categoryName(categoryBlock.category)}</h3>
                {categoryBlock.groups.map((group) => (
                  <div key={group.label} className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {group.label}
                    </p>
                    <table className="mt-1 w-full text-sm">
                      <tbody className="divide-y divide-[var(--border-subtle)]">
                        {group.rows.map((row, i) => (
                          <tr key={`${row.crew.id}-${i}`}>
                            <td className="w-12 py-1 font-medium">
                              {row.placement ? ordinal(row.placement) : '—'}
                            </td>
                            <td className="py-1">{row.crew.name}</td>
                            <td className="tabular w-16 py-1 text-right text-muted">
                              {row.lane != null ? `lane ${row.lane}` : ''}
                            </td>
                            <td className="tabular w-24 py-1 text-right">
                              {row.timeMs != null ? formatRaceTime(row.timeMs) : 'no time'}
                            </td>
                            <td className="tabular w-16 py-1 text-right text-muted">
                              {formatDelta(row.deltaMs)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// --- Composition -------------------------------------------------------------

function compositionCsv(report: CompositionReport, today: string) {
  const rows: unknown[][] = [];
  const slice = (name: string, buckets: CompositionBucket[]) => {
    for (const bucket of buckets) rows.push([name, bucket.label, bucket.count]);
  };
  slice('Status', report.status);
  slice('Gender', report.gender);
  slice('Age band', report.ageBands);
  slice('Paddling side', report.sides);
  slice('Weight band', report.weightBands);
  rows.push(['Officials', 'Drummer only', report.officials.canDrum]);
  rows.push(['Officials', 'Cox only', report.officials.canSteer]);
  rows.push(['Officials', 'Both', report.officials.both]);
  rows.push(['Officials', 'Neither', report.officials.neither]);
  return {
    filename: `roster-composition-${today}.csv`,
    csv: rowsToCsv(['Slice', 'Bucket', 'Count'], rows),
  };
}

function CompositionView({ report }: { report: CompositionReport }) {
  if (report.total === 0) return <EmptyState title="No members match that filter." />;

  const officials: CompositionBucket[] = [
    { key: 'drum', label: 'Drummer only', count: report.officials.canDrum },
    { key: 'steer', label: 'Cox only', count: report.officials.canSteer },
    { key: 'both', label: 'Drummer and cox', count: report.officials.both },
    { key: 'neither', label: 'Neither', count: report.officials.neither },
  ];

  const slices: { title: string; buckets: CompositionBucket[] }[] = [
    { title: 'Status', buckets: report.status },
    { title: 'Gender', buckets: report.gender },
    { title: 'Age band', buckets: report.ageBands },
    { title: 'Paddling side', buckets: report.sides },
    { title: 'Weight band', buckets: report.weightBands },
    { title: 'Officials', buckets: officials },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {slices.map(({ title, buckets }) => (
        <Card key={title} className="p-4">
          <h3 className="text-sm font-semibold">{title}</h3>
          <ul className="mt-3 flex flex-col gap-1.5">
            {buckets.map((bucket) => (
              <li key={bucket.key} className="flex items-center gap-2 text-sm">
                <span className="w-40 shrink-0 truncate text-muted">{bucket.label}</span>
                <span className="tabular w-8 shrink-0 text-right font-medium">{bucket.count}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full surface-sunken">
                  <span
                    className="block h-full rounded-full bg-brand-600"
                    style={{ width: `${(bucket.count / report.total) * 100}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

// --- Bench -------------------------------------------------------------------

function benchCsv(report: BenchReport, range: DateRange) {
  return {
    filename: `bench-${range.from}-to-${range.to}.csv`,
    csv: rowsToCsv(
      ['Member', 'Signed in', 'Seated', 'Benched', 'Benched at'],
      report.rows.map((row) => [
        fullName(row.member),
        row.saidIn,
        row.seated,
        row.benched,
        row.benchedEvents.map((b) => b.event.name).join('; '),
      ]),
    ),
  };
}

function BenchView({ report }: { report: BenchReport }) {
  if (report.consideredEvents === 0) {
    return <EmptyState title="No events with a lineup in this range." />;
  }
  if (report.rows.length === 0) {
    return (
      <EmptyState
        title="Nobody was left ashore"
        description={`Everyone who signed up for the ${pluralise(
          report.consideredEvents,
          'event',
        )} in this range got a seat.`}
      />
    );
  }

  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="text-xs uppercase tracking-wide text-muted">
          <tr className="border-b border-subtle">
            <th className="px-3 py-1.5 text-left font-semibold">Member</th>
            <th className="px-2 py-1.5 text-right font-semibold">Signed in</th>
            <th className="px-2 py-1.5 text-right font-semibold">Seated</th>
            <th className="px-2 py-1.5 text-right font-semibold">Benched</th>
            <th className="px-3 py-1.5 text-left font-semibold">Benched at</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {report.rows.map((row) => (
            <tr key={row.member.id}>
              <td className="px-3 py-1.5 font-medium">{fullName(row.member)}</td>
              <td className={NUM_CELL}>{row.saidIn}</td>
              <td className={NUM_CELL}>{row.seated}</td>
              <td className={`${NUM_CELL} font-medium`}>{row.benched}</td>
              <td className="px-3 py-1.5">
                <span className="flex flex-wrap items-center gap-1.5">
                  {row.benchedEvents.map(({ event, reserveOnly }) => (
                    <span key={event.id} className="flex items-center gap-1">
                      <span className="text-muted">{event.name}</span>
                      {reserveOnly && <Badge tone="neutral">listed as reserve</Badge>}
                    </span>
                  ))}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-subtle px-3 py-2 text-xs text-muted">
        {pluralise(report.fullySeatedCount, 'other member')} signed in and got a seat every time.
      </p>
    </Card>
  );
}
