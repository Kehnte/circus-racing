// DataGridOverlays — shared NoRowsOverlay and NoColumnsOverlay for all DataGrids.

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { styled } from '@mui/material/styles';
import { GridPreferencePanelsValue, useGridApiContext } from '@mui/x-data-grid';

const StyledOverlay = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  height: '100%',
  '& .overlay-primary': {
    fill: '#3D4751',
    ...theme.applyStyles('light', { fill: '#AEB8C2' }),
  },
  '& .overlay-secondary': {
    fill: '#1D2126',
    ...theme.applyStyles('light', { fill: '#E8EAED' }),
  },
}));

export function NoRowsOverlay() {
  return (
    <StyledOverlay>
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" width={96} viewBox="0 0 452 257" aria-hidden focusable="false">
        <path className="overlay-primary" d="M348 69c-46.392 0-84 37.608-84 84s37.608 84 84 84 84-37.608 84-84-37.608-84-84-84Zm-104 84c0-57.438 46.562-104 104-104s104 46.562 104 104-46.562 104-104 104-104-46.562-104-104Z" />
        <path className="overlay-primary" d="M308.929 113.929c3.905-3.905 10.237-3.905 14.142 0l63.64 63.64c3.905 3.905 3.905 10.236 0 14.142-3.906 3.905-10.237 3.905-14.142 0l-63.64-63.64c-3.905-3.905-3.905-10.237 0-14.142Z" />
        <path className="overlay-primary" d="M308.929 191.711c-3.905-3.906-3.905-10.237 0-14.142l63.64-63.64c3.905-3.905 10.236-3.905 14.142 0 3.905 3.905 3.905 10.237 0 14.142l-63.64 63.64c-3.905 3.905-10.237 3.905-14.142 0Z" />
        <path className="overlay-secondary" d="M0 10C0 4.477 4.477 0 10 0h380c5.523 0 10 4.477 10 10s-4.477 10-10 10H10C4.477 20 0 15.523 0 10ZM0 59c0-5.523 4.477-10 10-10h231c5.523 0 10 4.477 10 10s-4.477 10-10 10H10C4.477 69 0 64.523 0 59ZM0 106c0-5.523 4.477-10 10-10h203c5.523 0 10 4.477 10 10s-4.477 10-10 10H10c-5.523 0-10-4.477-10-10ZM0 153c0-5.523 4.477-10 10-10h195.5c5.523 0 10 4.477 10 10s-4.477 10-10 10H10c-5.523 0-10-4.477-10-10ZM0 200c0-5.523 4.477-10 10-10h203c5.523 0 10 4.477 10 10s-4.477 10-10 10H10c-5.523 0-10-4.477-10-10ZM0 247c0-5.523 4.477-10 10-10h231c5.523 0 10 4.477 10 10s-4.477 10-10 10H10c-5.523 0-10-4.477-10-10Z" />
      </svg>
      <Box sx={{ mt: 2 }}>No rows</Box>
    </StyledOverlay>
  );
}

export function NoColumnsOverlay() {
  const apiRef = useGridApiContext();
  return (
    <StyledOverlay>
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" width={96} viewBox="0 0 370 260" aria-hidden focusable="false">
        <path className="overlay-secondary" d="M10 0c5.523 0 10 4.477 10 10v240c0 5.523-4.477 10-10 10s-10-4.477-10-10V10C0 4.477 4.477 0 10 0Zm50 0c5.523 0 10 4.477 10 10v240c0 5.523-4.477 10-10 10s-10-4.477-10-10V10c0-5.523 4.477-10 10-10Zm50 0c5.523 0 10 4.477 10 10v46c0 5.523-4.477 10-10 10s-10-4.477-10-10V10c0-5.523 4.477-10 10-10Zm50 0c5.523 0 10 4.477 10 10v19c0 5.523-4.477 10-10 10s-10-4.477-10-10V10c0-5.523 4.477-10 10-10Zm50 0c5.523 0 10 4.477 10 10v19c0 5.523-4.477 10-10 10s-10-4.477-10-10V10c0-5.523 4.477-10 10-10Zm50 0c5.523 0 10 4.477 10 10v46c0 5.523-4.477 10-10 10s-10-4.477-10-10V10c0-5.523 4.477-10 10-10Zm50 0c5.523 0 10 4.477 10 10v240c0 5.523-4.477 10-10 10s-10-4.477-10-10V10c0-5.523 4.477-10 10-10Zm50 0c5.523 0 10 4.477 10 10v240c0 5.523-4.477 10-10 10s-10-4.477-10-10V10c0-5.523 4.477-10 10-10ZM110 194c5.523 0 10 4.477 10 10v46c0 5.523-4.477 10-10 10s-10-4.477-10-10v-46c0-5.523 4.477-10 10-10Zm150 0c5.523 0 10 4.477 10 10v46c0 5.523-4.477 10-10 10s-10-4.477-10-10v-46c0-5.523 4.477-10 10-10Zm-100 27c5.523 0 10 4.477 10 10v19c0 5.523-4.477 10-10 10s-10-4.477-10-10v-19c0-5.523 4.477-10 10-10Zm50 0c5.523 0 10 4.477 10 10v19c0 5.523-4.477 10-10 10s-10-4.477-10-10v-19c0-5.523 4.477-10 10-10Z" />
        <path className="overlay-primary" d="M185 71c-32.585 0-59 26.415-59 59s26.415 59 59 59 59-26.415 59-59-26.415-59-59-59Zm-79 59c0-43.63 35.37-79 79-79s79 35.37 79 79c0 43.631-35.37 79-79 79s-79-35.369-79-79Zm109.296-30.56c3.905 3.905 3.905 10.236 0 14.142l-16.286 16.286 16.286 16.286c3.905 3.905 3.905 10.237 0 14.142-3.905 3.905-10.237 3.905-14.142 0l-16.286-16.286-16.286 16.286c-3.905 3.905-10.237 3.905-14.142 0-3.906-3.905-3.906-10.237 0-14.142l16.286-16.286-16.286-16.286c-3.906-3.905-3.906-10.237 0-14.142 3.905-3.906 10.237-3.906 14.142 0l16.286 16.286 16.286-16.286c3.905-3.906 10.237-3.906 14.142 0Z" />
      </svg>
      <Stack sx={{ mt: 2 }} gap={1}>
        No columns
        <Button size="small" onClick={() => apiRef.current.showPreferences(GridPreferencePanelsValue.columns)}>
          Manage columns
        </Button>
      </Stack>
    </StyledOverlay>
  );
}
