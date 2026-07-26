import { useState, type DragEvent, type ReactNode, type RefObject } from 'react';
import { cn } from '../../lib/utils';
import { ModalPortal } from '../ModalPortal';

type TaskItemEditorSurfaceProps = {
    editorAriaLabel: string;
    getModalFocusableElements: () => HTMLElement[];
    isEditing: boolean;
    isModalEditor: boolean;
    modalEditorRef: RefObject<HTMLDivElement | null>;
    onCancel: () => void;
    onFilesDropped?: (files: File[]) => void;
    renderDisplay: () => ReactNode;
    renderEditor: () => ReactNode;
};

const isFileDrag = (event: DragEvent) => Boolean(event.dataTransfer?.types.includes('Files'));

export function TaskItemEditorSurface({
    editorAriaLabel,
    getModalFocusableElements,
    isEditing,
    isModalEditor,
    modalEditorRef,
    onCancel,
    onFilesDropped,
    renderDisplay,
    renderEditor,
}: TaskItemEditorSurfaceProps) {
    // A task row being dragged for the calendar/sidebar also fires these
    // events on the editor underneath it; only react when the drag carries
    // OS files, and let everything else pass through untouched.
    const [isFileDragOver, setIsFileDragOver] = useState(false);

    const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
        if (!onFilesDropped || !isFileDrag(event)) return;
        event.preventDefault();
        setIsFileDragOver(true);
    };

    // dragleave also fires when the pointer crosses into a child of the
    // editor, which would flicker the ring off for the whole drag.
    const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) return;
        setIsFileDragOver(false);
    };

    const handleDrop = (event: DragEvent<HTMLDivElement>) => {
        if (!onFilesDropped || !isFileDrag(event)) return;
        event.preventDefault();
        event.stopPropagation();
        setIsFileDragOver(false);
        const files = Array.from(event.dataTransfer.files);
        if (files.length > 0) onFilesDropped(files);
    };

    const modal = isEditing && isModalEditor ? (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-label={editorAriaLabel}
            onMouseDown={(event) => {
                if (event.target !== event.currentTarget) return;
                onCancel();
            }}
        >
            <div
                ref={modalEditorRef}
                tabIndex={-1}
                className={cn(
                    "w-[min(1100px,92vw)] max-h-[90vh] rounded-xl border border-border bg-card p-4 shadow-2xl",
                    isFileDragOver && "ring-2 ring-primary/50"
                )}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        onCancel();
                        return;
                    }
                    if (event.key !== 'Tab') return;
                    const focusable = getModalFocusableElements();
                    if (focusable.length === 0) return;
                    const first = focusable[0];
                    const last = focusable[focusable.length - 1];
                    const active = document.activeElement as HTMLElement | null;
                    if (!active || !focusable.includes(active)) {
                        event.preventDefault();
                        first.focus();
                        return;
                    }
                    if (event.shiftKey && active === first) {
                        event.preventDefault();
                        last.focus();
                        return;
                    }
                    if (!event.shiftKey && active === last) {
                        event.preventDefault();
                        first.focus();
                    }
                }}
            >
                {renderEditor()}
            </div>
        </div>
    ) : null;

    return (
        <>
            {isEditing && !isModalEditor ? (
                <div
                    className={cn("flex-1 min-w-0", isFileDragOver && "ring-2 ring-primary/50 rounded-md")}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    {renderEditor()}
                </div>
            ) : (
                renderDisplay()
            )}
            {modal && <ModalPortal>{modal}</ModalPortal>}
        </>
    );
}
