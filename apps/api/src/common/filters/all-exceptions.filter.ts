import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";

/**
 * En konsekvent felstruktur gör det enklare att felsöka i demo:
 * - UI kan alltid visa error.message + ev. details.
 * - Loggar blir tydliga.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload = isHttp
      ? exception.getResponse()
      : normalizeUnknownException(exception);

    // Logga med request-path för snabbare felsökning
    // (I prod kan man lägga correlationId, etc.)
    // eslint-disable-next-line no-console
    console.error(`[${req.method}] ${req.url}`, exception);

    res.status(status).json({
      statusCode: status,
      path: req.url,
      ...normalizePayload(payload)
    });
  }
}

function normalizePayload(payload: any) {
  if (typeof payload === "string") {
    return { message: payload };
  }
  if (payload && typeof payload === "object") {
    return payload;
  }
  return { message: "Unknown error" };
}

function normalizeUnknownException(exception: any) {
  const code = exception?.code as string | undefined;
  const message =
    typeof exception?.message === "string"
      ? exception.message
      : "InternalError";

  // Prisma relation/table saknas => ofta migration som inte är applicerad.
  if (code === "P2021") {
    return {
      error: "DatabaseSchemaMismatch",
      message: "Databasschemat matchar inte API-koden. Kör Prisma-migrationerna.",
      details: message,
      prismaCode: code
    };
  }

  if (code?.startsWith?.("P")) {
    return {
      error: "DatabaseError",
      message,
      prismaCode: code
    };
  }

  return {
    error: "InternalError",
    message
  };
}
