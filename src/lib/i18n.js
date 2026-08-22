import { DICTIONARY } from '../../js/i18n.js';

export { DICTIONARY };

export function t(lang, key) {
  const dict = DICTIONARY[lang === 'th' ? 'th' : 'en'] || DICTIONARY.en;
  return dict[key] ?? DICTIONARY.en[key] ?? key;
}

export function useCopy(lang) {
  const code = lang === 'th' ? 'th' : 'en';
  return (key) => t(code, key);
}
