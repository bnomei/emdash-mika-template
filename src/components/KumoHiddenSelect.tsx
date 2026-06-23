import { Select } from "@cloudflare/kumo";
import { useMemo, useState } from "react";

export interface KumoHiddenSelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

interface Props {
  label: string;
  name: string;
  options: readonly KumoHiddenSelectOption[];
  selectedValue?: string;
  className?: string;
  class?: string;
}

function selectItems(options: readonly KumoHiddenSelectOption[]) {
  return Object.fromEntries(
    options.map((option) => [
      option.value,
      {
        label: option.label,
        disabled: option.disabled ?? false,
      },
    ]),
  );
}

function initialValue(options: readonly KumoHiddenSelectOption[], selectedValue?: string) {
  return (
    options.find((option) => option.value === selectedValue && !option.disabled)?.value ??
    options.find((option) => !option.disabled)?.value ??
    options[0]?.value ??
    ""
  );
}

export default function KumoHiddenSelect({
  label,
  name,
  options,
  selectedValue,
  className,
  class: astroClassName,
}: Props) {
  const initial = useMemo(
    () => initialValue(options, selectedValue),
    [options, selectedValue],
  );
  const [value, setValue] = useState(initial);

  if (options.length === 0) return null;

  return (
    <div className={["mika-kumo-stack", astroClassName, className].filter(Boolean).join(" ")}>
      <input type="hidden" name={name} value={value} readOnly />
      <Select
        label={label}
        value={value}
        onValueChange={(nextValue) => setValue(String(nextValue ?? ""))}
        items={selectItems(options)}
      />
    </div>
  );
}
