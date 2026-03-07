import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { config as envConfig } from './config/environment';
import { LanguageProvider } from './i18n/LanguageContext';
import { AnnotationProvider } from './contexts/AnnotationContext';
import { FieldAnnotationProvider } from './contexts/FieldAnnotationContext';
import AuthContainer from './components/auth/AuthContainer';
import AppLayout from './components/layout/AppLayout';
import WelcomePage from './pages/WelcomePage';
import AnnotationPage from './pages/AnnotationPage';
import GoldenDatasetPage from './pages/GoldenDatasetPage';
import TestPage from './pages/TestPage';
import AnalyticsPage from './pages/AnalyticsPage';
import DocsPage from './pages/DocsPage';
import ResourcesPage from './pages/ResourcesPage';
import ObjectivesPage from './pages/ObjectivesPage';
import GettingStartedPage from './pages/GettingStartedPage';
import '@aws-amplify/ui-react/styles.css';

const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: envConfig.cognitoUserPoolId,
      userPoolClientId: envConfig.cognitoUserPoolClientId,
      loginWith: {
        oauth: {
          domain: envConfig.cognitoOAuthDomain,
          scopes: ['openid', 'email', 'phone'],
          redirectSignIn: [appOrigin + '/auth'],
          redirectSignOut: [appOrigin + '/auth'],
          responseType: 'code' as const,
        }
      }
    }
  }
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { authStatus } = useAuthenticator(context => [context.authStatus]);
  const location = useLocation();

  if (authStatus === 'configuring') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    );
  }

  if (authStatus !== 'authenticated') {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <LanguageProvider>
      <Authenticator.Provider>
        <Router>
          <Routes>
            <Route path="/auth" element={<AuthContainer />} />
            <Route
              path="/*"
              element={
                <RequireAuth>
                  <AnnotationProvider>
                  <FieldAnnotationProvider>
                  <Routes>
                    <Route element={<AppLayout />}>
                      <Route index element={<Navigate to="/welcome" replace />} />
                      <Route path="welcome" element={<WelcomePage />} />
                      <Route path="annotation" element={<AnnotationPage />} />
                      <Route path="golden-dataset" element={<GoldenDatasetPage />} />
                      <Route path="test" element={<TestPage />} />
                      <Route path="analytics" element={<AnalyticsPage />} />
                      <Route path="docs" element={<DocsPage />} />
                      <Route path="resources" element={<ResourcesPage />} />
                      <Route path="objectives" element={<ObjectivesPage />} />
                      <Route path="getting-started" element={<GettingStartedPage />} />
                      <Route path="*" element={<Navigate to="/welcome" replace />} />
                    </Route>
                  </Routes>
                  </FieldAnnotationProvider>
                  </AnnotationProvider>
                </RequireAuth>
              }
            />
          </Routes>
        </Router>
      </Authenticator.Provider>
    </LanguageProvider>
  );
}

export default App;
