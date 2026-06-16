import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { styles } from '../styles';
import { loadResultPayload, type ResultVariant } from '../utils/resultStorage';
import { type UiText } from '../content/uiText';

type Props = {
  variant: ResultVariant;
  t: UiText;
};

export default function ResultPage({ t, variant }: Props) {
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
          <p style={styles.error}>{t.result.empty}</p>
        </>
      );
    }

    const { result } = state;
    return (
      <>
        <h1 style={styles.title}>
          {variant === 'modificado'
            ? t.result.titles.modified
            : t.result.titles.classic}
        </h1>
        <InfoRow label={t.result.rows.callPrice} value={result.call} />
        <InfoRow label={t.result.rows.putPrice} value={result.put} />
        <InfoRow
          label={t.result.rows.timeToExpiration}
          value={result.T}
          formatter={(v) => v.toFixed(6)}
        />
        <InfoRow
          label={t.result.rows.businessDays}
          value={result.diasUteis}
        />
        {variant === 'modificado' && state?.p !== undefined ? (
          <InfoRow
            label={t.result.rows.pParameter}
            value={state.p}
            formatter={(v) => v.toFixed(4)}
          />
        ) : null}
        <section style={styles.section}>
          <p style={styles.sectionTitle}>
            {t.result.sections.usedParameters}
          </p>
          <p style={styles.sectionText}>S: {result.inputs.S}</p>
          <p style={styles.sectionText}>K: {result.inputs.K}</p>
          <p style={styles.sectionText}>r: {result.inputs.r}</p>
          <p style={styles.sectionText}>
            {t.result.parameters.sigma}: {result.inputs.sigma}
          </p>
          <p style={styles.sectionText}>
            {t.result.parameters.deltaCall}: {result.deltaCall}
          </p>
          <p style={styles.sectionText}>
            {t.result.parameters.deltaPut}: {result.deltaPut}
          </p>
          <p style={styles.sectionText}>
            {t.result.parameters.vega}: {result.vega}
          </p>
          <p style={styles.sectionText}>
            {t.result.parameters.gamma}: {result.gama}
          </p>
          <p style={styles.sectionText}>
            {t.result.sections.currentDate}: {result.inputs.dataAtual}
          </p>
          <p style={styles.sectionText}>
            {t.result.sections.expiration}: {result.inputs.dataVencimento}
          </p>
        </section>
        <button style={styles.secondaryButton} onClick={() => navigate('/')}>
          {t.result.actions.back}
        </button>
      </>
    );
  }, [navigate, state, t, variant]);

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
