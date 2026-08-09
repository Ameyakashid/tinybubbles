import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { ActivityIndicator, Text } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

import type { ThemeColors } from '@/hooks/use-theme-colors';

import {
  RecoverySnapshotsCard,
  SyncBackupSection,
  SyncPreferencesCard,
} from './sync-settings-sections';

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
  handleAddGettingStartedContent: noop,
  handleBackup: noop,
  handleImportDgt: noop,
  handleImportMindwtrCsv: noop,
  handleImportOmniFocus: noop,
  handleImportTickTick: noop,
  handleImportTodoist: noop,
  handleMergeBackup: noop,
  handleRestoreBackup: noop,
  isBackupBusy: false,
  isGettingStartedDisabled: false,
  isGettingStartedBusy: false,
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

  it('offers Getting Started recovery from the normal folded data-transfer section', () => {
    const handleAddGettingStartedContent = vi.fn();
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <SyncBackupSection
          {...baseProps}
          handleAddGettingStartedContent={handleAddGettingStartedContent}
        />,
      );
    });

    act(() => {
      tree.root.findByProps({ testID: 'data-transfer-disclosure' }).props.onPress();
    });

    expect(renderedText(tree)).toContain('settings.gettingStartedContentAction');
    expect(renderedText(tree)).toContain('settings.gettingStartedContentDesc');
    act(() => {
      tree.root.findByProps({ testID: 'add-getting-started-content' }).props.onPress();
    });
    expect(handleAddGettingStartedContent).toHaveBeenCalledTimes(1);
  });

  it('exposes the Getting Started action as a disabled button without a false busy spinner', () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <SyncBackupSection
          {...baseProps}
          isGettingStartedDisabled
          isGettingStartedBusy={false}
        />,
      );
    });
    act(() => {
      tree.root.findByProps({ testID: 'data-transfer-disclosure' }).props.onPress();
    });

    const action = tree.root.findByProps({ testID: 'add-getting-started-content' });
    expect(action.props.accessibilityRole).toBe('button');
    expect(action.props.accessibilityState).toEqual({ busy: false, disabled: true });
    expect(action.props.disabled).toBe(true);
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(0);
  });
});

describe('sync settings disclosure accessibility', () => {
  it('exposes recovery snapshots as a collapsed button and hides its decorative chevron', () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <RecoverySnapshotsCard
          backupAction={null}
          formatRecoverySnapshotLabel={(name) => name}
          handleRestoreRecoverySnapshot={noop}
          isBackupBusy={false}
          isLoadingRecoverySnapshots={false}
          isSyncing={false}
          recoverySnapshots={[]}
          recoverySnapshotsOpen={false}
          setRecoverySnapshotsOpen={noop}
          tr={translate}
          t={translate}
          tc={tc}
        />,
      );
    });

    const disclosure = tree.root.findByProps({ testID: 'recovery-snapshots-disclosure' });
    expect(disclosure.props.accessibilityRole).toBe('button');
    expect(disclosure.props.accessibilityState).toEqual({ expanded: false });
    const chevron = tree.root.findByProps({ testID: 'recovery-snapshots-chevron' });
    expect(chevron.props.accessible).toBe(false);
    expect(chevron.props.accessibilityElementsHidden).toBe(true);
    expect(chevron.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('exposes sync preferences as an expanded button and hides its decorative chevron', () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <SyncPreferencesCard
          syncAiEnabled={false}
          syncAppearanceEnabled={false}
          syncExternalCalendarsEnabled={false}
          syncGtdEnabled={false}
          syncLanguageEnabled={false}
          syncOptionsOpen
          syncSavedFiltersEnabled={false}
          t={translate}
          tc={tc}
          toggleSyncOptionsOpen={noop}
          updateSyncPreferences={noop}
        />,
      );
    });

    const disclosure = tree.root.findByProps({ testID: 'sync-preferences-disclosure' });
    expect(disclosure.props.accessibilityRole).toBe('button');
    expect(disclosure.props.accessibilityState).toEqual({ expanded: true });
    const chevron = tree.root.findByProps({ testID: 'sync-preferences-chevron' });
    expect(chevron.props.accessible).toBe(false);
    expect(chevron.props.accessibilityElementsHidden).toBe(true);
    expect(chevron.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});
