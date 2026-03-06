import { FlaskConical } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export default function TestPage() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{t('test.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('test.subtitle')}</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center mx-auto mb-4">
          <FlaskConical size={24} className="text-brand-500" />
        </div>
        <h2 className="text-lg font-medium text-gray-900 mb-1">{t('test.comingSoon')}</h2>
        <p className="text-sm text-gray-500 max-w-md mx-auto">{t('test.comingSoonDesc')}</p>
      </div>
    </div>
  );
}
