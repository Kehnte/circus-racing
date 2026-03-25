// theme.ts — MUI dark theme for the dashboard UI.

import { createTheme } from '@mui/material/styles';
import type {} from '@mui/x-data-grid/themeAugmentation';

const BORDER = '1px solid #9E9E9E';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#FFD54F',
      contrastText: '#131314',
    },
    success: {
      main: '#4FFFD6',
      contrastText: '#131314',
    },
    warning: {
      main: '#FF7E4F',
      contrastText: '#131314',
    },
    error: {
      main: '#E57373',
      contrastText: '#131314',
    },
    background: {
      default: '#212121',
      paper: '#212121',
    },
    divider: '#9E9E9E',
    text: {
      primary: '#FAFAFA',
    },
  },
  shape: {
    borderRadius: 0,
  },
  typography: {
    fontFamily: 'Montserrat, sans-serif',
    fontWeightRegular: 500,
    overline: {
      lineHeight: 3.2,
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: { border: BORDER },
      },
    },
    // AppBar spans the full viewport top — no outer border, just a bottom separator.
    MuiAppBar: {
      styleOverrides: {
        root: { border: 'none', borderBottom: BORDER },
      },
    },
    // Drawer flush against the left edge — only the right side acts as a separator.
    MuiDrawer: {
      styleOverrides: {
        paper: { border: 'none', borderRight: BORDER },
      },
    },
    MuiDataGrid: {
      styleOverrides: {
        root: {
          '--DataGrid-rowBorderColor': '#9E9E9E',
          '--DataGrid-columnSeparatorColor': '#9E9E9E',
          borderColor: '#9E9E9E',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        notchedOutline: { borderColor: '#9E9E9E' },
      },
    },
    // Ensure the floating label is visible against both background colors.
    MuiInputLabel: {
      styleOverrides: {
        root: { color: 'rgba(255,255,255,0.7)' },
      },
    },
  },
});

export default theme;
