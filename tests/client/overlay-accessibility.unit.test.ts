import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { handleOverlayOpenChange, shouldPreventOverlayDismiss } from '../../src/app/components/overlay/overlay-behavior';

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

test('shared overlays retain Radix modal, title, focus, and dismissal semantics', () => {
  for (const relativePath of [
    '../../src/app/components/overlay/CenteredModalShell.tsx',
    '../../src/app/components/overlay/BottomSheet.tsx',
  ]) {
    const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
    assert.match(source, /<Dialog\.Root modal open/);
    assert.match(source, /<Dialog\.Portal>/);
    assert.match(source, /<Dialog\.Title/);
    assert.match(source, /aria-modal="true"/);
    assert.match(source, /onEscapeKeyDown/);
    assert.match(source, /onPointerDownOutside/);
    assert.match(source, /onOpenAutoFocus/);
    assert.match(source, /onCloseAutoFocus/);
    assert.match(source, /restoreFocusRef\.current\?\.focus\(\)/);
    assert.match(source, /restoreTarget\?\.isConnected/);
  }
});

test('Home and shared navigation expose landmark and current-view semantics', () => {
  const home = readFileSync(new URL('../../src/features/home/HomeScreen.tsx', import.meta.url), 'utf8');
  const bottomNav = readFileSync(new URL('../../src/app/components/layout/BottomTabBar.tsx', import.meta.url), 'utf8');
  const topTabs = readFileSync(new URL('../../src/app/components/layout/TopTabHeader.tsx', import.meta.url), 'utf8');

  assert.match(home, /<main className=/);
  assert.match(bottomNav, /<nav aria-label="주요 메뉴"/);
  assert.match(bottomNav, /aria-current=/);
  assert.match(bottomNav, /aria-label="운동 기록 시작"/);
  assert.match(topTabs, /role="tablist"/);
  assert.match(topTabs, /role="tab"/);
  assert.match(topTabs, /aria-selected=/);
});
