/**
 * The booking playbook: the searchable index of every guide, and one guide in detail.
 *
 * Split out of BookingPages once it grew past a screen. `GuideCard` is still shown inline
 * from a booking's detail view, so it stays the one export that file imports back from here
 * - nothing here imports from BookingPages, to keep that a one-way street.
 */
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  AlertTriangle,
  Bus,
  ExternalLink,
  Info,
  Landmark,
  Mountain,
  Plane,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  TicketCheck,
  TrainFront,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { allGuides } from '@/content/guides';
import {
  Button,
  Card,
  Disclosure,
  EmptyState,
  Fact,
  FactStrip,
  OutLink,
  PageHeader,
  SearchInput,
} from '@/components/ui';
import type { BookAdvice, Guide, GuideCategory, Reseller } from '@/playbook/types';

/**
 * A short, honest phrasing of a booking deadline: the largest unit that divides the
 * actual number of days evenly, so rounding never quietly moves the deadline later.
 */
function leadTimePhrase(advice: BookAdvice): { text: string; tone: 'good' | 'neutral' } {
  if (advice.onSiteOk) return { text: 'On the day', tone: 'good' };
  if (advice.latestDaysBefore == null) return { text: 'Any time', tone: 'neutral' };
  const days = advice.latestDaysBefore;
  if (days >= 30 && days % 30 === 0) {
    const months = days / 30;
    return { text: `${months} month${months === 1 ? '' : 's'}`, tone: 'neutral' };
  }
  if (days >= 7 && days % 7 === 0) {
    const weeks = days / 7;
    return { text: `${weeks} week${weeks === 1 ? '' : 's'}`, tone: 'neutral' };
  }
  return { text: `${days} day${days === 1 ? '' : 's'}`, tone: 'neutral' };
}

/** The card footer says what to do, not just a duration. */
function leadTimeSentence(advice: BookAdvice): string {
  if (advice.onSiteOk) return 'Book on the day';
  if (advice.latestDaysBefore == null) return 'Book any time';
  return `Book ${leadTimePhrase(advice).text} ahead`;
}

/**
 * The one thing most worth a glance before booking, beyond when and where. `refundable`
 * is the actual booking's own value, when known - it overrides the guide's generic
 * fare-class text, which otherwise can flatly contradict the ticket someone already holds.
 */
function watchForFact(
  guide: Guide,
  refundable?: boolean | null,
): { text: string; tone: 'warn' | 'neutral' | 'good' } {
  if (guide.validation?.required) return { text: 'Validation required', tone: 'warn' };
  if (refundable != null) {
    return refundable
      ? { text: 'Refundable', tone: 'good' }
      : { text: 'Non-refundable', tone: 'warn' };
  }
  // Only the negative is safe to read off free text. "Depends on the seller" is not a
  // promise of a refund, so anything short of a clear "no" sends you to the rules instead.
  if (guide.refundRules) {
    const nonRefundable = /non-refundable|not refundable/i.test(guide.refundRules);
    return nonRefundable
      ? { text: 'Non-refundable', tone: 'warn' }
      : { text: 'Check refund rules', tone: 'neutral' };
  }
  return { text: 'Nothing unusual', tone: 'neutral' };
}

/** Coarser than a `GuideCategory`, so a filter row fits on one line: 16 values, 7 tiles. */
type GuideBucket =
  | 'Trains'
  | 'Airports'
  | 'Mountains & boats'
  | 'Museums'
  | 'City transport'
  | 'Passes'
  | 'Food & stays';

const CATEGORY_BUCKET: Record<GuideCategory, GuideBucket> = {
  train: 'Trains',
  'regional-train': 'Trains',
  'international-train': 'Trains',
  airport: 'Airports',
  flight: 'Airports',
  ferry: 'Mountains & boats',
  'mountain-railway': 'Mountains & boats',
  gondola: 'Mountains & boats',
  bus: 'City transport',
  metro: 'City transport',
  museum: 'Museums',
  attraction: 'Museums',
  restaurant: 'Food & stays',
  hotel: 'Food & stays',
  pass: 'Passes',
  'city-card': 'Passes',
};

const GUIDE_BUCKETS: GuideBucket[] = [
  'Trains',
  'Airports',
  'Mountains & boats',
  'Museums',
  'City transport',
  'Passes',
  'Food & stays',
];

/** A shape per bucket, not just a word, so categories are something to compare at a glance. */
const BUCKET_ICON: Record<GuideBucket, typeof Info> = {
  Trains: TrainFront,
  Airports: Plane,
  'Mountains & boats': Mountain,
  Museums: Landmark,
  'City transport': Bus,
  Passes: TicketCheck,
  'Food & stays': UtensilsCrossed,
};

/** Written out in full rather than built from a token, because Tailwind 4 scans source text. */
const BUCKET_COLOR: Record<GuideBucket, string> = {
  Trains: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  Airports: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300',
  'Mountains & boats':
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  Museums: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300',
  'City transport': 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
  Passes: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
  'Food & stays': 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
};

const COUNTRY_FLAG: Record<string, string> = {
  IT: '🇮🇹',
  CH: '🇨🇭',
  FR: '🇫🇷',
  BE: '🇧🇪',
  NL: '🇳🇱',
  EU: '🇪🇺',
};

const COUNTRY_NAME: Record<string, string> = {
  IT: 'Italy',
  CH: 'Switzerland',
  FR: 'France',
  BE: 'Belgium',
  NL: 'Netherlands',
  EU: 'Anywhere in Europe',
};

/**
 * Windows has no flag-emoji glyphs, so Chrome and Edge there fall back to the bare
 * regional-indicator letters. The bordered pill makes that fallback read as a deliberate
 * country code rather than a broken glyph, while a phone still shows the flag inside it -
 * either way the name is on the element for anyone not reading it visually.
 */
function FlagPill({ code }: { code: string }) {
  const name = COUNTRY_NAME[code] ?? code;
  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      className="inline-flex items-center rounded border border-slate-200 px-1.5 text-xs dark:border-slate-600"
    >
      {COUNTRY_FLAG[code] ?? code}
    </span>
  );
}

/** 0 on-the-day or any-time, 1 under a week, 2 under a month, 3 a month or more. */
function bookWindowLevel(advice: BookAdvice): 0 | 1 | 2 | 3 {
  if (advice.onSiteOk || advice.latestDaysBefore == null) return 0;
  const days = advice.latestDaysBefore;
  if (days < 7) return 1;
  if (days < 30) return 2;
  return 3;
}

const LEVEL_COLOR: Record<0 | 1 | 2 | 3, string> = {
  0: 'bg-emerald-500 dark:bg-emerald-400',
  1: 'bg-sky-500 dark:bg-sky-400',
  2: 'bg-amber-500 dark:bg-amber-400',
  3: 'bg-rose-500 dark:bg-rose-400',
};

/**
 * The four segments on their own, so the real meter and the legend draw from one place -
 * a segment is filled at or below the level, deliberately: level 0 still shows one filled
 * segment rather than a bar that looks empty (and therefore broken).
 */
function MeterBars({ level }: { level: 0 | 1 | 2 | 3 }) {
  return (
    <>
      {[0, 1, 2, 3].map((segment) => (
        <span
          key={segment}
          className={cn(
            'h-1 w-4 rounded-full',
            segment <= level ? LEVEL_COLOR[level] : 'bg-slate-200 dark:bg-slate-700',
          )}
        />
      ))}
    </>
  );
}

/**
 * Four segments filled to the booking-window level, so "how far ahead" is a shape to
 * compare across cards rather than a sentence to read on each one. The shape only teaches
 * anything next to `MeterLegend`, so the label here is the full sentence, on both the
 * accessible name and a hover title, not the bar's own colour code.
 */
function BookWindowMeter({ advice }: { advice: BookAdvice }) {
  const level = bookWindowLevel(advice);
  const sentence = leadTimeSentence(advice);
  return (
    <span
      role="img"
      aria-label={sentence}
      title={sentence}
      className="inline-flex items-center gap-0.5"
    >
      <MeterBars level={level} />
    </span>
  );
}

const METER_LEGEND_ENTRIES: Array<{ level: 0 | 1 | 2 | 3; label: string }> = [
  { level: 0, label: 'On the day' },
  { level: 1, label: 'Days' },
  { level: 2, label: 'Weeks' },
  { level: 3, label: 'Months ahead' },
];

/**
 * The bar is self-teaching only once it sits beside its meaning at the size a reader will
 * actually meet it on a card. Purely decorative repetition for a screen reader - each
 * card's own meter already carries the sentence in its `aria-label`.
 */
function MeterLegend() {
  return (
    <div
      aria-hidden="true"
      className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg bg-slate-100 px-3 py-2 dark:bg-slate-800/60"
    >
      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
        Booking window
      </span>
      {METER_LEGEND_ENTRIES.map((entry) => (
        <span
          key={entry.level}
          className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400"
        >
          <span className="inline-flex items-center gap-0.5">
            <MeterBars level={entry.level} />
          </span>
          {entry.label}
        </span>
      ))}
    </div>
  );
}

function TrustIcon({ trust }: { trust: Reseller['trust'] }) {
  if (trust === 'fine') return <ShieldCheck size={15} className="text-emerald-600" aria-hidden />;
  if (trust === 'avoid') return <ShieldX size={15} className="text-rose-600" aria-hidden />;
  return <ShieldAlert size={15} className="text-amber-600" aria-hidden />;
}

const TRUST_WORDS: Record<Reseller['trust'], string> = {
  fine: 'Fine to use',
  'ok-with-markup': 'Works, with a markup',
  avoid: 'Avoid',
};

/**
 * The playbook entry rendered inline, used from a booking and from an item. `refundable`
 * lets a caller that knows the booking's own refund status override the guide's generic
 * "Watch for" fact rather than let the two disagree.
 */
export function GuideCard({
  guideId,
  hideTitle,
  refundable,
}: {
  guideId: string;
  hideTitle?: boolean;
  refundable?: boolean | null;
}) {
  const guide = allGuides.find((g) => g.id === guideId);
  if (!guide) return null;

  const lead = leadTimePhrase(guide.bookAdvice);
  const watch = watchForFact(guide, refundable);

  return (
    <Card className="mb-4">
      {hideTitle ? null : <p className="font-semibold">{guide.title}</p>}
      <p className={cn('mb-3 text-sm text-slate-600 dark:text-slate-300', hideTitle ? '' : 'mt-1')}>
        {guide.summary}
      </p>

      <FactStrip>
        <Fact label="When" value={lead.text} tone={lead.tone} />
        <Fact label="Where" value={guide.official.name} />
        <Fact label="Watch for" value={watch.text} tone={watch.tone} />
      </FactStrip>

      <OutLink href={guide.official.url}>
        Book at {guide.official.name}
        <ExternalLink size={13} className="ml-1.5" aria-hidden />
      </OutLink>
      {guide.official.note ? (
        <p className="mt-1.5 text-xs text-slate-500">{guide.official.note}</p>
      ) : null}

      <div className="mt-3 space-y-2">
        <Disclosure title="When to book">
          <p className="text-slate-600 dark:text-slate-300">{guide.bookAdvice.note}</p>
        </Disclosure>

        {guide.resellers?.length ? (
          <Disclosure title="Resellers" count={guide.resellers.length}>
            <ul className="space-y-1.5">
              {guide.resellers.map((reseller) => (
                <li key={reseller.url} className="flex items-start gap-2">
                  <span className="mt-0.5">
                    <TrustIcon trust={reseller.trust} />
                  </span>
                  <span>
                    <span className="font-medium">{reseller.name}</span>
                    <span className="text-slate-500"> · {TRUST_WORDS[reseller.trust]}</span>
                    {reseller.note ? (
                      <span className="block text-slate-500">{reseller.note}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </Disclosure>
        ) : null}

        {guide.validation ? (
          <Disclosure title="Validation" tone="warn" defaultOpen={guide.validation.required}>
            <p className="text-slate-600 dark:text-slate-300">{guide.validation.note}</p>
          </Disclosure>
        ) : null}

        {guide.refundRules ? (
          <Disclosure title="Refunds">
            <p className="text-slate-600 dark:text-slate-300">{guide.refundRules}</p>
          </Disclosure>
        ) : null}

        {guide.passCoverage?.length ? (
          <Disclosure title="Rail pass">
            <ul className="space-y-1 text-slate-600 dark:text-slate-300">
              {guide.passCoverage.map((cover) => (
                <li key={cover.passId}>
                  {cover.coverage === 'covered'
                    ? 'Fully covered'
                    : cover.coverage === 'discount'
                      ? 'Discounted, not free'
                      : 'Not covered'}
                  {cover.note ? `. ${cover.note}` : ''}
                </li>
              ))}
            </ul>
          </Disclosure>
        ) : null}

        {guide.gotchas?.length ? (
          <Disclosure title="Common mistakes" count={guide.gotchas.length}>
            <ul className="list-inside list-disc space-y-1 text-slate-600 dark:text-slate-300">
              {guide.gotchas.map((gotcha) => (
                <li key={gotcha}>{gotcha}</li>
              ))}
            </ul>
          </Disclosure>
        ) : null}
      </div>

      <p className="mt-3 text-xs text-slate-400">Checked {guide.lastReviewed}</p>
    </Card>
  );
}

/** One category filter as a tile rather than a chip, so the coloured shape carries as much meaning as the label beside it. */
function CategoryTile({
  bucket,
  count,
  active,
  onToggle,
}: {
  bucket: GuideBucket;
  count: number;
  active: boolean;
  onToggle: () => void;
}) {
  const Icon = BUCKET_ICON[bucket];
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={cn(
        'flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition',
        active
          ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/40'
          : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600',
      )}
    >
      <span
        className={cn('flex size-9 items-center justify-center rounded-lg', BUCKET_COLOR[bucket])}
      >
        <Icon size={18} aria-hidden />
      </span>
      <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200">{bucket}</span>
      <span className="text-[10px] text-slate-400">{count}</span>
    </button>
  );
}

/** One guide as a card: the shape and colour say what it is before anyone reads the title.
 * `tripId` keeps the link inside the trip's own tab bar when there is one to stay in. */
function GuideIndexCard({ guide, tripId }: { guide: Guide; tripId?: string }) {
  const bucket = CATEGORY_BUCKET[guide.category];
  const Icon = BUCKET_ICON[bucket];
  const sentence = leadTimeSentence(guide.bookAdvice);

  return (
    <Link
      to={tripId ? `/t/${tripId}/playbook/${guide.id}` : `/playbook/${guide.id}`}
      className="hover:border-brand-400 block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow dark:border-slate-700 dark:bg-slate-800"
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-lg',
            BUCKET_COLOR[bucket],
          )}
        >
          <Icon size={18} aria-hidden />
        </span>
        <p className="min-w-0 leading-snug font-semibold">{guide.title}</p>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
        {guide.summary}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
        <FlagPill code={guide.countryCode} />
        <BookWindowMeter advice={guide.bookAdvice} />
        <span className="text-xs text-slate-500 dark:text-slate-400">{sentence}</span>
        {guide.validation?.required ? (
          <AlertTriangle
            size={14}
            role="img"
            aria-label="Validation required"
            className="text-amber-600 dark:text-amber-400"
          />
        ) : null}
      </div>
    </Link>
  );
}

export function PlaybookIndexPage() {
  const { tripId } = useParams();
  const [query, setQuery] = useState('');
  const [activeBuckets, setActiveBuckets] = useState<ReadonlySet<GuideBucket>>(new Set());

  const searched = allGuides.filter((guide) => {
    const haystack = `${guide.title} ${guide.summary}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  const bucketCounts = new Map<GuideBucket, number>();
  for (const guide of searched) {
    const bucket = CATEGORY_BUCKET[guide.category];
    bucketCounts.set(bucket, (bucketCounts.get(bucket) ?? 0) + 1);
  }

  const visible = searched.filter(
    (guide) => activeBuckets.size === 0 || activeBuckets.has(CATEGORY_BUCKET[guide.category]),
  );

  // Grouped in `GUIDE_BUCKETS` order regardless of filter or search - narrowing only ever
  // empties a group out, it never reshuffles the categories themselves.
  const groupedVisible = new Map<GuideBucket, Guide[]>();
  for (const guide of visible) {
    const bucket = CATEGORY_BUCKET[guide.category];
    const list = groupedVisible.get(bucket) ?? [];
    list.push(guide);
    groupedVisible.set(bucket, list);
  }
  const groups = GUIDE_BUCKETS.map((bucket) => ({
    bucket,
    guides: groupedVisible.get(bucket) ?? [],
  })).filter((group) => group.guides.length > 0);

  const toggleBucket = (bucket: GuideBucket) =>
    setActiveBuckets((prev) => {
      const next = new Set(prev);
      if (next.has(bucket)) next.delete(bucket);
      else next.add(bucket);
      return next;
    });

  return (
    <>
      <PageHeader title="Playbook" />
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search guides"
        label="Search guides"
      />
      {activeBuckets.size > 0 ? (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={() => setActiveBuckets(new Set())}
            className="inline-flex min-h-[32px] items-center gap-1 rounded-full px-2 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            <X size={13} aria-hidden />
            Clear
          </button>
        </div>
      ) : null}
      <div
        className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-4"
        role="group"
        aria-label="Filter by kind"
      >
        {GUIDE_BUCKETS.map((bucket) => (
          <CategoryTile
            key={bucket}
            bucket={bucket}
            count={bucketCounts.get(bucket) ?? 0}
            active={activeBuckets.has(bucket)}
            onToggle={() => toggleBucket(bucket)}
          />
        ))}
      </div>
      <MeterLegend />
      {groups.length > 0 ? (
        groups.map(({ bucket, guides }, index) => {
          const Icon = BUCKET_ICON[bucket];
          return (
            <div key={bucket} className={index > 0 ? 'mt-6' : undefined}>
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={cn(
                    'flex size-7 items-center justify-center rounded-md',
                    BUCKET_COLOR[bucket],
                  )}
                >
                  <Icon size={16} aria-hidden />
                </span>
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {bucket}
                </h2>
                <span className="text-xs text-slate-400">{guides.length}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {guides.map((guide) => (
                  <GuideIndexCard key={guide.id} guide={guide} tripId={tripId} />
                ))}
              </div>
            </div>
          );
        })
      ) : (
        <EmptyState title="No matching guides.">
          Try a different search, or clear the filters.
        </EmptyState>
      )}
    </>
  );
}

/**
 * The one picture on the guide screen: real milestones read off the guide's own numbers,
 * not a decorative graphic. Renders nothing when neither number is known, and only the
 * milestones the data actually supports otherwise.
 */
function BookingTimeline({ guide }: { guide: Guide }) {
  const milestones: Array<{ key: string; label: string; sub?: string }> = [];
  if (guide.ticketsOpen?.daysBefore != null) {
    milestones.push({
      key: 'open',
      label: 'Tickets open',
      sub: `${guide.ticketsOpen.daysBefore}d before`,
    });
  }
  if (guide.bookAdvice.latestDaysBefore != null) {
    milestones.push({
      key: 'book',
      label: 'Book by',
      sub: `${guide.bookAdvice.latestDaysBefore}d before`,
    });
  }
  if (milestones.length === 0) return null;
  milestones.push({ key: 'travel', label: 'Travel day' });

  return (
    <div className="relative mb-4 flex items-start justify-between">
      <div className="absolute top-1.5 right-0 left-0 h-0.5 bg-slate-200 dark:bg-slate-700" />
      {milestones.map((milestone) => (
        <div key={milestone.key} className="relative z-10 flex flex-col items-center gap-1">
          <span className="border-brand-500 size-3 rounded-full border-2 bg-white dark:bg-slate-800" />
          <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
            {milestone.label}
          </span>
          {milestone.sub ? (
            <span className="text-[10px] text-slate-400">{milestone.sub}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function PlaybookDetailPage() {
  const { guideId } = useParams();
  const navigate = useNavigate();
  const guide = allGuides.find((g) => g.id === guideId);
  if (!guide) return <EmptyState title="No such guide." />;

  const bucket = CATEGORY_BUCKET[guide.category];
  const Icon = BUCKET_ICON[bucket];
  const countryName = COUNTRY_NAME[guide.countryCode] ?? guide.countryCode;

  return (
    <>
      <PageHeader
        title={guide.title}
        actions={<Button onClick={() => void navigate(-1)}>Back</Button>}
      />
      <div className="mb-4 flex items-center gap-3 rounded-xl bg-slate-100 p-3 dark:bg-slate-800/60">
        <span
          className={cn(
            'flex size-12 shrink-0 items-center justify-center rounded-xl',
            BUCKET_COLOR[bucket],
          )}
        >
          <Icon size={24} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
            <FlagPill code={guide.countryCode} />
            {countryName}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{bucket}</p>
        </div>
      </div>
      <BookingTimeline guide={guide} />
      <GuideCard guideId={guide.id} hideTitle />
      {guide.sources?.length ? (
        <Disclosure title="Sources" count={guide.sources.length}>
          <ul className="space-y-1">
            {guide.sources.map((source) => (
              <li key={source}>
                <Link to={source} className="text-brand-700 dark:text-brand-300 break-all">
                  {source}
                </Link>
              </li>
            ))}
          </ul>
        </Disclosure>
      ) : null}
    </>
  );
}
