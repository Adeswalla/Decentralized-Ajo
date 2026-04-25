"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface RatingProps {
  value?: number;
  average?: number;
  count?: number;
  max?: number;
  readOnly?: boolean;
  onChange?: (value: number) => void;
  className?: string;
}

export function Rating({
  value = 0,
  average,
  count,
  max = 5,
  readOnly = false,
  onChange,
  className,
}: RatingProps) {
  const [hovered, setHovered] = React.useState(0);

  const display = hovered || value;
  const showAverage = average !== undefined;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div
        role={readOnly ? undefined : "radiogroup"}
        aria-label="Rating"
        className="flex items-center gap-0.5"
      >
        {Array.from({ length: max }, (_, i) => {
          const starValue = i + 1;
          const filled = starValue <= display;

          return (
            <button
              key={starValue}
              type="button"
              role={readOnly ? undefined : "radio"}
              aria-checked={readOnly ? undefined : value === starValue}
              aria-label={`${starValue} star${starValue !== 1 ? "s" : ""}`}
              disabled={readOnly}
              onClick={() => !readOnly && onChange?.(starValue)}
              onMouseEnter={() => !readOnly && setHovered(starValue)}
              onMouseLeave={() => !readOnly && setHovered(0)}
              className={cn(
                "transition-transform",
                !readOnly && "hover:scale-110 cursor-pointer",
                readOnly && "cursor-default pointer-events-none"
              )}
            >
              <Star
                className={cn(
                  "h-5 w-5 transition-colors",
                  filled
                    ? "fill-yellow-400 text-yellow-400"
                    : "fill-transparent text-muted-foreground"
                )}
              />
            </button>
          );
        })}
      </div>

      {showAverage && (
        <p className="text-xs text-muted-foreground">
          {average.toFixed(1)} avg{count !== undefined ? ` · ${count} rating${count !== 1 ? "s" : ""}` : ""}
        </p>
      )}
    </div>
  );
}
