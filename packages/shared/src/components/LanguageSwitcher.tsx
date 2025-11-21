import React from 'react';
import { useTranslation } from 'react-i18next';

export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('i18nextLng', lng);
  };

  return (
    <div className="flex space-x-2">
      <button
        onClick={() => changeLanguage('en')}
        className={`px-2 py-1 rounded ${i18n.language?.startsWith('en') ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
      >
        EN
      </button>
      <button
        onClick={() => changeLanguage('fr')}
        className={`px-2 py-1 rounded ${i18n.language?.startsWith('fr') ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
      >
        FR
      </button>
    </div>
  );
};
