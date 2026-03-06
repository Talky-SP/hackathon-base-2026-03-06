import { ExternalLink, Palette, Cloud, Download } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface ResourceCard {
  title: string;
  description: { es: string; en: string };
  url: string;
  icon: React.ReactNode;
  color: string;
  actionKey: 'visitSite' | 'downloadPdf';
  logo?: string;
}

const designResources: ResourceCard[] = [
  {
    title: 'Mobbin',
    description: {
      es: 'La mayor libreria de patrones de diseno de apps reales. Ideal para inspiracion de UI/UX y flujos de usuario.',
      en: 'The largest library of real app design patterns. Ideal for UI/UX inspiration and user flows.',
    },
    url: 'https://mobbin.com/',
    icon: <Palette size={20} />,
    color: 'bg-violet-50 text-violet-500 border-violet-200',
    actionKey: 'visitSite',
  },
  {
    title: 'Dribbble',
    description: {
      es: 'Comunidad de disenadores con miles de shots de UI, iconografia, branding y componentes de interfaz.',
      en: 'Designer community with thousands of UI shots, iconography, branding and interface components.',
    },
    url: 'https://dribbble.com/',
    icon: <Palette size={20} />,
    color: 'bg-pink-50 text-pink-500 border-pink-200',
    actionKey: 'visitSite',
  },
];

const architectureResources: ResourceCard[] = [
  {
    title: 'AWS Well-Architected Framework',
    description: {
      es: 'Guia oficial de AWS para construir infraestructuras seguras, eficientes y resilientes en la nube. Cubre los 6 pilares fundamentales.',
      en: 'Official AWS guide for building secure, efficient and resilient cloud infrastructures. Covers the 6 fundamental pillars.',
    },
    url: 'https://docs.aws.amazon.com/pdfs/wellarchitected/latest/framework/wellarchitected-framework.pdf',
    icon: <Cloud size={20} />,
    color: 'bg-amber-50 text-amber-600 border-amber-200',
    actionKey: 'downloadPdf',
  },
];

function ResourceCardComponent({ resource, language }: { resource: ResourceCard; language: 'es' | 'en' }) {
  const { t } = useLanguage();
  const isPdf = resource.actionKey === 'downloadPdf';

  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group bg-white border border-gray-200 rounded-xl p-6 hover:border-brand-300 hover:shadow-md transition-all block"
    >
      <div className="flex items-start gap-4">
        <div className={`w-11 h-11 rounded-lg border flex items-center justify-center shrink-0 ${resource.color}`}>
          {resource.icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-gray-900 mb-1 flex items-center gap-2">
            {resource.title}
            <ExternalLink size={14} className="text-gray-300 group-hover:text-brand-500 transition-colors" />
          </h3>
          <p className="text-sm text-gray-500 leading-relaxed">
            {resource.description[language]}
          </p>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2">
        {isPdf ? <Download size={14} className="text-brand-500" /> : <ExternalLink size={14} className="text-brand-500" />}
        <span className="text-sm font-medium text-brand-500 group-hover:text-brand-600 transition-colors">
          {t(`resources.${resource.actionKey}`)}
        </span>
        <span className="text-xs text-gray-400 ml-auto truncate max-w-[200px]">{resource.url.replace(/^https?:\/\//, '')}</span>
      </div>
    </a>
  );
}

export default function ResourcesPage() {
  const { t, language } = useLanguage();

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{t('resources.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('resources.subtitle')}</p>
      </div>

      {/* Design & UI */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Palette size={18} className="text-brand-500" />
          <h2 className="text-base font-semibold text-gray-900">{t('resources.design')}</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">{t('resources.designDesc')}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {designResources.map(r => (
            <ResourceCardComponent key={r.title} resource={r} language={language} />
          ))}
        </div>
      </section>

      {/* Architecture & Cloud */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Cloud size={18} className="text-brand-500" />
          <h2 className="text-base font-semibold text-gray-900">{t('resources.architecture')}</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">{t('resources.architectureDesc')}</p>
        <div className="grid grid-cols-1 gap-4">
          {architectureResources.map(r => (
            <ResourceCardComponent key={r.title} resource={r} language={language} />
          ))}
        </div>
      </section>
    </div>
  );
}
