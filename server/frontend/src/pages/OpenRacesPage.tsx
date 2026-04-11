// OpenRacesPage — Standalone page showing open races enrollment grid.

import PageContainer from '../components/PageContainer.tsx';
import OpenRacesGrid from '../components/OpenRacesGrid.tsx';

export default function OpenRacesPage() {
  return (
    <PageContainer title="Open races">
      <OpenRacesGrid />
    </PageContainer>
  );
}
