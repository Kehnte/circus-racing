// validatePilot — field-level validation for the pilot create/edit form.

const ROLES = ['ADMIN', 'MODERATOR', 'PILOT'];

export interface PilotForm {
  displayName: string;
  country: string;
  role: string;
  teamId: string;
  vehicleId: string;
  controlsId: string;
}

export function validatePilotField(field: keyof PilotForm, value: string): string | undefined {
  if (field === 'displayName') {
    if (!value.trim()) return 'Display name is required';
    if (value.trim().length < 2) return 'At least 2 characters';
  }
  if (field === 'role') {
    if (!ROLES.includes(value)) return 'Select a valid role';
  }
  return undefined;
}

export function validatePilotForm(form: PilotForm): Partial<Record<keyof PilotForm, string>> {
  const errors: Partial<Record<keyof PilotForm, string>> = {};
  (Object.keys(form) as (keyof PilotForm)[]).forEach((field) => {
    const err = validatePilotField(field, form[field]);
    if (err) errors[field] = err;
  });
  return errors;
}
