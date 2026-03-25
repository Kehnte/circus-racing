// validateCircuit — field-level validation for the circuit create form.

export interface CircuitForm {
  name: string;
}

export function validateCircuitField(field: keyof CircuitForm, value: string): string | undefined {
  if (field === 'name') {
    if (!value.trim()) return 'Name is required';
    if (value.trim().length < 2) return 'At least 2 characters';
  }
  return undefined;
}

export function validateCircuitForm(form: CircuitForm): Partial<Record<keyof CircuitForm, string>> {
  const errors: Partial<Record<keyof CircuitForm, string>> = {};
  (Object.keys(form) as (keyof CircuitForm)[]).forEach((field) => {
    const err = validateCircuitField(field, form[field]);
    if (err) errors[field] = err;
  });
  return errors;
}
