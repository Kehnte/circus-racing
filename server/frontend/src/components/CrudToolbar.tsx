// CrudToolbar — shared DataGrid toolbar with filters, density, export, import, quick search and open-in-new-window.

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import {
  GridToolbarColumnsButton,
  GridToolbarContainer,
  GridToolbarDensitySelector,
  GridToolbarExport,
  GridToolbarFilterButton,
  GridToolbarQuickFilter,
} from '@mui/x-data-grid';
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined';
import UploadFileOutlined from '@mui/icons-material/UploadFileOutlined';
// Extend MUI DataGrid's toolbar slot props so slotProps.toolbar accepts onImportJson and standaloneKey.
declare module '@mui/x-data-grid' {
  interface ToolbarPropsOverrides {
    onImportJson?: () => void;
    standaloneKey?: string;
  }
}

interface Props {
  onImportJson?: () => void;
  standaloneKey?: string;
}

const STANDALONE_SEGMENTS = ['pilots', 'teams', 'vehicles', 'controls', 'telemetry', 'races'];

export default function CrudToolbar({ onImportJson, standaloneKey }: Props) {
  const base = '/dashboard';
  const segment = location.pathname.slice(base.length).replace(/^\//, '').split('/')[0];
  // Empty segment = index route (dashboard itself); standaloneKey overrides auto-detection.
  const resolvedSegment = standaloneKey ?? (segment === '' ? 'dashboard' : segment);
  const canPopOut = [...STANDALONE_SEGMENTS, 'dashboard'].includes(resolvedSegment);

  return (
    <GridToolbarContainer>
      <GridToolbarColumnsButton />
      <GridToolbarFilterButton />
      <GridToolbarDensitySelector />
      <GridToolbarExport />
      {onImportJson && (
        <Button size="small" startIcon={<UploadFileOutlined />} onClick={onImportJson}>
          Import
        </Button>
      )}
      {canPopOut && (
        <Button size="small" startIcon={<OpenInNewOutlined />} onClick={() => {
          window.open(`${location.origin}${base}/standalone/${resolvedSegment}${location.search}`);
        }}>
          Pop out
        </Button>
      )}
      <Box sx={{ flex: 1 }} />
      <GridToolbarQuickFilter />
    </GridToolbarContainer>
  );
}
