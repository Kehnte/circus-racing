// CountrySelect — autocomplete input for selecting a country by code or name, with flag preview.

import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import FlagIcon from './FlagIcon.tsx';
import { COUNTRIES, findCountry, resolveCountryCode } from '../utils/countries.ts';
import type { Country } from '../utils/countries.ts';

interface CountrySelectProps {
  value: string;
  onChange: (code: string) => void;
  error?: boolean;
  helperText?: string;
}

export default function CountrySelect({ value, onChange, error, helperText }: CountrySelectProps) {
  return (
    <Autocomplete<Country, false, false, true> fullWidth
      options={COUNTRIES}
      freeSolo
      value={findCountry(value) ?? null}
      getOptionLabel={(o) => typeof o === 'string' ? o : o.name}
      filterOptions={(opts, { inputValue }) => {
        const q = inputValue.toLowerCase();
        return opts.filter(
          (o) => o.code.startsWith(q) || o.name.toLowerCase().includes(q)
        );
      }}
      onChange={(_, v) => {
        if (!v) { onChange('un'); return; }
        if (typeof v === 'string') { onChange(resolveCountryCode(v)); return; }
        onChange(v.code);
      }}
      renderOption={(props, o) => (
        <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <FlagIcon code={o.code} size={18} />
          <span>{o.name}</span>
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Country"
          error={error}
          helperText={helperText}
          slotProps={{
            input: {
              ...params.InputProps,
              startAdornment: value && value !== 'un'
                ? <Box sx={{ mr: 0.5, display: 'flex', alignItems: 'center' }}><FlagIcon code={value} size={16} /></Box>
                : null,
            },
          }}
        />
      )}
    />
  );
}
