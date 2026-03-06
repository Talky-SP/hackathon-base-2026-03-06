import { useAuthenticator } from '@aws-amplify/ui-react';
import { Navigate } from 'react-router-dom';
import AuthForm from './AuthForm';
import { logo } from '../../guidelines/design-tokens';
import { useLanguage } from '../../i18n/LanguageContext';

export default function AuthContainer() {
  const { authStatus } = useAuthenticator(context => [context.authStatus]);
  const { t } = useLanguage();

  if (authStatus === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <img
            src={logo.url}
            alt={logo.altText}
            className="h-12 mx-auto mb-4"
          />
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm text-gray-500">{t('auth.platform')}</span>
            <span className="text-xs font-mono text-gray-400 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-md">
              {t('auth.internalTools')}
            </span>
          </div>
        </div>
        <AuthForm />
      </div>
    </div>
  );
}
