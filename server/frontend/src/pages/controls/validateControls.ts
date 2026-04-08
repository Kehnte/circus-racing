// validateControls — field-level validation for the controls create/edit form.

export interface ControlsForm {
  type: string;
  img: string;
}

export function validateControlsField(field: keyof ControlsForm, value: string): string | undefined {
  if (field === 'type') {
    if (!value.trim()) return 'Type is required';
  }
  if (field === 'img' && value) {
    if (!value.startsWith('http') && !value.startsWith('/')) return 'Enter a valid URL';
  }
  return undefined;
}

export function validateControlsForm(form: ControlsForm): Partial<Record<keyof ControlsForm, string>> {
  const errors: Partial<Record<keyof ControlsForm, string>> = {};
  (Object.keys(form) as (keyof ControlsForm)[]).forEach((field) => {
    const err = validateControlsField(field, form[field]);
    if (err) errors[field] = err;
  });
  return errors;
}
