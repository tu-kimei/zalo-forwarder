export interface ApiResponse<T = unknown> {
  error_code: number;
  error_message: string;
  data?: T;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
}
