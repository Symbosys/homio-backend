import axios from "axios";
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { statusCode } from "../types/types.js";
import { zodError } from "../utils/utils.js";

export const errorMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.log(err, "err");

  // ✅ Handle Axios / External API Error (e.g. Meta Graph API, Ola Maps, third-party webhooks)
  if (axios.isAxiosError(err)) {
    const errorData = err.response?.data as any;
    const metaMessage = errorData?.error?.message;
    const generalMessage = errorData?.message || errorData?.error_description;
    const finalMessage =
      metaMessage ||
      generalMessage ||
      (err.response?.statusText
        ? `Meta / External API Error: ${err.response.statusText}`
        : err.message || "External service request failed");

    // Note: Never return 401 for external third-party API errors (e.g. Meta Graph API, Ola Maps).
    // Returning 401 triggers frontend client auth interceptors and logs out the CRM user.
    const httpStatus =
      err.response?.status === 401
        ? statusCode.Bad_Request
        : err.response?.status && err.response.status >= 400 && err.response.status < 500
        ? err.response.status
        : statusCode.Bad_Request;

    return res.status(httpStatus).json({
      success: false,
      message: finalMessage,
    });
  }

  err.message ||= "Internal Server Error";
  err.statusCode ||= 500;

  if (err.name === "CastError") err.message = "Invalid ID";
  if ("code" in err && err.code === "P2025") {
    err.message = "Item not found";
    err.statusCode = statusCode.Not_Found;
  }
  if ("code" in err && err.code === "P2002") {
    const target = Array.isArray((err as any).meta?.target)
      ? (err as any).meta.target.join(", ")
      : "unique identifier";
    err.message = `A record with this ${target} already exists in your organization`;
    err.statusCode = statusCode.Conflict;
  }

  // ✅ Handle Zod error
  if (err instanceof ZodError) {
    const errors = zodError(err);

    // get first zod error message
    const firstErrorMessage =
      err.issues.length > 0 ? err?.issues?.[0]?.message : "Validation Error";

    return res.status(statusCode.Bad_Request).json({
      success: false,
      message: firstErrorMessage,
      errors,
    });
  }

  // Final Error Response
  return res.status(err.statusCode).json({
    success: false,
    message: err.message,
  });
};

export default errorMiddleware;

type AsyncHandlerFunction<TReq extends Request> = (
  req: TReq,
  res: Response,
  next: NextFunction
) => Promise<any>;

export const asyncHandler =
  <TReq extends Request>(fn: AsyncHandlerFunction<TReq>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as TReq, res, next)).catch(next);
  };
