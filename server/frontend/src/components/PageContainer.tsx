// PageContainer — h4 title, right-aligned action slot, responsive maxWidth centering.

import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

interface PageContainerProps {
  title?: string;
  actions?: ReactNode;
  children?: ReactNode;
}

export default function PageContainer({ title, actions, children }: PageContainerProps) {
  return (
    <Container sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }} disableGutters>
      <Stack sx={{ flex: 1, my: 2, minHeight: 0 }} spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
          {title && <Typography variant="h4">{title}</Typography>}
          {actions && <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>{actions}</Box>}
        </Stack>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {children}
        </Box>
      </Stack>
    </Container>
  );
}
