export type Environment = 'development' | 'preproduction' | 'production';

interface EnvironmentConfig {
  evalsApiBaseUrl: string;
  cognitoUserPoolId: string;
  cognitoUserPoolClientId: string;
  cognitoOAuthDomain: string;
  // OCR Testing API
  ocrTestingBaseUrl: string;
  // Stock Testing API (Analytics API v3, /stock-testing prefix)
  stockTestingBaseUrl: string;
  // Talky APIs
  talkyTpvBaseUrl: string;
  talkyUserExpensesBaseUrl: string;
  talkyCombinedMetricsBaseUrl: string;
  talkyDeliveryNotesBaseUrl: string;
  talkyPayrollsSearchBaseUrl: string;
  talkyInvoiceLearningBaseUrl: string;
  talkyOrdersApiBaseUrl: string;
  // Stock APIs
  talkyStockBaseUrl: string;
  talkyDeliveryNoteViewerBaseUrl: string;
}

const environmentConfigs: Record<Environment, EnvironmentConfig> = {
  development: {
    evalsApiBaseUrl: 'https://api-dev.tu-dominio.com/evals-api',
    cognitoUserPoolId: 'eu-west-3_GoxJSEnE2',
    cognitoUserPoolClientId: 'e0apak573ngo429ciijg883qh',
    cognitoOAuthDomain: 'eu-west-3goxjsene2.auth.eu-west-3.amazoncognito.com',
    ocrTestingBaseUrl: '/api-dev/analytics-v3/ocr-testing',
    stockTestingBaseUrl: '/api-dev/analytics-v3/stock-testing',
    // In dev, requests go through Vite proxy (/api-dev) to avoid CORS
    talkyTpvBaseUrl: '/api-dev/tpv-api',
    talkyUserExpensesBaseUrl: '/api-dev/user-expenses-api',
    talkyCombinedMetricsBaseUrl: '/api-dev/analytics-v2',
    talkyDeliveryNotesBaseUrl: '/api-dev/delivery-notes-api',
    talkyPayrollsSearchBaseUrl: '/api-dev/analytics-v3',
    talkyInvoiceLearningBaseUrl: '/api-dev/invoice-learning-api',
    talkyOrdersApiBaseUrl: '/api-dev/orders-api',
    talkyStockBaseUrl: '/api-dev/stock-api',
    talkyDeliveryNoteViewerBaseUrl: '/api-dev/delivery-note-viewer-api',
  },
  preproduction: {
    evalsApiBaseUrl: 'https://api-pre.tu-dominio.com/evals-api',
    cognitoUserPoolId: 'eu-west-3_kO8LBlR86',
    cognitoUserPoolClientId: '42tdes8chni1ugp6g37r1gib3k',
    cognitoOAuthDomain: 'eu-west-3ko8lblr86.auth.eu-west-3.amazoncognito.com',
    ocrTestingBaseUrl: 'https://ts62wb9xo3.execute-api.eu-west-3.amazonaws.com/pre/ocr-testing',
    stockTestingBaseUrl: 'https://ts62wb9xo3.execute-api.eu-west-3.amazonaws.com/pre/stock-testing',
    talkyTpvBaseUrl: 'https://api-pre.usetalky.com/tpv-api',
    talkyUserExpensesBaseUrl: 'https://api-pre.usetalky.com/user-expenses-api',
    talkyCombinedMetricsBaseUrl: 'https://api-pre.usetalky.com/analytics-v2',
    talkyDeliveryNotesBaseUrl: 'https://api-pre.usetalky.com/delivery-notes-api',
    talkyPayrollsSearchBaseUrl: 'https://api-pre.usetalky.com/analytics-v3',
    talkyInvoiceLearningBaseUrl: 'https://api-pre.usetalky.com/invoice-learning-api',
    talkyOrdersApiBaseUrl: 'https://api-pre.usetalky.com/orders-api',
    talkyStockBaseUrl: 'https://api-pre.usetalky.com/stock-api',
    talkyDeliveryNoteViewerBaseUrl: 'https://api-pre.usetalky.com/delivery-note-viewer-api',
  },
  production: {
    evalsApiBaseUrl: 'https://api.tu-dominio.com/evals-api',
    cognitoUserPoolId: 'eu-west-3_iUb7qS897',
    cognitoUserPoolClientId: '5u33sn8jq4at1rekdibepati51',
    cognitoOAuthDomain: 'eu-west-3iub7qs897.auth.eu-west-3.amazoncognito.com',
    ocrTestingBaseUrl: 'https://w4v0prnmre.execute-api.eu-west-3.amazonaws.com/prod/ocr-testing',
    stockTestingBaseUrl: 'https://w4v0prnmre.execute-api.eu-west-3.amazonaws.com/prod/stock-testing',
    talkyTpvBaseUrl: 'https://api.usetalky.com/tpv-api',
    talkyUserExpensesBaseUrl: 'https://api.usetalky.com/user-expenses-api',
    talkyCombinedMetricsBaseUrl: 'https://api.usetalky.com/analytics-v2',
    talkyDeliveryNotesBaseUrl: 'https://api.usetalky.com/delivery-notes-api',
    talkyPayrollsSearchBaseUrl: 'https://api.usetalky.com/analytics-v3',
    talkyInvoiceLearningBaseUrl: 'https://api.usetalky.com/invoice-learning-api',
    talkyOrdersApiBaseUrl: 'https://api.usetalky.com/orders-api',
    talkyStockBaseUrl: 'https://api.usetalky.com/stock-api',
    talkyDeliveryNoteViewerBaseUrl: 'https://api.usetalky.com/delivery-note-viewer-api',
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
