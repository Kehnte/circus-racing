// App.tsx — Root component with Monitor/Editor tab navigation.
import { useState } from 'react';
import { useMonitorState } from './hooks/useMonitorState';
import AppHeader, { type AppTab } from './components/AppHeader';
import MonitorView from './components/MonitorView';
import EditorView from './components/editor/EditorView';

export default function App() {
  const { state, error } = useMonitorState();
  const [tab, setTab] = useState<AppTab>('monitor');

  return (
    <>
      <AppHeader state={state} pollError={error} tab={tab} onTabChange={setTab} />
      {tab === 'monitor' && <MonitorView state={state} />}
      {tab === 'editor' && <EditorView />}
    </>
  );
}
