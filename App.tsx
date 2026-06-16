import { useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import FormPage from './src/pages/FormPage';
import ResultPage from './src/pages/ResultPage';
import {
  DEFAULT_LANGUAGE,
  getUiText,
  isLanguage,
  LANGUAGE_STORAGE_KEY,
  type Language,
} from './src/content/uiText';
import { styles } from './src/styles';

export default function App() {
  const [language, setLanguage] = useState<Language>(() => {
    const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isLanguage(savedLanguage)) {
      return savedLanguage;
    }
    if (savedLanguage) {
      localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    }
    return DEFAULT_LANGUAGE;
  });
  const t = getUiText(language);

  const handleLanguageChange = (nextLanguage: Language) => {
    setLanguage(nextLanguage);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
  };

  return (
    <div style={styles.page}>
      <HashRouter>
        <Routes>
          <Route
            path="/"
            element={
              <FormPage
                language={language}
                onLanguageChange={handleLanguageChange}
                t={t}
              />
            }
          />
          <Route
            path="/resultado"
            element={<ResultPage variant="classico" t={t} />}
          />
          <Route
            path="/resultado-modificado"
            element={<ResultPage variant="modificado" t={t} />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </div>
  );
}
