"use client";

import React, { useState, useCallback } from "react";

type AssetUnit = "XLM" | "USDC";

interface AmountInputProps {
  unit?: AssetUnit;
  balance: string | number;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

// Converts any numeric string (including scientific notation) to a plain decimal string
function toPlainDecimal(value: string | number): string {
  const num = typeof value === "number" ? value : parseFloat(value);
  if (isNaN(num)) return "0";
  // toFixed(7) handles scientific notation and caps at 7 decimal places
  return num.toFixed(7).replace(/\.?0+$/, "");
}

// Validates input: digits with optional decimal point, up to 7 decimal places
const VALID_PATTERN = /^\d*\.?\d{0,7}$/;

export function AmountInput({
  unit = "XLM",
  balance,
  onValueChange,
  placeholder = "0.0000000",
  disabled = false,
}: AmountInputProps) {
  const [inputValue, setInputValue] = useState("");

  const balanceNum = parseFloat(String(balance));
  const inputNum = parseFloat(inputValue);
  const exceedsBalance =
    inputValue !== "" && !isNaN(inputNum) && !isNaN(balanceNum) && inputNum > balanceNum;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;

      // Allow clearing the field
      if (raw === "") {
        setInputValue("");
        onValueChange("");
        return;
      }

      // Only allow valid numeric pattern with up to 7 decimals
      if (!VALID_PATTERN.test(raw)) return;

      setInputValue(raw);
      onValueChange(raw);
    },
    [onValueChange]
  );

  const handleMax = useCallback(() => {
    const plain = toPlainDecimal(balance);
    setInputValue(plain);
    onValueChange(plain);
  }, [balance, onValueChange]);

  return (
    <div className="flex flex-col gap-1">
      <div
        className={`flex items-center rounded-lg border px-3 py-2 gap-2 bg-background transition-colors
          ${exceedsBalance ? "border-destructive" : "border-input focus-within:border-ring"}
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        {/* Asset label */}
        <span className="text-sm font-semibold text-muted-foreground min-w-[44px]">
          {unit}
        </span>

        <div className="w-px h-5 bg-border" />

        {/* Numeric input */}
        <input
          type="text"
          inputMode="decimal"
          value={inputValue}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground min-w-0"
        />

        {/* MAX button */}
        <button
          type="button"
          onClick={handleMax}
          disabled={disabled}
          className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors disabled:pointer-events-none"
        >
          MAX
        </button>
      </div>

      {/* Balance display + warning */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-muted-foreground">
          Balance: {toPlainDecimal(balance)} {unit}
        </span>
        {exceedsBalance && (
          <span className="text-xs text-destructive font-medium">
            Exceeds balance
          </span>
        )}
      </div>
    </div>
  );
}
