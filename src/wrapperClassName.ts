export function wrapperClassName(unstyled: boolean | undefined, className: string | undefined) {
  return [unstyled ? undefined : "db-content", className].filter(Boolean).join(" ") || undefined;
}
