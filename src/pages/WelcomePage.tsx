import { useNavigate } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';
import {
  PenLine, Database, FlaskConical, BarChart3, FileText, BookOpen,
  ArrowRight, Sparkles, Rocket,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { logo } from '../guidelines/design-tokens';

const cards = [
  { key: 'annotation' as const, icon: PenLine, to: '/annotation', color: 'bg-brand-50 text-brand-500' },
  { key: 'golden' as const, icon: Database, to: '/golden-dataset', color: 'bg-purple-50 text-purple-500' },
  { key: 'test' as const, icon: FlaskConical, to: '/test', color: 'bg-blue-50 text-blue-500' },
  { key: 'analytics' as const, icon: BarChart3, to: '/analytics', color: 'bg-green-50 text-green-500' },
  { key: 'docs' as const, icon: FileText, to: '/docs', color: 'bg-amber-50 text-amber-500' },
  { key: 'resources' as const, icon: BookOpen, to: '/resources', color: 'bg-rose-50 text-rose-500' },
];

export default function WelcomePage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuthenticator(context => [context.user]);
  const name = user?.signInDetails?.loginId?.split('@')[0] || '';

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Hero */}
      <div className="relative bg-gradient-to-br from-brand-500 to-brand-600 rounded-2xl p-8 sm:p-10 text-white overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <img src={logo.url} alt={logo.altText} className="h-8 brightness-0 invert" />
            <span className="text-xs font-mono bg-white/20 px-2.5 py-1 rounded-md">
              {t('welcome.hackathon.badge')}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">
            {name ? (
              <>
                {t('welcome.title').split('Talky')[0]}
                <span className="text-brand-200">Talky Hackathon</span>
                {name && <span className="block text-xl sm:text-2xl font-normal mt-1 text-white/80">{`Hola, ${name}`}</span>}
              </>
            ) : (
              t('welcome.title')
            )}
          </h1>
          <p className="text-white/80 text-base sm:text-lg max-w-2xl mt-3">
            {t('welcome.subtitle')}
          </p>
        </div>
      </div>

      {/* Hackathon info */}
      <div className="bg-gradient-to-r from-brand-50 to-orange-50 border border-brand-200 rounded-xl p-6 flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-brand-100 flex items-center justify-center shrink-0">
          <Rocket size={20} className="text-brand-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-brand-900 mb-1">{t('welcome.hackathon.badge')}</h3>
          <p className="text-sm text-brand-700">{t('welcome.hackathon.desc')}</p>
        </div>
      </div>

      {/* Quick Start */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={18} className="text-brand-500" />
          <h2 className="text-lg font-semibold text-gray-900">{t('welcome.quickStart')}</h2>
        </div>
        <p className="text-sm text-gray-500 mb-6">{t('welcome.quickStart.desc')}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(({ key, icon: Icon, to, color }) => (
            <button
              key={key}
              onClick={() => navigate(to)}
              className="group bg-white border border-gray-200 rounded-xl p-5 text-left hover:border-brand-300 hover:shadow-sm transition-all"
            >
              <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center mb-3`}>
                <Icon size={20} />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
                {t(`welcome.card.${key}.title`)}
                <ArrowRight size={14} className="text-gray-300 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all" />
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">{t(`welcome.card.${key}.desc`)}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
