import type { HTMLAttributes, HTMLButtonAttributes, HTMLInputAttributes } from "svelte/elements";

export type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
export type ButtonSize = "default" | "sm" | "lg" | "icon";

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning";

export type TooltipPosition = "top" | "bottom" | "left" | "right";

export interface BaseCardProps extends HTMLAttributes<HTMLDivElement> {
  class?: string;
}

export interface BaseButtonProps extends HTMLButtonAttributes {
  variant?: ButtonVariant;
  size?: ButtonSize;
  class?: string;
}

export interface BaseInputProps extends HTMLInputAttributes {
  class?: string;
  value?: string | number;
}
