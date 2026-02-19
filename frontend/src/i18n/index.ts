import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import es from './es.json';

const savedLang = typeof window !== 'undefined' ? localStorage.getItem('qr_language') : null;

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: savedLang || 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

// Persist language choice
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('qr_language', lng);
});

export default i18n;
