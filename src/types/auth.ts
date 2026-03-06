export interface AuthFormData {
  email: string;
  password: string;
  confirmPassword?: string;
  verificationCode?: string;
  mfaCode?: string;
}

export type AuthFormState =
  | 'signIn'
  | 'signUp'
  | 'confirmSignUp'
  | 'forgotPasswordRequest'
  | 'forgotPasswordSubmit'
  | 'confirmSignInWithTOTP'
  | 'setupTOTP';
