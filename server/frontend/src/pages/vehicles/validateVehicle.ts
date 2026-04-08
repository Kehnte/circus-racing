// validateVehicle — field-level validation for the vehicle create/edit form.

const VEHICLE_TYPES = ['ship', 'rover', 'bike'];

export interface VehicleForm {
  model: string;
  type: string;
  manufacturer: string;
  img: string;
}

export function validateVehicleField(field: keyof VehicleForm, value: string): string | undefined {
  if (field === 'model') {
    if (!value.trim()) return 'Model is required';
    if (value.trim().length < 2) return 'At least 2 characters';
  }
  if (field === 'type') {
    if (!VEHICLE_TYPES.includes(value)) return 'Select a type';
  }
  if (field === 'manufacturer' && value) {
    if (value.trim().length > 50) return 'Max 50 characters';
  }
  if (field === 'img' && value) {
    if (!value.startsWith('http') && !value.startsWith('/')) return 'Enter a valid URL';
  }
  return undefined;
}

export function validateVehicleForm(form: VehicleForm): Partial<Record<keyof VehicleForm, string>> {
  const errors: Partial<Record<keyof VehicleForm, string>> = {};
  (Object.keys(form) as (keyof VehicleForm)[]).forEach((field) => {
    const err = validateVehicleField(field, form[field]);
    if (err) errors[field] = err;
  });
  return errors;
}
