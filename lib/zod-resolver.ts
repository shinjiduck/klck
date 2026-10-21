// Resolver tối giản nối Zod với React Hook Form.
// Không dùng @hookform/resolvers vì gói này kéo theo chuỗi peer dependency tùy chọn
// (@typeschema/*) xung đột với Zod 4 khi cài bằng npm.
// Chỉ hỗ trợ lỗi ở trường cấp 1 – đủ cho các form phẳng của GĐ1.

import type { FieldErrors, FieldValues, Resolver } from "react-hook-form";
import type { z } from "zod";

export function zodResolver<T extends FieldValues>(schema: z.ZodType<T>): Resolver<T> {
  return async (values) => {
    const result = schema.safeParse(values);
    if (result.success) return { values: result.data, errors: {} };

    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? "root");
      errors[key] ??= { type: issue.code, message: issue.message };
    }
    return { values: {}, errors: errors as unknown as FieldErrors<T> };
  };
}
