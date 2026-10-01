import { Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export const REQUEST_ID_HEADER = "X-Request-ID";

export type RequestWithId = Request & { requestId?: string };

const requestLogger = new Logger("HttpRequest");

/**
 * Gives every request a server-generated correlation ID and emits one bounded,
 * structured completion record. Query strings, bodies, cookies and IPs are
 * intentionally excluded so logs do not become a second store of user data.
 */
export function requestContext(
  request: RequestWithId,
  response: Response,
  next: NextFunction,
) {
  const requestId = randomUUID();
  const startedAt = process.hrtime.bigint();
  request.requestId = requestId;
  response.setHeader(REQUEST_ID_HEADER, requestId);
  response.once("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    requestLogger.log(
      JSON.stringify({
        event: "http_request",
        requestId,
        method: request.method,
        path: request.path,
        statusCode: response.statusCode,
        durationMs: Number(durationMs.toFixed(1)),
      }),
    );
  });
  next();
}
