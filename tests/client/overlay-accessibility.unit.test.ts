import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { handleOverlayOpenChange, shouldPreventOverlayDismiss, shouldRestoreOverlayFocus } from '../../src/app/components/overlay/overlay-behavior';

test('overlay dismissal locks Escape, outside interaction, and open-state close requests', () => {
  let closeCalls = 0;
  const onClose = () => { closeCalls += 1; };

  assert.equal(shouldPreventOverlayDismiss(false), true);
  handleOverlayOpenChange(false, false, onClose);
  assert.equal(closeCalls, 0);

  assert.equal(shouldPreventOverlayDismiss(true), false);
  handleOverlayOpenChange(true, true, onClose);
  assert.equal(closeCalls, 0);
  handleOverlayOpenChange(false, true, onClose);
  assert.equal(closeCalls, 1);
});

test('overlay focus restoration waits for a real unmount and a connected opener', () => {
  assert.equal(shouldRestoreOverlayFocus(true, true), false);
  assert.equal(shouldRestoreOverlayFocus(false, false), false);
  assert.equal(shouldRestoreOverlayFocus(true, false), false);
  assert.equal(shouldRestoreOverlayFocus(false, true), true);
});

test('shared overlays retain Radix modal, title, focus, and dismissal semantics', () => {
  for (const relativePath of [
    '../../src/app/components/overlay/CenteredModalShell.tsx',
    '../../src/app/components/overlay/BottomSheet.tsx',
  ]) {
    const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
    assert.match(source, /<Dialog\.Root modal open/);
    assert.match(source, /<Dialog\.Portal>/);
    assert.match(source, /<Dialog\.Title/);
    assert.match(source, /<Dialog\.Description/);
    assert.match(source, /aria-modal="true"/);
    assert.match(source, /onEscapeKeyDown/);
    assert.match(source, /onPointerDownOutside/);
    assert.match(source, /onOpenAutoFocus/);
    assert.match(source, /onCloseAutoFocus/);
    assert.match(source, /restoreFocusRef\.current\?\.focus\(\)/);
    assert.match(source, /shouldRestoreOverlayFocus/);
  }
});

test('centered overlays keep viewport gutters, short-height scrolling, and the highest overlay layer', () => {
  const centered = readFileSync(new URL('../../src/app/components/overlay/CenteredModalShell.tsx', import.meta.url), 'utf8');
  const sheet = readFileSync(new URL('../../src/app/components/overlay/BottomSheet.tsx', import.meta.url), 'utf8');

  assert.match(centered, /zIndexClassName = 'z-\[80\]'/);
  assert.match(sheet, /zIndexClassName = 'z-\[70\]'/);
  assert.match(centered, /fixed inset-0 flex items-center justify-center p-4/);
  assert.match(centered, /maxHeightClassName = 'max-h-\[calc\(100dvh-2rem\)\]'/);
  assert.match(centered, /w-full overflow-y-auto/);
});

test('primary screens and shared navigation expose landmark and current-view semantics', () => {
  const home = readFileSync(new URL('../../src/features/home/HomeScreen.tsx', import.meta.url), 'utf8');
  const gymSearch = readFileSync(new URL('../../src/features/gym-search/GymSearchScreen.tsx', import.meta.url), 'utf8');
  const calendar = readFileSync(new URL('../../src/features/calendar/CalendarScreen.tsx', import.meta.url), 'utf8');
  const bottomNav = readFileSync(new URL('../../src/app/components/layout/BottomTabBar.tsx', import.meta.url), 'utf8');
  const topTabs = readFileSync(new URL('../../src/app/components/layout/TopTabHeader.tsx', import.meta.url), 'utf8');

  assert.match(home, /<main className=/);
  assert.match(gymSearch, /<main>/);
  assert.match(calendar, /<main>/);
  assert.match(bottomNav, /<nav aria-label="주요 메뉴"/);
  assert.match(bottomNav, /aria-current=/);
  assert.match(bottomNav, /aria-label="운동 기록 시작"/);
  assert.match(topTabs, /role="group" aria-label="화면 보기"/);
  assert.match(topTabs, /aria-pressed=/);
  assert.doesNotMatch(topTabs, /role="tab"|aria-selected|aria-controls/);
});

test('navigation colors use AA text colors for their rendered sizes', () => {
  const bottomNav = readFileSync(new URL('../../src/app/components/layout/BottomTabBar.tsx', import.meta.url), 'utf8');
  const topViews = readFileSync(new URL('../../src/app/components/layout/TopTabHeader.tsx', import.meta.url), 'utf8');

  assert.match(bottomNav, /text-blue-700/);
  assert.match(bottomNav, /text-neutral-600/);
  assert.match(topViews, /text-neutral-500/);
});

test('calendar placeholders are non-interactive while date buttons remain named', () => {
  const calendarGrid = readFileSync(new URL('../../src/features/calendar/components/CalendarMonthGrid.tsx', import.meta.url), 'utf8');

  assert.match(calendarGrid, /return <div key=\{date\.key\}[^>]+aria-hidden="true"/);
  assert.match(calendarGrid, /aria-label=\{`\$\{date\.year\}년 \$\{date\.month\}월 \$\{day\}일`\}/);
});
