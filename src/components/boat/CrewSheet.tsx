import type { BalanceReport } from '@/domain/balance';
import { getBoatLayout, ZONE_LABELS } from '@/domain/boat';
import { formatDate } from '@/domain/dates';
import type { Category, ClubEvent, Crew, Member, SeatPosition } from '@/domain/types';
import { categoryName, fullName, formatWeight, SIDE_MARK } from '@/utils/format';

/**
 * The sheet that gets printed and taped up in the team tent.
 *
 * Deliberately not the on-screen boat: the SVG hull reads well on a backlit
 * display and poorly on paper, where a plain two-column table of the seats is
 * quicker to scan and survives a photocopier. Print-only, so it costs nothing
 * on screen.
 */
export function CrewSheet({
  crew,
  category,
  event,
  occupantAt,
  drummer,
  cox,
  reserves,
  balance,
}: {
  crew: Crew;
  category: Category;
  event: ClubEvent;
  occupantAt: (seat: SeatPosition) => Member | undefined;
  drummer?: Member;
  cox?: Member;
  reserves: Member[];
  balance?: BalanceReport;
}) {
  const layout = getBoatLayout(category.boatSize);
  const rows = Array.from({ length: layout.rows }, (_, i) => i + 1);

  return (
    <div className="hidden print:block">
      <header className="mb-4 border-b-2 border-black pb-2">
        <h1 className="text-2xl font-bold">{crew.name}</h1>
        <p className="text-sm">
          {categoryName(category)} — {event.name}, {formatDate(event.startDate)}
          {event.location ? `, ${event.location}` : ''}
        </p>
      </header>

      <div className="mb-4 flex gap-6 text-sm">
        <Cell label="Drummer" value={drummer ? fullName(drummer) : '—'} />
        <Cell label="Coxswain" value={cox ? fullName(cox) : '—'} />
        {balance && (
          <>
            <Cell label="Crew weight" value={`${Math.round(balance.totalKg)}kg`} />
            <Cell
              label="Left / right"
              value={
                balance.sideDeltaKg === 0
                  ? 'even'
                  : `${Math.abs(Math.round(balance.sideDeltaKg))}kg ${
                      balance.sideDeltaKg > 0 ? 'left' : 'right'
                    }`
              }
            />
          </>
        )}
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="w-2/5 py-1">Left</th>
            <th className="w-12 py-1 text-center">Row</th>
            <th className="w-2/5 py-1">Right</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const zone = layout.zoneForRow(row);
            const startsZone = row === 1 || zone !== layout.zoneForRow(row - 1);
            return (
              <tr key={row} className="border-b border-neutral-300">
                <SeatCell member={occupantAt({ row, side: 'left' })} />
                <td className="py-1 text-center align-middle">
                  <span className="tabular font-semibold">{row}</span>
                  {startsZone && (
                    <span className="block text-[0.55rem] uppercase leading-tight">
                      {ZONE_LABELS[zone]}
                    </span>
                  )}
                </td>
                <SeatCell member={occupantAt({ row, side: 'right' })} />
              </tr>
            );
          })}
        </tbody>
      </table>

      {reserves.length > 0 && (
        <p className="mt-3 text-sm">
          <span className="font-semibold">Reserves: </span>
          {reserves.map(fullName).join(', ')}
        </p>
      )}

      {crew.notes && <p className="mt-2 text-sm">{crew.notes}</p>}
    </div>
  );
}

function SeatCell({ member }: { member?: Member }) {
  if (!member) return <td className="py-1.5 text-neutral-400">—</td>;
  return (
    <td className="py-1.5">
      <span className="font-medium">{fullName(member)}</span>
      <span className="tabular ml-2 text-xs text-neutral-600">
        {formatWeight(member.weightKg)} · {SIDE_MARK[member.sidePreference]}
      </span>
    </td>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-[0.6rem] uppercase tracking-wide text-neutral-600">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
