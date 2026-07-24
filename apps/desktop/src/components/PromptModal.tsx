import { useEffect, useId, useState, type MouseEvent } from 'react';
import { normalizeTimeSpentMinutes } from '@mindwtr/core';
import { useLanguage } from '../contexts/language-context';
import { ModalPortal } from './ModalPortal';
import { AutocompleteTextInput } from './ui/AutocompleteTextInput';
import { Button } from './ui/Button';

interface PromptModalNumericField {
    label: string;
    defaultValue?: string;
    placeholder?: string;
}

interface PromptModalProps {
    isOpen: boolean;
    title: string;
    description?: string;
    placeholder?: string;
    defaultValue?: string;
    suggestions?: readonly string[];
    inputType?: 'text' | 'date' | 'datetime-local';
    allowEmptyConfirm?: boolean;
    browseLabel?: string;
    onBrowse?: () => Promise<string | null>;
    secondaryLabel?: string;
    onSecondary?: (value: string) => void;
    /** Optional secondary numeric field (e.g. time spent), rendered below the primary input. */
    numericField?: PromptModalNumericField;
    confirmLabel: string;
    cancelLabel: string;
    onConfirm: (value: string, numericValue?: number) => void;
    onCancel: () => void;
}

export function PromptModal({
    isOpen,
    title,
    description,
    placeholder,
    defaultValue,
    suggestions,
    inputType = 'text',
    allowEmptyConfirm = false,
    browseLabel,
    onBrowse,
    secondaryLabel,
    onSecondary,
    numericField,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
}: PromptModalProps) {
    const { t } = useLanguage();
    const [value, setValue] = useState(defaultValue ?? '');
    const [hasInteracted, setHasInteracted] = useState(false);
    const [numericDraft, setNumericDraft] = useState(numericField?.defaultValue ?? '');
    const titleId = useId();
    const descriptionId = useId();
    const validationId = useId();
    const numericFieldId = useId();

    useEffect(() => {
        if (isOpen) {
            setValue(defaultValue ?? '');
            setHasInteracted(false);
            setNumericDraft(numericField?.defaultValue ?? '');
        }
    }, [isOpen, defaultValue, numericField?.defaultValue]);
    const canConfirm = allowEmptyConfirm || value.trim().length > 0;
    const showValidation = !allowEmptyConfirm && hasInteracted && !canConfirm;
    // Only pass a second argument when numericField opted in — existing callers
    // that pass a single-arg onConfirm must keep seeing exactly one argument.
    const confirmWithValue = () => {
        if (numericField) {
            onConfirm(value, normalizeTimeSpentMinutes(Number(numericDraft)));
        } else {
            onConfirm(value);
        }
    };

    if (!isOpen) return null;

    // Keep the input focused while clicking footer buttons: the blur would
    // reveal the validation line and shift the buttons mid-click, so the
    // mouseup lands elsewhere and the first click gets swallowed.
    const keepInputFocus = (event: MouseEvent<HTMLButtonElement>) => event.preventDefault();

    return (
        <ModalPortal>
        <div
            className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[20vh] z-50"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            onClick={onCancel}
        >
            <div
                className="w-full max-w-md bg-popover text-popover-foreground rounded-xl border shadow-2xl overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-4 py-3 border-b">
                    <h3 id={titleId} className="font-semibold">{title}</h3>
                    {description && (
                        <p id={descriptionId} className="text-xs text-muted-foreground mt-1">
                            {description}
                        </p>
                    )}
                </div>
                <div className="p-4 space-y-3">
                    <AutocompleteTextInput
                        autoFocus
                        type={inputType}
                        value={value}
                        suggestions={suggestions ?? []}
                        onChange={(next) => {
                            setValue(next);
                            if (!hasInteracted) {
                                setHasInteracted(true);
                            }
                        }}
                        onBlur={() => setHasInteracted(true)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                e.preventDefault();
                                onCancel();
                            }
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                if (canConfirm) {
                                    confirmWithValue();
                                } else {
                                    setHasInteracted(true);
                                }
                            }
                        }}
                        placeholder={placeholder}
                        aria-invalid={showValidation}
                        aria-describedby={showValidation ? validationId : undefined}
                        className="w-full rounded-lg border border-border bg-card px-3 py-2 shadow-sm transition-colors focus:border-transparent focus:ring-2 focus:ring-primary"
                    />
                    {showValidation && (
                        <p id={validationId} className="text-xs text-destructive">
                            {t('common.validationRequired')}
                        </p>
                    )}
                    {numericField && (
                        <div className="flex flex-col gap-1">
                            <label htmlFor={numericFieldId} className="text-xs font-medium text-muted-foreground">
                                {numericField.label}
                            </label>
                            <input
                                id={numericFieldId}
                                type="text"
                                inputMode="numeric"
                                value={numericDraft}
                                onChange={(e) => setNumericDraft(e.target.value.replace(/[^0-9]/g, ''))}
                                placeholder={numericField.placeholder}
                                aria-label={numericField.label}
                                className="w-full rounded-lg border border-border bg-card px-3 py-2 shadow-sm transition-colors focus:border-transparent focus:ring-2 focus:ring-primary"
                            />
                        </div>
                    )}
                    <div className="flex justify-end gap-2">
                        {browseLabel && onBrowse && (
                            <Button
                                variant="secondary"
                                className="mr-auto"
                                onMouseDown={keepInputFocus}
                                onClick={() => {
                                    void onBrowse().then((picked) => {
                                        if (typeof picked === 'string' && picked) {
                                            setValue(picked);
                                            setHasInteracted(true);
                                        }
                                    });
                                }}
                            >
                                {browseLabel}
                            </Button>
                        )}
                        {secondaryLabel && onSecondary && (
                            <Button
                                variant="secondary"
                                onMouseDown={keepInputFocus}
                                onClick={() => {
                                    if (canConfirm) {
                                        onSecondary(value);
                                    } else {
                                        setHasInteracted(true);
                                    }
                                }}
                                disabled={!canConfirm}
                            >
                                {secondaryLabel}
                            </Button>
                        )}
                        <Button variant="secondary" onMouseDown={keepInputFocus} onClick={onCancel}>
                            {cancelLabel}
                        </Button>
                        <Button
                            onMouseDown={keepInputFocus}
                            onClick={() => {
                                if (canConfirm) {
                                    confirmWithValue();
                                } else {
                                    setHasInteracted(true);
                                }
                            }}
                            disabled={!canConfirm}
                        >
                            {confirmLabel}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
        </ModalPortal>
    );
}
