import { Select } from "@cloudflare/kumo";
import type { MikaPurchaseVariantMapItem } from "@bnomei/emdash-mika/astro";
import type { VariantOptionGroupDTO } from "@bnomei/emdash-mika/types";
import { useEffect, useMemo, useRef, useState } from "react";

interface Props {
  variantGroups: readonly VariantOptionGroupDTO[];
  variantOptionMap: readonly MikaPurchaseVariantMapItem[];
  selectedSellableId?: string;
  includePriceId?: boolean;
  label?: string;
  className?: string;
  class?: string;
}

type SelectedOptions = Record<string, string>;

function initialSelected(
  variantOptionMap: readonly MikaPurchaseVariantMapItem[],
  selectedSellableId?: string,
): MikaPurchaseVariantMapItem | undefined {
  return (
    variantOptionMap.find((sellable) => sellable.id === selectedSellableId) ??
    variantOptionMap.find((sellable) => !sellable.disabled) ??
    variantOptionMap[0]
  );
}

function findSelectedSellable(
  variantOptionMap: readonly MikaPurchaseVariantMapItem[],
  selectedOptions: SelectedOptions,
): MikaPurchaseVariantMapItem | undefined {
  return variantOptionMap.find(
    (candidate) =>
      !candidate.disabled &&
      Object.entries(selectedOptions).every(
        ([option, value]) => candidate.options[option] === value,
      ),
  );
}

function displayGroupLabel(group: VariantOptionGroupDTO): string {
  return group.option === "fulfillment" ? "Format" : group.label;
}

function groupItems(
  group: VariantOptionGroupDTO,
  variantOptionMap: readonly MikaPurchaseVariantMapItem[],
) {
  const disabledByValue = new Map<string, boolean>();

  for (const value of group.values) {
    const candidates = variantOptionMap.filter(
      (candidate) => candidate.options[group.option] === value.value,
    );
    disabledByValue.set(
      value.value,
      candidates.length > 0 && candidates.every((candidate) => candidate.disabled),
    );
  }

  return Object.fromEntries(
    group.values.map((value) => [
      value.value,
      {
        label: value.label ?? value.value,
        disabled: disabledByValue.get(value.value) ?? false,
      },
    ]),
  );
}

export default function VariantOptionGroups({
  variantGroups,
  variantOptionMap,
  selectedSellableId,
  includePriceId = false,
  label = "Choices",
  className,
  class: astroClassName,
}: Props) {
  const initial = useMemo(
    () => initialSelected(variantOptionMap, selectedSellableId),
    [selectedSellableId, variantOptionMap],
  );
  const [selectedOptions, setSelectedOptions] = useState<SelectedOptions>(
    () => initial?.options ?? {},
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = useMemo(
    () => findSelectedSellable(variantOptionMap, selectedOptions),
    [selectedOptions, variantOptionMap],
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const sellableId = selected?.id ?? "";
    const priceId = selected?.priceId ?? "";
    const maxQuantity =
      selected?.maxQuantity === undefined ? "" : String(selected.maxQuantity);

    root.dataset.mikaSelectedSellableId = sellableId;
    root.dataset.mikaSelectedPriceId = priceId;
    root.dataset.mikaSelectedMaxQuantity = maxQuantity;
    root.dispatchEvent(
      new CustomEvent("mika:variant-change", {
        bubbles: true,
        detail: {
          sellableId,
          priceId,
          maxQuantity: selected?.maxQuantity,
        },
      }),
    );
  }, [selected]);

  if (variantGroups.length === 0) return null;

  return (
    <div
      ref={rootRef}
      data-mika-variant-groups
      data-mika-sellables={JSON.stringify(variantOptionMap)}
      data-mika-selected-sellable-id={selected?.id ?? ""}
      data-mika-selected-price-id={selected?.priceId ?? ""}
      data-mika-selected-max-quantity={
        selected?.maxQuantity === undefined ? "" : String(selected.maxQuantity)
      }
      className={["mika-kumo-stack", astroClassName, className].filter(Boolean).join(" ")}
    >
      <input type="hidden" name="sellableId" value={selected?.id ?? ""} readOnly />
      {includePriceId && (
        <input type="hidden" name="priceId" value={selected?.priceId ?? ""} readOnly />
      )}
      {variantGroups.length > 1 && <span className="mika-kumo-sr-only">{label}</span>}
      {variantGroups.map((group) => (
        <Select
          key={group.option}
          label={displayGroupLabel(group)}
          value={selectedOptions[group.option] ?? ""}
          onValueChange={(value) => {
            setSelectedOptions((current) => ({
              ...current,
              [group.option]: String(value ?? ""),
            }));
          }}
          items={groupItems(group, variantOptionMap)}
        />
      ))}
    </div>
  );
}
