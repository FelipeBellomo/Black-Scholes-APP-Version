export type ResultVariant = 'classico' | 'modificado';

export type StoredResultPayload = {
  variant: ResultVariant;
  p?: number;
  result: {
    call: number;
    put: number;
    T: number;
    diasUteis: number;
    deltaCall?: number;
    deltaPut?: number;
    vega?: number;
    gama?: number;
    inputs: {
      S: string;
      K: string;
      r: string;
      sigma: string;
      p: string;
      dataAtual: string;
      dataVencimento: string;
    };
  };
};

const STORAGE_KEY_BY_VARIANT: Record<ResultVariant, string> = {
  classico: 'black-scholes:resultado:classico',
  modificado: 'black-scholes:resultado:modificado',
};

export function saveResultPayload(payload: StoredResultPayload) {
  localStorage.setItem(
    STORAGE_KEY_BY_VARIANT[payload.variant],
    JSON.stringify(payload),
  );
}

export function loadResultPayload(
  variant: ResultVariant,
): StoredResultPayload | null {
  const raw = localStorage.getItem(STORAGE_KEY_BY_VARIANT[variant]);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredResultPayload> | null;
    if (!parsed || parsed.variant !== variant || !parsed.result) {
      return null;
    }

    return parsed as StoredResultPayload;
  } catch {
    return null;
  }
}
