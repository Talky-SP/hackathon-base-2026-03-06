import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Home, PenLine, Database, FlaskConical, BarChart3, FileText,
  BookOpen, Target, Rocket, Package, ChevronDown, FolderOpen, Bot, Activity,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';

type NavItem = { to: string; labelKey: TranslationKey; icon: typeof Home };

type NavGroup = {
  labelKey: TranslationKey;
  icon: typeof Home;
  children: NavItem[];
};

const mainNav: (NavItem | NavGroup)[] = [
  { to: '/welcome', labelKey: 'nav.welcome', icon: Home },
  {
    labelKey: 'nav.annotations',
    icon: FolderOpen,
    children: [
      { to: '/annotation', labelKey: 'nav.annotationDocs', icon: PenLine },
      { to: '/stock-annotations', labelKey: 'nav.annotationStock', icon: Package },
    ],
  },
  {
    labelKey: 'nav.goldenDatasets',
    icon: Database,
    children: [
      { to: '/golden-dataset', labelKey: 'nav.goldenDatasetDocs', icon: FileText },
      { to: '/stock-golden-datasets', labelKey: 'nav.goldenDatasetStock', icon: Package },
    ],
  },
  {
    labelKey: 'nav.tests',
    icon: FlaskConical,
    children: [
      { to: '/test', labelKey: 'nav.testDocs', icon: FileText },
      { to: '/stock-test', labelKey: 'nav.testStock', icon: Package },
    ],
  },
  { to: '/analytics', labelKey: 'nav.analytics', icon: BarChart3 },
  { to: '/pipeline-observability', labelKey: 'nav.pipelineObservability', icon: Activity },
  { to: '/agent', labelKey: 'nav.agent', icon: Bot },
];

const infoNav: NavItem[] = [
  { to: '/objectives', labelKey: 'nav.objectives', icon: Target },
  { to: '/getting-started', labelKey: 'nav.gettingStarted', icon: Rocket },
  { to: '/docs', labelKey: 'nav.docs', icon: FileText },
  { to: '/resources', labelKey: 'nav.resources', icon: BookOpen },
];

function isNavGroup(item: NavItem | NavGroup): item is NavGroup {
  return 'children' in item;
}

function NavItemLink({ item }: { item: NavItem }) {
  const { t } = useLanguage();
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-2.5 py-2 rounded-lg transition-colors whitespace-nowrap ${
          isActive
            ? 'bg-brand-50 text-brand-600'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }`
      }
    >
      <item.icon size={20} className="shrink-0" />
      <span className="text-sm font-medium opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200">
        {t(item.labelKey)}
      </span>
    </NavLink>
  );
}

function NavGroupSection({ group }: { group: NavGroup }) {
  const { t } = useLanguage();
  const location = useLocation();
  const isChildActive = group.children.some(c => location.pathname.startsWith(c.to));
  const [open, setOpen] = useState(isChildActive);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg transition-colors whitespace-nowrap ${
          isChildActive && !open
            ? 'bg-brand-50 text-brand-600'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }`}
      >
        <group.icon size={20} className="shrink-0" />
        <span className="text-sm font-medium opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 flex-1 text-left">
          {t(group.labelKey)}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-gray-400 opacity-0 group-hover/sidebar:opacity-100 transition-all duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="ml-3 pl-3 border-l border-gray-200 space-y-0.5 mt-0.5 max-h-0 overflow-hidden opacity-0 group-hover/sidebar:max-h-screen group-hover/sidebar:opacity-100 transition-all duration-200">
          {group.children.map(child => (
            <NavLink
              key={child.to}
              to={child.to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-brand-50 text-brand-600'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <child.icon size={16} className="shrink-0" />
              <span className="text-[13px] font-medium">
                {t(child.labelKey)}
              </span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

function NavItems({ items }: { items: (NavItem | NavGroup)[] }) {
  return (
    <>
      {items.map((item, i) =>
        isNavGroup(item)
          ? <NavGroupSection key={i} group={item} />
          : <NavItemLink key={item.to} item={item} />
      )}
    </>
  );
}

function SimpleNavItems({ items }: { items: NavItem[] }) {
  return (
    <>
      {items.map(item => (
        <NavItemLink key={item.to} item={item} />
      ))}
    </>
  );
}

export default function Sidebar() {
  return (
    <aside className="group/sidebar w-14 hover:w-52 bg-white border-r border-gray-200 flex flex-col min-h-0 shrink-0 transition-all duration-200 overflow-hidden">
      <nav className="flex-1 px-2 py-4 overflow-y-auto overflow-x-hidden">
        <div className="space-y-0.5">
          <NavItems items={mainNav} />
        </div>
        <div className="my-3 mx-1 border-t border-gray-200" />
        <div className="space-y-0.5">
          <SimpleNavItems items={infoNav} />
        </div>
      </nav>
    </aside>
  );
}
