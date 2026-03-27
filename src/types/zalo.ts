export interface ZaloQrResponse {
  error_code: number;
  error_message?: string;
  data?: {
    image: string;   // QR image URL or Base64
    code: string;    // QR code
    token: string;   // QR token
  };
}

export interface ZaloWaitingScanResponse {
  error_code: number;
  error_message?: string;
  data?: {
    code?: string;
    token?: string;
    status?: number;
    avatar?: string;
    display_name?: string;
  };
}

export interface ZaloWaitingConfirmResponse {
  error_code: number;
  error_message?: string;
  data?: Record<string, unknown>;
}

export interface ZaloLoginInfoResponse {
  error_code: number;
  error_message?: string;
  data?: {
    uid?: string;
    phone_number?: string;
    zpw_enk?: string;
    zpw_service_map?: Record<string, string>;
    zpw_ws?: string[];
    [key: string]: unknown;
  };
}

export interface ZaloServerInfoResponse {
  error_code: number;
  error_message?: string;
  data?: Record<string, unknown>;
}

export interface ZaloUserInfoResponse {
  error_code: number;
  error_message?: string;
  data?: Record<string, unknown>;
}
