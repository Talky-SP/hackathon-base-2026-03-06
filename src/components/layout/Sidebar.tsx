import { NavLink } from 'react-router-dom';
import { Home, PenLine, Database, FlaskConical, BarChart3, FileText, BookOpen, Target, Rocket } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';

type NavItem = { to: string; labelKey: TranslationKey; icon: typeof Home };

const mainNav: NavItem[] = [
  { to: '/welcome', labelKey: 'nav.welcome', icon: Home },
  { to: '/annotation', labelKey: 'nav.annotation', icon: PenLine },
  { to: '/golden-dataset', labelKey: 'nav.goldenDataset', icon: Database },
  { to: '/test', labelKey: 'nav.test', icon: FlaskConical },
  { to: '/analytics', labelKey: 'nav.analytics', icon: BarChart3 },
];

const infoNav: NavItem[] = [
  { to: '/objectives', labelKey: 'nav.objectives', icon: Target },
  { to: '/getting-started', labelKey: 'nav.gettingStarted', icon: Rocket },
  { to: '/docs', labelKey: 'nav.docs', icon: FileText },
  { to: '/resources', labelKey: 'nav.resources', icon: BookOpen },
];

function NavItems({ items }: { items: NavItem[] }) {
  const { t } = useLanguage();
  return (
    <>
      {items.map(({ to, labelKey, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-brand-50 text-brand-600'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`
          }
        >
          <Icon size={18} />
          {t(labelKey)}
        </NavLink>
      ))}
    </>
  );
}

export default function Sidebar() {
  return (
    <aside className="w-60 bg-white border-r border-gray-200 flex flex-col min-h-0">
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="space-y-1">
          <NavItems items={mainNav} />
        </div>
        <div className="my-3 mx-3 border-t border-gray-200" />
        <div className="space-y-1">
          <NavItems items={infoNav} />
        </div>
      </nav>
    </aside>
  );
}
