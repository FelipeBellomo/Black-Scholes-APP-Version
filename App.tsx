import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import FormPage from './src/pages/FormPage';
import ResultPage from './src/pages/ResultPage';
import { styles } from './src/styles';

export default function App() {
  return (
    <div style={styles.page}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<FormPage />} />
          <Route path="/resultado" element={<ResultPage variant="classico" />} />
          <Route
            path="/resultado-modificado"
            element={<ResultPage variant="modificado" />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </div>
  );
}
