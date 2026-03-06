import { useState, useRef, useEffect } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { LogOut, ChevronDown, Globe } from 'lucide-react';
import { logo } from '../../guidelines/design-tokens';
import { useLanguage } from '../../i18n/LanguageContext';

function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <button
      onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
      title={language === 'es' ? 'Switch to English' : 'Cambiar a Espanol'}
    >
      <Globe size={14} />
      <span className="uppercase">{language}</span>
    </button>
  );
}

function UserMenu() {
  const { user, signOut } = useAuthenticator(context => [context.user]);
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const email = user?.signInDetails?.loginId || '';
  const initials = email.split('@')[0].slice(0, 2).toUpperCase();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full hover:bg-gray-100 p-1 pr-3 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center">
          <span className="text-white text-xs font-semibold">{initials}</span>
        </div>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center">
                <span className="text-white text-sm font-semibold">{initials}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{email}</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => { setOpen(false); signOut(); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut size={16} />
            {t('header.signOut')}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Header() {
  return (
    <header className="bg-white border-b border-gray-200 shrink-0">
      <div className="px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={logo.url} alt={logo.altText} className="h-6" />
          <span className="text-xs font-mono text-gray-400 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-md">
            Evals
          </span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
