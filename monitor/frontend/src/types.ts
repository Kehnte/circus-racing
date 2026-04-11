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
  has_export: boolean;
  last_export_name: string | null;
  last_capture_test: CaptureTestResult | null;
  anchor_position: [number, number, number] | null;
  anchor_radius: number;
}

export interface CaptureTestResult {
  ok: boolean;
  ocr_text: string;
  position: [number, number, number] | null;
  image_b64: string | null;
  captured_at: string;
}

export interface MonitorConfig {
  token: string;
  url: string;
  monitor_index: number;
  delta_time_s: number;
  record_delta_time_s: number;
  checkpoint_save: boolean;
  checkpoint_save_distance: number;
  auto_checkpoint_spacing: number;
  hotkey_test_capture: string;
  hotkey_record_start: string;
  hotkey_record_checkpoint: string;
  hotkey_record_finish: string;
  hotkey_record_cancel: string;
  filter_speed_enabled: boolean;
  filter_speed_max_ms: number;
  filter_iqr_enabled: boolean;
  filter_iqr_multiplier: number;
  filter_angular_enabled: boolean;
  filter_angular_max_angle: number;
  filter_rdp_enabled: boolean;
  filter_rdp_tolerance: number;
}

export interface MonitorInfo {
  index: number;
  width: number;
  height: number;
}

// --- Editor types ---

export interface FilterConfig {
  speed_enabled: boolean;
  speed_max_ms: number;
  iqr_enabled: boolean;
  iqr_multiplier: number;
  angular_enabled: boolean;
  angular_max_angle: number;
  rdp_enabled: boolean;
  rdp_tolerance: number;
}

export interface TracePoint {
  id: number;
  t: number;
  position: [number, number, number];
  gap?: boolean;
}

export interface EditorCheckpoint {
  id: number;
  order: number;
  position: [number, number, number];
  direction: [number, number, number];
  radius: number;
  type: 'start' | 'start-finish' | 'checkpoint' | 'finish';
  source?: 'manual' | 'auto';  // manual = placed during record or by user; auto = generated
}

// Raw mark from a record session (new format)
export interface RawMark {
  order: number;
  trace_idx: number;
  type_hint: 'start' | 'checkpoint' | 'finish';
}

export interface EditorCircuit {
  name: string;
  type: 'LOOP' | 'POINT_TO_POINT';
  recordedBy: string;
  recordedAt: string;
  defaultBufferRadius: number;
  points: TracePoint[];
  checkpoints: EditorCheckpoint[];
}
