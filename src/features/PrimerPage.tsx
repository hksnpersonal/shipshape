/**
 * "New to Europe?" primer: how things work day to day, as distinct from the Playbook
 * (PlaybookPages.tsx), which covers how to book things.
 */
import { useState } from 'react';
import { useParams } from 'react-router';
import { Disclosure, EmptyState, PageHeader, SearchInput, Section } from '@/components/ui';
import { cityNotes, generalTips, lastReviewed, type CityNote } from '@/content/primer';
import { orderedDays } from '@/domain/bundle';
import { useTripBundle } from '@/hooks/useTrip';

/** Raw `Day.city` values that stand in for a `cityNotes` entry rather than naming one directly. */
const CITY_ALIASES: Record<string, string> = {
  Varenna: 'Lake Como',
  Bellagio: 'Lake Como',
  Menaggio: 'Lake Como',
  Kandersteg: 'Grindelwald',
  Lauterbrunnen: 'Grindelwald',
  Wengen: 'Grindelwald',
  Muerren: 'Grindelwald',
};

/**
 * City notes in the order the trip actually visits them. Pisa never gets its own day (it's
 * a day trip inside a Florence-city day), so it is special-cased to sort just after
 * Florence, wherever Florence lands - or last if there is no Florence day at all.
 */
function orderCityNotes(bundle: ReturnType<typeof useTripBundle>): CityNote[] {
  const firstIndex = new Map<string, number>();
  if (bundle) {
    orderedDays(bundle).forEach((day, index) => {
      const key = CITY_ALIASES[day.city] ?? day.city;
      if (!firstIndex.has(key)) firstIndex.set(key, index);
    });
  }

  const florenceIndex = firstIndex.get('Florence');
  const pisaIndex = florenceIndex !== undefined ? florenceIndex + 0.5 : Number.POSITIVE_INFINITY;

  return cityNotes
    .map((note, position) => {
      const index =
        note.city === 'Pisa' ? pisaIndex : (firstIndex.get(note.city) ?? Number.POSITIVE_INFINITY);
      return { note, index, position };
    })
    .sort((a, b) => a.index - b.index || a.position - b.position)
    .map((entry) => entry.note);
}

/** Lowercase substring over title + bullets, the same shape as PlaybookIndexPage's search. */
function matches(query: string, title: string, bullets: string[]): boolean {
  const haystack = `${title} ${bullets.join(' ')}`.toLowerCase();
  return haystack.includes(query);
}

export function PrimerPage() {
  const { tripId } = useParams();
  const bundle = useTripBundle(tripId);
  const [query, setQuery] = useState('');

  if (bundle === undefined) return <p className="text-slate-500">Loading.</p>;
  if (!bundle) return <EmptyState title="That trip is not on this device." />;

  const trimmedQuery = query.trim().toLowerCase();
  const visibleTips = generalTips.filter((section) =>
    matches(trimmedQuery, section.title, section.bullets),
  );
  const visibleCities = orderCityNotes(bundle).filter((note) =>
    matches(trimmedQuery, note.title, note.bullets),
  );

  return (
    <>
      <PageHeader kicker="Guide" title="New to Europe?" />
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search tips"
        label="Search tips"
      />
      {visibleTips.length === 0 && visibleCities.length === 0 ? (
        <EmptyState title="No matching topics.">Try a different search.</EmptyState>
      ) : (
        <>
          {visibleTips.length > 0 ? (
            <div className="mb-6 space-y-2">
              {visibleTips.map((section) => (
                <Disclosure key={section.id} title={section.title}>
                  <ul className="list-inside list-disc space-y-1 text-slate-600 dark:text-slate-300">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                </Disclosure>
              ))}
            </div>
          ) : null}

          {visibleCities.length > 0 ? (
            <Section title="City notes">
              <div className="space-y-2">
                {visibleCities.map((note) => (
                  <Disclosure key={note.city} title={note.title}>
                    <ul className="list-inside list-disc space-y-1 text-slate-600 dark:text-slate-300">
                      {note.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  </Disclosure>
                ))}
              </div>
            </Section>
          ) : null}
        </>
      )}
      <p className="mt-3 text-xs text-slate-400">Checked {lastReviewed}</p>
    </>
  );
}
