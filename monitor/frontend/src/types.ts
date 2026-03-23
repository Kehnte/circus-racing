// types.ts — Data shapes returned by the local Flask API.

export interface MonitorState {
  mode: 'RACE' | 'RECORD';
  position: [number, number, number] | null;
  last_ocr_at: string | null;
  last_send_status: number | string | null;
  server_ok: boolean;
  server_reachable: boolean;
  recording: boolean;
  trace_count: number;
  marks: { order: number; trace_idx: number; type_hint: string }[];
  finished: boolean;
}

export interface MonitorConfig {
  token: string;
  url: string;
  monitor_index: number;
  delta_time_s: number;
  checkpoint_save: boolean;
  checkpoint_save_distance: number;
}

export interface MonitorInfo {
  index: number;
  width: number;
  height: number;
}
