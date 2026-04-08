// theme.ts — MUI dark theme for the dashboard UI.

import { createTheme } from '@mui/material/styles';
import type {} from '@mui/x-data-grid/themeAugmentation';

const N950 = '#0a0a0a';
const N900 = '#171717';
const N800 = '#262626';
const N700 = '#404040';
const N600 = '#525252';
const N400 = '#a3a3a3';
const N200 = '#e5e5e5';

const BORDER = `1px solid ${N800}`;

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: N200,
      contrastText: N900,
    },
    success: {
      main: '#22c55e',
      contrastText: N900,
    },
    warning: {
      main: '#f97316',
      contrastText: N900,
    },
    error: {
      main: '#ef4444',
      contrastText: N200,
    },
    background: {
      default: N950,
      paper: N900,
    },
    divider: N800,
    text: {
      primary: N200,
      secondary: N400,
    },
  },
  shape: {
    borderRadius: 6,
  },
  typography: {
    fontFamily: '"Noto Sans", sans-serif',
    fontWeightRegular: 400,
    overline: {
      lineHeight: 3.2,
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: { border: BORDER, backgroundImage: 'none' },
      },
    },
    // AppBar spans the full viewport top — no outer border, just a bottom separator.
    MuiAppBar: {
      styleOverrides: {
        root: { borderRadius: 0, border: 'none', borderBottom: BORDER },
      },
    },
    // Drawer flush against the left edge — only the right side acts as a separator.
    MuiDrawer: {
      styleOverrides: {
        paper: { borderRadius: 0, border: 'none', borderRight: BORDER },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          backgroundColor: N900,
          backgroundImage: 'none',
          border: BORDER,
          borderRadius: '6px !important',
          '&:before': { display: 'none' },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        containedPrimary: {
          backgroundColor: N200,
          color: N900,
          '&:hover': { backgroundColor: '#d4d4d4' },
        },
        outlinedPrimary: {
          backgroundColor: N800,
          borderColor: N700,
          color: N200,
          '&:hover': { backgroundColor: N700, borderColor: N600 },
        },
        // Success: green-950 bg, green-400 text, green-900 border
        containedSuccess: {
          backgroundColor: '#052e16',
          color: '#4ade80',
          border: '1px solid #14532d',
          '&:hover': { backgroundColor: '#14532d' },
        },
        outlinedSuccess: {
          backgroundColor: '#052e16',
          color: '#4ade80',
          borderColor: '#14532d',
          '&:hover': { backgroundColor: '#14532d' },
        },
        // Warning: orange-950 bg, orange-400 text, orange-900 border
        containedWarning: {
          backgroundColor: '#431407',
          color: '#fb923c',
          border: '1px solid #7c2d12',
          '&:hover': { backgroundColor: '#7c2d12' },
        },
        outlinedWarning: {
          backgroundColor: '#431407',
          color: '#fb923c',
          borderColor: '#7c2d12',
          '&:hover': { backgroundColor: '#7c2d12' },
        },
        // Destructive: red-950 bg, red-400 text, red-900 border
        containedError: {
          backgroundColor: '#450a0a',
          color: '#f87171',
          border: '1px solid #7f1d1d',
          '&:hover': { backgroundColor: '#7f1d1d' },
        },
        outlinedError: {
          backgroundColor: '#450a0a',
          color: '#f87171',
          borderColor: '#7f1d1d',
          '&:hover': { backgroundColor: '#7f1d1d' },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        filled: {
          '&.MuiChip-colorSuccess': { backgroundColor: '#052e16', color: '#4ade80', border: '1px solid #14532d' },
          '&.MuiChip-colorWarning': { backgroundColor: '#431407', color: '#fb923c', border: '1px solid #7c2d12' },
          '&.MuiChip-colorError':   { backgroundColor: '#450a0a', color: '#f87171', border: '1px solid #7f1d1d' },
          '&.MuiChip-colorPrimary': { backgroundColor: N800, color: N200, border: BORDER },
        },
        outlined: {
          '&.MuiChip-colorSuccess': { borderColor: '#14532d', color: '#4ade80' },
          '&.MuiChip-colorWarning': { borderColor: '#7c2d12', color: '#fb923c' },
          '&.MuiChip-colorError':   { borderColor: '#7f1d1d', color: '#f87171' },
          '&.MuiChip-colorPrimary': { borderColor: N800, color: N200 },
        },
      },
    },
    MuiDataGrid: {
      styleOverrides: {
        root: {
          '--DataGrid-rowBorderColor': N800,
          '--DataGrid-columnSeparatorColor': N800,
          borderColor: N800,
          backgroundColor: N900,
        },
        columnHeaders: {
          backgroundColor: N900,
          backgroundImage: 'none',
          '--DataGrid-containerBackground': N900,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        notchedOutline: { borderColor: N800 },
      },
    },
    // Ensure the floating label is visible against both background colors.
    MuiInputLabel: {
      styleOverrides: {
        root: { color: N400 },
      },
    },
  },
});

export default theme;
