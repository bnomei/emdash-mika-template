/**
 * Purchase-option picker for multi-priced sellables; bubbles `mika:purchase-change`
 * so parent forms sync sellable, price, and max-quantity hidden fields.
 */
import { Select } from "@cloudflare/kumo";
import { useEffect, useMemo, useRef, useState } from "react";

/** One purchasable sellable/price pair in a composite purchase select. */
export interface PurchaseSelectOption {
  label: string;
  value: string;
  sellableId: string;
  priceId?: string;
  maxQuantity?: number;
  disabled?: boolean;
}

interface Props {
  label: string;
  name: string;
  options: readonly PurchaseSelectOption[];
  selectedValue?: string;
  className?: string;
  class?: string;
}

function firstEnabled(options: readonly PurchaseSelectOption[]) {
  return options.find((option) => !option.disabled) ?? options[0];
}

function findSelected(options: readonly PurchaseSelectOption[], value?: string) {
  return (
    options.find((option) => option.value === value && !option.disabled) ??
    firstEnabled(options)
  );
}

function selectItems(options: readonly PurchaseSelectOption[]) {
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

/** Select control that resolves sellable/price metadata for cart and checkout forms. */
export default function PurchaseOptionsSelect({
  label,
  name,
  options,
  selectedValue,
  className,
  class: astroClassName,
}: Props) {
  const initial = useMemo(
    () => findSelected(options, selectedValue),
    [options, selectedValue],
  );
  const [value, setValue] = useState(initial?.value ?? "");
  const selected = useMemo(() => findSelected(options, value), [options, value]);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const sellableId = selected?.sellableId ?? "";
    const priceId = selected?.priceId ?? "";
    const maxQuantity =
      selected?.maxQuantity === undefined ? "" : String(selected.maxQuantity);

    root.dataset.mikaPurchaseSellableId = sellableId;
    root.dataset.mikaPurchasePriceId = priceId;
    root.dataset.mikaPurchaseMaxQuantity = maxQuantity;
    root.dispatchEvent(
      new CustomEvent("mika:purchase-change", {
        bubbles: true,
        detail: {
          sellableId,
          priceId,
          maxQuantity: selected?.maxQuantity,
        },
      }),
    );
  }, [selected]);

  if (options.length === 0) return null;

  return (
    <div
      ref={rootRef}
      data-mika-purchase-select
      data-mika-purchase-sellable-id={selected?.sellableId ?? ""}
      data-mika-purchase-price-id={selected?.priceId ?? ""}
      data-mika-purchase-max-quantity={
        selected?.maxQuantity === undefined ? "" : String(selected.maxQuantity)
      }
      className={["mika-kumo-stack", astroClassName, className].filter(Boolean).join(" ")}
    >
      <input type="hidden" name={name} value={selected?.value ?? ""} readOnly />
      <Select
        label={label}
        value={value}
        onValueChange={(nextValue) => setValue(String(nextValue ?? ""))}
        items={selectItems(options)}
      />
    </div>
  );
}
