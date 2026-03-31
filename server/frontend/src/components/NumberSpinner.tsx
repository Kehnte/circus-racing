// NumberSpinner — compact number input with increment/decrement buttons.

import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import FormHelperText from '@mui/material/FormHelperText';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import InputLabel from '@mui/material/InputLabel';
import AddOutlined from '@mui/icons-material/AddOutlined';
import RemoveOutlined from '@mui/icons-material/RemoveOutlined';

interface Props {
  label?: string;
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  size?: 'medium' | 'small';
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  onChange?: (value: number) => void;
  onCommit?: (value: number) => void;
}

export default function NumberSpinner({
  label,
  value: controlledValue,
  defaultValue = 1,
  min,
  max,
  size = 'medium',
  disabled = false,
  error = false,
  helperText,
  onChange,
  onCommit,
}: Props) {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [draft, setDraft] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const current = isControlled ? controlledValue : internalValue;

  useEffect(() => {
    if (isControlled) setDraft(null);
  }, [controlledValue, isControlled]);

  function clamp(v: number) {
    let out = v;
    if (min !== undefined) out = Math.max(min, out);
    if (max !== undefined) out = Math.min(max, out);
    return out;
  }

  function commit(v: number) {
    const clamped = clamp(v);
    if (!isControlled) setInternalValue(clamped);
    setDraft(null);
    onChange?.(clamped);
    onCommit?.(clamped);
  }

  function step(delta: 1 | -1) {
    commit(current + delta);
  }

  const isSmall = size === 'small';
  const btnSize = isSmall ? 'small' : 'medium';
  const inputH = isSmall ? 28 : 36;
  const inputW = isSmall ? 38 : 52;
  const fontSize = isSmall ? 12 : 14;

  const outOfRange = error || (min !== undefined && current < min) || (max !== undefined && current > max);

  return (
    <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      {label && (
        <InputLabel shrink disabled={disabled} error={outOfRange} sx={{ mb: 0.25, lineHeight: 1.2 }}>
          {label}
        </InputLabel>
      )}
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          border: '1px solid',
          borderColor: outOfRange ? 'error.main' : 'divider',
          borderRadius: 1,
          overflow: 'hidden',
          height: inputH,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <IconButton
          size={btnSize}
          disabled={disabled || (min !== undefined && current <= min)}
          onClick={() => step(-1)}
          sx={{ borderRadius: 0, height: '100%', px: isSmall ? 0.5 : 1 }}
          tabIndex={-1}
        >
          <RemoveOutlined sx={{ fontSize: isSmall ? 14 : 18 }} />
        </IconButton>

        <InputBase
          inputRef={inputRef}
          type="text"
          inputMode="numeric"
          disabled={disabled}
          value={draft ?? current}
          onChange={(e) => {
            if (/^-?\d*$/.test(e.target.value)) setDraft(e.target.value);
          }}
          onBlur={() => {
            if (draft !== null) {
              const parsed = parseInt(draft, 10);
              commit(isNaN(parsed) ? current : parsed);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (draft !== null) {
                const parsed = parseInt(draft, 10);
                commit(isNaN(parsed) ? current : parsed);
              }
              inputRef.current?.blur();
            } else if (e.key === 'Escape') {
              setDraft(null);
              inputRef.current?.blur();
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              step(1);
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              step(-1);
            }
          }}
          inputProps={{
            style: {
              textAlign: 'center',
              padding: 0,
              width: inputW,
              fontSize,
              fontFamily: 'Roboto Mono, monospace',
            },
          }}
          sx={{
            borderLeft: '1px solid',
            borderRight: '1px solid',
            borderColor: 'divider',
          }}
        />

        <IconButton
          size={btnSize}
          disabled={disabled || (max !== undefined && current >= max)}
          onClick={() => step(1)}
          sx={{ borderRadius: 0, height: '100%', px: isSmall ? 0.5 : 1 }}
          tabIndex={-1}
        >
          <AddOutlined sx={{ fontSize: isSmall ? 14 : 18 }} />
        </IconButton>
      </Box>
      {helperText && (
        <FormHelperText error={outOfRange} sx={{ mt: 0.25 }}>
          {helperText}
        </FormHelperText>
      )}
    </Box>
  );
}
