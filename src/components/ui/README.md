# Shared form controls

These Vue controls belong to the app-wide UI layer. They contain presentation and keyboard behavior only; feature-specific validation and business rules stay with each feature.

## `AppDatePicker`

Use `v-model` with an ISO date (`YYYY-MM-DD`) or an empty string. The control displays `DD/MM/YYYY`, uses the user's local calendar date, and emits ISO dates without timezone conversion. Pass a visible `label`; optional props are `id`, `required`, `invalid`, `disabled`, `min`, and `max` (ISO dates). The calendar supports arrow keys, Home/End, Page Up/Down, Ctrl+Page Up/Down for years, Enter, and Escape. It is rendered above surrounding panels so narrow or clipped layouts do not hide it.

```vue
<AppDatePicker v-model="invoiceDate" label="Invoice date" required />
```

## `AppSelect`

Use `v-model` with a string and pass `options` as `{ value, label, disabled? }[]`. Provide either a visible `label` or `ariaLabel`. Optional props include `id`, `placeholder`, `required`, `invalid`, `disabled`, and `compact`. The listbox supports arrow keys, Home/End, Enter/Space, Escape, and first-letter search.

```vue
<AppSelect v-model="status" label="Status" :options="statusOptions" />
```

Do not add accounting-specific options, date limits, or form messages to these controls. Keep those in the consuming feature.
