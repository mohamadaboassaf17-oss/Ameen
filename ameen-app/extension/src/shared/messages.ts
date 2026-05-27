export interface ExtensionRequest {
  id: string;
  type: 'pair' | 'get_vault' | 'get_item' | 'search_items' | 'generate_otp' | 'generate_password' | 'export_vault' | 'import_vault' | 'ping';
  payload?: string;
}

export interface ExtensionResponse {
  id: string;
  type: 'paired' | 'vault' | 'item' | 'search_results' | 'otp_code' | 'password' | 'pong' | 'error';
  data?: string;
  error?: string;
}

export interface GetItemPayload {
  itemId: string;
}

export interface SearchPayload {
  query: string;
}

export interface OtpPayload {
  secret: string;
}

export interface PasswordPayload {
  length: number;
  useSymbols: boolean;
  useDigits: boolean;
  useUppercase: boolean;
  useLowercase: boolean;
}

export interface DesktopVaultItem {
  id: string;
  type: string;
  title: string;
  username: string;
  password: string;
  url: string;
  content: string;
  cardholder: string;
  number: string;
  expiry: string;
  cvv: string;
  notes: string;
  otpSecret: string;
  updatedAt: string;
  isConflict: boolean;
  conflictDate?: string;
  conflictOriginalId?: string;
}
