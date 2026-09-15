import type { FieldValues, Resolver, FieldErrors } from "react-hook-form";

// The shared schemas use Zod 4. Keep field errors aligned with that contract.
export function schemaResolver<T extends FieldValues>(schema: {
  safeParse(value: unknown): { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } };
}): Resolver<T> {
  return async (values) => {
    const result = schema.safeParse(values);
    if (result.success) return { values: result.data, errors: {} };
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const field = String(issue.path[0] ?? "root");
      errors[field] ??= { type: "validation", message: issue.message };
    }
    return { values: {}, errors: errors as FieldErrors<T> };
  };
}
