import type { AppAnnouncement, AppAnnouncementAction } from '@mindwtr/core';
import { AppAnnouncementModal } from './AppAnnouncementModal';

/**
 * One startup prompt's presentation: which announcement to show and what its
 * action button does. `useStartupPromptQueue` (packages/core) owns precedence
 * and ever selects at most one `id` as open; this component just renders
 * whichever one that is behind a single shared gate.
 */
export type StartupPromptPresentation = {
    id: string;
    announcement: AppAnnouncement | null;
    onAction: (action: AppAnnouncementAction) => void;
    onDismiss: () => void;
    onShown?: () => void;
};

type StartupPromptModalProps = {
    /** `useStartupPromptQueue(...).openId` — the prompt currently selected, or null. */
    openId: string | null;
    /** True while another modal (onboarding, close prompt, external sync) owns the screen. */
    blocked: boolean;
    prompts: StartupPromptPresentation[];
};

const noop = () => {};

export function StartupPromptModal({ openId, blocked, prompts }: StartupPromptModalProps) {
    const active = prompts.find((prompt) => prompt.id === openId) ?? null;
    return (
        <AppAnnouncementModal
            announcement={active?.announcement ?? null}
            isOpen={active !== null && !blocked}
            onAction={active?.onAction ?? noop}
            onDismiss={active?.onDismiss ?? noop}
            onShown={active?.onShown}
        />
    );
}
