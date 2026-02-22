import { BadRequestException, Injectable, PipeTransform } from "@nestjs/common";
import type { ZodSchema } from "zod";

/**
 * ZodValidationPipe:
 * - Vi vill återanvända Zod-scheman från packages/shared.
 * - Det gör att UI och API kan dela kontrakt.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    const res = this.schema.safeParse(value);
    if (!res.success) {
      throw new BadRequestException({
        error: "ValidationError",
        details: res.error.issues
      });
    }
    return res.data;
  }
}
