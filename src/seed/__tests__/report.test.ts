/**
 * Not an assertion suite. This prints the audit of the sample trip so a person can read
 * what the linter actually says, which is the only way to tell useful findings from noise.
 */
import { it } from 'vitest';
import { allGuides } from '@/content/guides';
import { lintTrip } from '@/lint/engine';
import { bookByTimeline } from '@/playbook/bookBy';
import { europe2026 } from '../europe-2026';

it('prints the audit for review', () => {
  const lines: string[] = [];
  const log = (line: string) => lines.push(line);
  const findings = lintTrip(europe2026.bundle, { today: '2026-09-04', guides: allGuides });

  const bySeverity: Record<string, number> = { error: 0, warning: 0, info: 0 };
  for (const f of findings) bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
  log(`TOTAL ${findings.length} ${JSON.stringify(bySeverity)}`);

  const byRule = new Map<string, number>();
  for (const f of findings) byRule.set(f.ruleId, (byRule.get(f.ruleId) ?? 0) + 1);
  log(
    `BYRULE ${[...byRule.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([r, n]) => `${r}=${n}`)
      .join(' ')}`,
  );

  for (const f of findings.filter((x) => x.severity === 'error')) {
    log(`ERR [${f.date ?? '-'}] ${f.ruleId}: ${f.title}`);
  }

  const timeline = bookByTimeline(europe2026.bundle, allGuides, '2026-09-04');
  for (const e of timeline) {
    if (!['overdue', 'now', 'soon'].includes(e.result.urgency)) continue;
    log(
      `BOOK ${e.result.urgency.padEnd(8)} by ${e.result.date} : ${e.booking.title} [${e.result.basis}]`,
    );
  }

  // Run with `npx vitest run src/seed/__tests__/report.test.ts` and read the console.
  for (const line of lines) console.log(line);
});
