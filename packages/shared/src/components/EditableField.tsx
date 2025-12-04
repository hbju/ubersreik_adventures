import React, { useState, useRef, useEffect } from 'react';
import './EditableField.css';

interface EditableFieldProps {
    value: string | number;
    onChange: (value: string | number) => void;
    isEditing: boolean;
    type?: 'text' | 'number';
    className?: string;
    inputClassName?: string;
    min?: number;
    max?: number;
    placeholder?: string;
    multiline?: boolean;
    rows?: number;
}

/**
 * A field component that displays text normally and becomes editable when isEditing is true.
 * Automatically submits changes on blur or Enter key.
 */
const EditableField: React.FC<EditableFieldProps> = ({
    value,
    onChange,
    isEditing,
    type = 'text',
    className = '',
    inputClassName = '',
    min,
    max,
    placeholder = '',
    multiline = false,
    rows = 2,
}) => {
    const [localValue, setLocalValue] = useState<string | number>(value);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

    // Sync local value when prop changes
    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    // Focus input when entering edit mode
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditing]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const newValue = type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
        setLocalValue(newValue);
    };

    const handleBlur = () => {
        let finalValue = localValue;
        
        if (type === 'number') {
            let numValue = typeof finalValue === 'string' ? parseFloat(finalValue) || 0 : finalValue;
            if (min !== undefined) numValue = Math.max(min, numValue);
            if (max !== undefined) numValue = Math.min(max, numValue);
            finalValue = numValue;
        }
        
        if (finalValue !== value) {
            onChange(finalValue);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !multiline) {
            e.preventDefault();
            (e.target as HTMLElement).blur();
        }
        if (e.key === 'Escape') {
            setLocalValue(value);
            (e.target as HTMLElement).blur();
        }
    };

    if (!isEditing) {
        const displayValue = type === 'number' && value === 0 ? '—' : value;
        return (
            <span className={`editable-field-display ${className}`}>
                {displayValue || placeholder || '—'}
            </span>
        );
    }

    if (multiline) {
        return (
            <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={localValue}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className={`editable-field-input editable-field-textarea ${inputClassName}`}
                placeholder={placeholder}
                rows={rows}
            />
        );
    }

    return (
        <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={type}
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={`editable-field-input ${inputClassName}`}
            min={min}
            max={max}
            placeholder={placeholder}
        />
    );
};

export default EditableField;
