import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

import type { ThemeColors } from '@/hooks/use-theme-colors';

import { SyncBackupSection } from './sync-settings-sections';

const tc = {
  bg: '#0f172a',
  cardBg: '#111827',
  border: '#334155',
  text: '#f8fafc',
  secondaryText: '#94a3b8',
  tint: '#3b82f6',
} as unknown as ThemeColors;

const translate = (key: string) => key;
const noop = () => undefined;

const baseProps = {
  backupAction: null,
  handleBackup: noop,
  handleImportDgt: noop,
  handleImportMindwtrCsv: noop,
  handleImportOmniFocus: noop,
  handleImportTickTick: noop,
  handleImportTodoist: noop,
  handleMergeBackup: noop,
  handleRestoreBackup: noop,
  isBackupBusy: false,
  isSyncing: false,
  tr: translate,
  t: translate,
  tc,
} as const;

const renderedText = (tree: renderer.ReactTestRenderer): string[] =>
  tree.root
    .findAllByType(Text)
    .map((node) => node.props.children)
    .filter((child): child is string => typeof child === 'string');

describe('SyncBackupSection', () => {
  it('starts folded, showing only the disclosure header', () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<SyncBackupSection {...baseProps} />);
    });

    const header = tree.root.findByProps({ testID: 'data-transfer-disclosure' });
    expect(header.props.accessibilityState).toEqual({ expanded: false });
    const texts = renderedText(tree);
    expect(texts).toContain('settings.dataTransfer');
    expect(texts).not.toContain('settings.exportBackup');
    expect(texts).not.toContain('settings.syncMobile.importFromTodoist');
  });

  it('reveals the transfer rows when the header is pressed', () => {
    const handleBackup = vi.fn();
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<SyncBackupSection {...baseProps} handleBackup={handleBackup} />);
    });

    act(() => {
      tree.root.findByProps({ testID: 'data-transfer-disclosure' }).props.onPress();
    });

    const header = tree.root.findByProps({ testID: 'data-transfer-disclosure' });
    expect(header.props.accessibilityState).toEqual({ expanded: true });
    const texts = renderedText(tree);
    expect(texts).toContain('settings.exportBackup');
    expect(texts).toContain('settings.syncMobile.importFromMindwtrCsv');

    act(() => {
      tree.root.findAllByProps({ onPress: handleBackup })[0].props.onPress();
    });
    expect(handleBackup).toHaveBeenCalledTimes(1);
  });
});
