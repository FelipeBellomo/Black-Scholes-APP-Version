import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { styles } from '../styles';
import { loadResultPayload, type ResultVariant } from '../utils/resultStorage';

type Props = {
  variant: ResultVariant;
};

export default function ResultPage({ variant }: Props) {
  const navigate = useNavigate();
  const state = useMemo(() => loadResultPayload(variant), [variant]);

  useEffect(() => {
    if (!state?.result) {
      navigate('/', { replace: true });
    }
  }, [navigate, state, variant]);

  const content = useMemo(() => {
    if (!state?.result) {
      return (
        <>
          <p style={styles.error}>Nenhum resultado salvo. Redirecionando...</p>
        </>
      );
    }

    const { result } = state;
    return (
      <>
        <h1 style={styles.title}>
          {variant === 'modificado'
            ? 'Black-Scholes Modificado'
            : 'Black-Scholes Classico'}
        </h1>
        <InfoRow label="Preco teorico - Call (C)" value={result.call} />
        <InfoRow label="Preco teorico - Put (P)" value={result.put} />
        <InfoRow
          label="Tempo ate o vencimento (anos)"
          value={result.T}
          formatter={(v) => v.toFixed(6)}
        />
        <InfoRow label="Dias uteis considerados" value={result.diasUteis} />
        {variant === 'modificado' && state?.p !== undefined ? (
          <InfoRow
            label="Parametro p"
            value={state.p}
            formatter={(v) => v.toFixed(4)}
          />
        ) : null}
        <section style={styles.section}>
          <p style={styles.sectionTitle}>Parametros usados</p>
          <p style={styles.sectionText}>S: {result.inputs.S}</p>
          <p style={styles.sectionText}>K: {result.inputs.K}</p>
          <p style={styles.sectionText}>r: {result.inputs.r}</p>
          <p style={styles.sectionText}>sigma: {result.inputs.sigma}</p>
          <p style={styles.sectionText}>delta Call: {result.deltaCall}</p>
          <p style={styles.sectionText}>delta Put: {result.deltaPut}</p>
          <p style={styles.sectionText}>vega: {result.vega}</p>
          <p style={styles.sectionText}>gama: {result.gama}</p>
          <p style={styles.sectionText}>
            Data atual: {result.inputs.dataAtual}
          </p>
          <p style={styles.sectionText}>
            Vencimento: {result.inputs.dataVencimento}
          </p>
        </section>
        <button style={styles.secondaryButton} onClick={() => navigate('/')}>
          Voltar
        </button>
      </>
    );
  }, [navigate, state, variant]);

  return <main style={styles.container}>{content}</main>;
}

function InfoRow({
  label,
  value,
  formatter,
}: {
  label: string;
  value: number;
  formatter?: (v: number) => string;
}) {
  const display = formatter ? formatter(value) : value.toFixed(4);
  return (
    <div style={styles.row}>
      <span style={styles.rowLabel}>{label}</span>
      <span style={styles.rowValue}>{display}</span>
    </div>
  );
}
