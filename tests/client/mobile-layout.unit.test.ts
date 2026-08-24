import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  compactCalendarPeriodLabel,
  getMobileLayoutDecision,
} from '../../src/app/mobile-layout';

const VIEWPORT_WIDTHS = [320, 341, 360, 375, 390] as const;

test('mobile layout decisions cover narrow and intermediate phone widths', () => {
  const decisions = VIEWPORT_WIDTHS.map((width) => [width, getMobileLayoutDecision(width)] as const);

  assert.deepEqual(
    decisions.map(([width, decision]) => [width, decision.homeSummary]),
    [[320, 'compact'], [341, 'compact'], [360, 'compact'], [375, 'compact'], [390, 'regular']],
  );
  assert.deepEqual(
    decisions.map(([width, decision]) => [width, decision.calendarPeriod]),
    [[320, 'month-only'], [341, 'month-only'], [360, 'full'], [375, 'full'], [390, 'full']],
  );
  assert.deepEqual(
    decisions.map(([width, decision]) => [width, Number(decision.sharePreviewScale.toFixed(3))]),
    [[320, 0.793], [341, 0.853], [360, 0.907], [375, 0.949], [390, 0.992]],
  );
});

test('compact calendar period labels preserve one and two digit months', () => {
  assert.equal(compactCalendarPeriodLabel('2026년 8월'), '8월');
  assert.equal(compactCalendarPeriodLabel('2026년 10월'), '10월');
  assert.equal(compactCalendarPeriodLabel('October 2026'), 'October 2026');
});

test('critical mobile class contracts remain attached to shared and record layouts', () => {
  const source = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
  const styles = source('src/styles/index.css');
  const bottomSheet = source('src/app/components/overlay/BottomSheet.tsx');
  const calendarTopBar = source('src/features/calendar/components/CalendarTopBar.tsx');
  const homeShell = source('src/features/home/components/HomeSectionShell.tsx');
  const records = source('src/app/pages/MyRecordsPage.tsx');
  const result = source('src/app/pages/RecordResultPage.tsx');

  assert.match(styles, /@media \(max-width: 375px\)[\s\S]*\.home-summary-grid h3[\s\S]*text-overflow: ellipsis;[\s\S]*white-space: nowrap;/);
  assert.match(styles, /\.mobile-bottom-sheet \{\s*padding-bottom: var\(--mobile-safe-bottom\);/);
  assert.match(bottomSheet, /maxHeightClassName = 'max-h-\[80dvh\]'/);
  assert.match(bottomSheet, /className=\{`mobile-bottom-sheet fixed inset-x-0 bottom-0/);
  assert.match(calendarTopBar, /aria-label=\{`기간 선택: \$\{periodLabel\}`\}/);
  assert.match(calendarTopBar, /min-\[360px\]:hidden[\s\S]*hidden truncate whitespace-nowrap[\s\S]*min-\[360px\]:inline/);
  assert.match(homeShell, /flex-1 truncate[\s\S]*aria-label=\{actionLabel \?\? `\$\{title\} 더보기`\}[\s\S]*shrink-0[\s\S]*whitespace-nowrap/);
  assert.match(records, /mobile-safe-top sticky top-0/);
  assert.equal((result.match(/mobile-safe-top sticky top-0/g) ?? []).length, 2);
});
