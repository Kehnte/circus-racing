// theme.ts — MUI dark theme for the monitor UI.

import { createTheme } from '@mui/material/styles';

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
      paper: '#2B2B2B',
    },
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
});

export default theme;
