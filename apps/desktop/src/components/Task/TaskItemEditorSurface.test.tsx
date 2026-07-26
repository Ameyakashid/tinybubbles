import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TaskItemEditorSurface } from './TaskItemEditorSurface';

const baseProps = {
    editorAriaLabel: 'Edit task',
    getModalFocusableElements: () => [],
    isEditing: true,
    isModalEditor: false,
    modalEditorRef: createRef<HTMLDivElement>(),
    onCancel: vi.fn(),
    renderDisplay: () => <div>display</div>,
    renderEditor: () => <div data-testid="editor">editor</div>,
};

const createDataTransfer = (types: string[], files: File[] = []) =>
    ({ types, files }) as unknown as DataTransfer;

describe('TaskItemEditorSurface file drop', () => {
    it('ignores a task drag (non-Files dataTransfer types) so calendar/sidebar dragging still works', () => {
        const onFilesDropped = vi.fn();
        render(<TaskItemEditorSurface {...baseProps} onFilesDropped={onFilesDropped} />);
        const container = screen.getByTestId('editor').parentElement!;

        const dataTransfer = createDataTransfer(['application/x-mindwtr-task']);
        fireEvent.dragOver(container, { dataTransfer });
        fireEvent.drop(container, { dataTransfer });

        expect(onFilesDropped).not.toHaveBeenCalled();
    });

    it('attaches OS files dropped onto the editor', () => {
        const onFilesDropped = vi.fn();
        const file = new File(['hi'], 'a.txt');
        render(<TaskItemEditorSurface {...baseProps} onFilesDropped={onFilesDropped} />);
        const container = screen.getByTestId('editor').parentElement!;

        const dataTransfer = createDataTransfer(['Files'], [file]);
        fireEvent.dragOver(container, { dataTransfer });
        fireEvent.drop(container, { dataTransfer });

        expect(onFilesDropped).toHaveBeenCalledWith([file]);
    });
});
