export type Environment = 'development' | 'preproduction' | 'production';

interface EnvironmentConfig {
  evalsApiBaseUrl: string;
  cognitoUserPoolId: string;
  cognitoUserPoolClientId: string;
  cognitoOAuthDomain: string;
  // Talky APIs
  talkyTpvBaseUrl: string;
  talkyUserExpensesBaseUrl: string;
  talkyCombinedMetricsBaseUrl: string;
  talkyDeliveryNotesBaseUrl: string;
  talkyPayrollsSearchBaseUrl: string;
  talkyInvoiceLearningBaseUrl: string;
}

const environmentConfigs: Record<Environment, EnvironmentConfig> = {
  development: {
    evalsApiBaseUrl: 'https://api-dev.tu-dominio.com/evals-api',
    cognitoUserPoolId: 'eu-west-3_GoxJSEnE2',
    cognitoUserPoolClientId: 'e0apak573ngo429ciijg883qh',
    cognitoOAuthDomain: 'eu-west-3goxjsene2.auth.eu-west-3.amazoncognito.com',
    // In dev, requests go through Vite proxy (/api-dev) to avoid CORS
    talkyTpvBaseUrl: '/api-dev/tpv-api',
    talkyUserExpensesBaseUrl: '/api-dev/user-expenses-api',
    talkyCombinedMetricsBaseUrl: '/api-dev/analytics-v2',
    talkyDeliveryNotesBaseUrl: '/api-dev/delivery-notes-api',
    talkyPayrollsSearchBaseUrl: '/api-dev/analytics-v3',
    talkyInvoiceLearningBaseUrl: '/api-dev/invoice-learning-api',
  },
  preproduction: {
    evalsApiBaseUrl: 'https://api-pre.tu-dominio.com/evals-api',
    cognitoUserPoolId: 'eu-west-3_kO8LBlR86',
    cognitoUserPoolClientId: '42tdes8chni1ugp6g37r1gib3k',
    cognitoOAuthDomain: 'eu-west-3ko8lblr86.auth.eu-west-3.amazoncognito.com',
    talkyTpvBaseUrl: 'https://api-pre.usetalky.com/tpv-api',
    talkyUserExpensesBaseUrl: 'https://api-pre.usetalky.com/user-expenses-api',
    talkyCombinedMetricsBaseUrl: 'https://api-pre.usetalky.com/analytics-v2',
    talkyDeliveryNotesBaseUrl: 'https://api-pre.usetalky.com/delivery-notes-api',
    talkyPayrollsSearchBaseUrl: 'https://api-pre.usetalky.com/analytics-v3',
    talkyInvoiceLearningBaseUrl: 'https://api-pre.usetalky.com/invoice-learning-api',
  },
  production: {
    evalsApiBaseUrl: 'https://api.tu-dominio.com/evals-api',
    cognitoUserPoolId: 'eu-west-3_iUb7qS897',
    cognitoUserPoolClientId: '5u33sn8jq4at1rekdibepati51',
    cognitoOAuthDomain: 'eu-west-3iub7qs897.auth.eu-west-3.amazoncognito.com',
    talkyTpvBaseUrl: 'https://api.usetalky.com/tpv-api',
    talkyUserExpensesBaseUrl: 'https://api.usetalky.com/user-expenses-api',
    talkyCombinedMetricsBaseUrl: 'https://api.usetalky.com/analytics-v2',
    talkyDeliveryNotesBaseUrl: 'https://api.usetalky.com/delivery-notes-api',
    talkyPayrollsSearchBaseUrl: 'https://api.usetalky.com/analytics-v3',
    talkyInvoiceLearningBaseUrl: 'https://api.usetalky.com/invoice-learning-api',
  },
};

const detectEnvironment = (): Environment => {
  const viteMode = import.meta.env.MODE as string | undefined;
  if (viteMode === 'development') return 'development';
  if (viteMode === 'pre' || viteMode === 'preproduction' || viteMode === 'staging') return 'preproduction';
  if (viteMode === 'production') return 'production';

  if (typeof window === 'undefined') return 'production';
  const hostname = window.location.hostname;
  if (hostname.includes('pre.') || hostname.includes('staging.')) return 'preproduction';
  if (hostname.includes('develop.') || hostname === 'localhost' || hostname === '127.0.0.1') return 'development';

  return 'production';
};

export const getCurrentEnvironment = (): Environment => detectEnvironment();
export const getConfig = (): EnvironmentConfig => environmentConfigs[detectEnvironment()];
export const config = getConfig();
