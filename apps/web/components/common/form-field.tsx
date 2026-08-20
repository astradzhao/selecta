"use client";

import { cloneElement, type ReactElement } from "react";

import { Field, FieldDescription, FieldError, FieldLabel } from "@selecta/ui/components/field";

type ControlProps = {
  id?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
};

export function FormField({
  id,
  label,
  error,
  description,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string | null;
  description?: React.ReactNode;
  className?: string;
  children: ReactElement<ControlProps>;
}) {
  const errorId = `${id}-error`;
  const descriptionId = `${id}-description`;
  const describedBy =
    [error ? errorId : null, description ? descriptionId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <Field data-invalid={error ? true : undefined} className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {cloneElement(children, {
        id,
        "aria-invalid": Boolean(error) || undefined,
        "aria-describedby": describedBy,
      })}
      {description ? <FieldDescription id={descriptionId}>{description}</FieldDescription> : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </Field>
  );
}

export function omitFieldError<T extends string>(
  errors: Partial<Record<T, string>>,
  field: T,
): Partial<Record<T, string>> {
  if (!(field in errors)) return errors;
  const next = { ...errors };
  delete next[field];
  return next;
}
