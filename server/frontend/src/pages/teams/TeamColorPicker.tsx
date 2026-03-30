// TeamColorPicker — grid of Material Design 2 color swatches (300 shade) for team color selection.

import Box from '@mui/material/Box';
import FormHelperText from '@mui/material/FormHelperText';
import Paper from '@mui/material/Paper';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

const COLORS = [
  { label: 'Red',         value: '#E57373' },
  { label: 'Pink',        value: '#F06292' },
  { label: 'Purple',      value: '#BA68C8' },
  { label: 'Deep Purple', value: '#9575CD' },
  { label: 'Indigo',      value: '#7986CB' },
  { label: 'Blue',        value: '#64B5F6' },
  { label: 'Light Blue',  value: '#4FC3F7' },
  { label: 'Cyan',        value: '#4DD0E1' },
  { label: 'Teal',        value: '#4DB6AC' },
  { label: 'Green',       value: '#81C784' },
  { label: 'Light Green', value: '#AED581' },
  { label: 'Lime',        value: '#DCE775' },
  { label: 'Yellow',      value: '#FFF176' },
  { label: 'Amber',       value: '#FFD54F' },
  { label: 'Orange',      value: '#FFB74D' },
  { label: 'Deep Orange', value: '#FF8A65' },
  { label: 'Brown',       value: '#A1887F' },
  { label: 'Blue Grey',   value: '#90A4AE' },
];

interface Props {
  value: string;
  onChange: (color: string) => void;
  error?: boolean;
  helperText?: string;
}

export default function TeamColorPicker({ value, onChange, error, helperText }: Props) {
  return (
    <Box sx={{ width: '100%' }}>
      <Paper
        variant="outlined"
        tabIndex={0}
        sx={{
          px: 1.75,
          pt: 1,
          pb: 1.25,
          borderColor: error ? 'error.main' : '#9E9E9E',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderRadius: 1,
          transition: 'none',
          '&:hover': { borderColor: error ? 'error.main' : 'common.white' },
          '&:focus-within': {
            borderColor: error ? 'error.main' : 'primary.main',
            boxShadow: (theme) => `inset 0 0 0 1px ${error ? theme.palette.error.main : theme.palette.primary.main}`,
          },
        }}
      >
        <Typography
          component="label"
          variant="caption"
          sx={{ color: error ? 'error.main' : 'text.secondary', display: 'block', mb: 1 }}
        >
          Color
        </Typography>
        <ToggleButtonGroup
          value={value}
          exclusive
          onChange={(_, v) => { if (v !== null) onChange(v); }}
          sx={{ flexWrap: 'wrap', gap: 1, border: 'none' }}
        >
          {COLORS.map((c) => (
            <Tooltip key={c.value} title={c.label} placement="top">
              <ToggleButton
                value={c.value}
                sx={{
                  width: 32,
                  height: 32,
                  minWidth: 32,
                  p: 0,
                  border: '2px solid transparent !important',
                  borderRadius: '50% !important',
                  bgcolor: c.value,
                  '&:hover': { bgcolor: c.value, opacity: 0.85 },
                  '&.Mui-selected': {
                    bgcolor: c.value,
                    outline: '2px solid',
                    outlineColor: 'text.primary',
                    outlineOffset: '2px',
                    '&:hover': { bgcolor: c.value },
                  },
                }}
              />
            </Tooltip>
          ))}
        </ToggleButtonGroup>
      </Paper>
      <FormHelperText error={error} sx={{ mx: '14px' }}>
        {helperText ?? ' '}
      </FormHelperText>
    </Box>
  );
}
