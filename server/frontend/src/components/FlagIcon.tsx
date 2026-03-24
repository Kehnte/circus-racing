// FlagIcon — Renders a square 1:1 flag from flag-icons with a tooltip showing the country name.

import Tooltip from '@mui/material/Tooltip';
import { findCountry } from '../utils/countries.ts';

interface Props {
  code: string;
  size?: number;
}

export default function FlagIcon({ code, size = 16 }: Props) {
  const name = findCountry(code)?.name ?? code.toUpperCase();
  return (
    <Tooltip title={name} placement="bottom" arrow>
      <span
        className={`fi fi-${code.toLowerCase()} fis`}
        style={{ width: size, height: size, borderRadius: 2, flexShrink: 0, display: 'inline-block', cursor: 'default' }}
      />
    </Tooltip>
  );
}
