/** Consistent API response types */

export interface ApiSuccessResponse<T> {
  data: T;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
}

export interface ApiErrorResponse {
  error: ApiErrorDetail;
}

export function successResponse<T>(data: T): ApiSuccessResponse<T> {
  return { data };
}

export function errorResponse(code: string, message: string): ApiErrorResponse {
  return { error: { code, message } };
}
