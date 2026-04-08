// validateTeam — field-level validation for the team create/edit form.

export interface TeamForm {
  name: string;
  acronym: string;
  color: string;
}

export function validateTeamField(field: keyof TeamForm, value: string): string | undefined {
  if (field === 'name') {
    if (!value.trim()) return 'Name is required';
    if (value.trim().length < 2) return 'At least 2 characters';
  }
  if (field === 'acronym') {
    if (!value.trim()) return 'Acronym is required';
    if (!/^[A-Za-z0-9]{1,4}$/.test(value)) return '1–4 alphanumeric characters';
  }
  if (field === 'color') {
    if (!/^#[0-9A-Fa-f]{6}$/.test(value)) return 'Enter a valid hex color (#RRGGBB)';
  }
  return undefined;
}

export function validateTeamForm(form: TeamForm): Partial<Record<keyof TeamForm, string>> {
  const errors: Partial<Record<keyof TeamForm, string>> = {};
  (Object.keys(form) as (keyof TeamForm)[]).forEach((field) => {
    const err = validateTeamField(field, form[field]);
    if (err) errors[field] = err;
  });
  return errors;
}
