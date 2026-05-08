import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  blackScholesCall,
  blackScholesPut,
  blackScholesCallModified,
  blackScholesPutModified,
  calcularDiasUteis,
  calcularTempoEmAnos,
  calculaGregas,
} from '../utils/blackScholes';
import { saveResultPayload } from '../utils/resultStorage';
import { styles } from '../styles';
import { parseDate, formatDateInput } from '../utils/dateHelpers';
import { type SearchItem } from '../api/search';


// Interface do retorno da API do BCB
interface RespostaBcb {
  data: string;
  valor: string;
}

// Serviço para buscar a Selic isolado
async function buscarTaxaSelic(): Promise<number> {
  try {
    const url = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json';
    const resposta = await fetch(url);
    if (!resposta.ok) {
      throw new Error(`Erro HTTP ao acessar BCB: ${resposta.status}`);
    }
    const dados: RespostaBcb[] = await resposta.json();
    if (dados.length > 0) {
      // Divide por 100 pois o modelo Black-Scholes usa taxa em decimal
      return parseFloat(dados[0].valor) / 100;
    }
    throw new Error("Dados da Selic vazios na resposta.");
  } catch (erro) {
    console.error("Falha ao buscar a Selic:", erro);
    throw erro;
  }
}


type FormState = {
  S: string;
  K: string;
  r: string;
  sigma: string;
  p: string;
  dataAtual: string;
  dataVencimento: string;
};

const today = new Date();
const defaultVencimento = new Date();
defaultVencimento.setDate(today.getDate() + 90);

const MARKET_DATA_URL =
  'https://raw.githubusercontent.com/iagomarcolino/Consultprice/main/data/marketdata.json';
const AUTOCOMPLETE_MIN_CHARS = 2;
const AUTOCOMPLETE_DEBOUNCE_MS = 350;
const MARKET_CACHE_TTL_MS = 5 * 60 * 1000;

function normalizeTicker(raw: string): string {
  const ticker = raw.trim().toUpperCase();
  if (!ticker) return '';
  return ticker.includes('.') ? ticker : `${ticker}.SA`;
}

function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

type MarketDataItem = {
  symbol?: string;
  name?: string;
  price?: number;
  vol_annual?: number;
};

const marketDataCache: {
  data: MarketDataItem[] | null;
  fetchedAt: number;
} = {
  data: null,
  fetchedAt: 0,
};

async function loadMarketData(
  signal?: AbortSignal,
): Promise<MarketDataItem[]> {
  if (
    marketDataCache.data &&
    Date.now() - marketDataCache.fetchedAt < MARKET_CACHE_TTL_MS
  ) {
    return marketDataCache.data;
  }

  const resp = await fetch(`${MARKET_DATA_URL}?t=${Date.now()}`, {
    cache: 'no-store',
    signal,
  });
  if (!resp.ok) {
    throw new Error('HTTP error');
  }

  const json = await resp.json();
  const data = Array.isArray(json?.data) ? json.data : [];
  marketDataCache.data = data;
  marketDataCache.fetchedAt = Date.now();
  return data;
}

function getMatches(
  data: MarketDataItem[],
  rawTerm: string,
): MarketDataItem[] {
  const term = rawTerm.trim();
  if (!term) return [];

  const exactSymbol = normalizeTicker(term);
  const partialSymbol = term.toUpperCase();
  const normalizedName = normalizeText(term);

  return data.filter((item) => {
    const symbol =
      typeof item?.symbol === 'string' ? item.symbol.toUpperCase() : '';
    const name = typeof item?.name === 'string' ? item.name : '';
    const symbolExactMatch = symbol !== '' && symbol === exactSymbol;
    const symbolPartialMatch =
      partialSymbol.length >= 2 && symbol.includes(partialSymbol);
    const nameMatch =
      normalizedName.length >= 2 &&
      normalizeText(name).includes(normalizedName);
    return symbolExactMatch || symbolPartialMatch || nameMatch;
  });
}

function toSearchItem(
  item: MarketDataItem,
  fallbackSymbol: string,
): SearchItem {
  const symbol = item.symbol ?? fallbackSymbol;
  return {
    symbol,
    name: item.name ?? symbol,
    exchange: 'Dados GitHub',
    price: item.price,
    volAnnual: item.vol_annual,
  };
}

const initialState: FormState = {
  S: '100',
  K: '105',
  r: '',  // espera api do bcb
  sigma: '0.2',
  p: '1.0',
  dataAtual: formatDateInput(today),
  dataVencimento: formatDateInput(defaultVencimento),
};

export default function FormPage() {
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
  const [pinnedResults, setPinnedResults] = useState<SearchItem[] | null>(null);
  const [selectedResultIndex, setSelectedResultIndex] = useState('');
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const navigate = useNavigate();
  const autocompleteController = useRef<AbortController | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayedResults = pinnedResults ?? searchResults;

  // Estados para a requisição da Selic
  const [selicLoading, setSelicLoading] = useState(false);
  const [selicError, setSelicError] = useState<string | null>(null);

  // Efeito para buscar a Selic na inicialização
  useEffect(() => {
    const carregarSelic = async () => {
      try {
        setSelicLoading(true);
        const taxaAtual = await buscarTaxaSelic();
        setForm((prev) => ({
          ...prev,
          r: String(taxaAtual)
        }));
      } catch (e) {
        setSelicError("Falha na API BCB. Usando valor padrão.");
        // Valor de fallback caso a API do BCB falhe
        setForm((prev) => ({ ...prev, r: '0.105' }));
      } finally {
        setSelicLoading(false);
      }
    };
    carregarSelic();
  }, []);


  const applySearchItemToForm = (item: SearchItem) => {
    setForm((prev) => ({
      ...prev,
      ...(item.price !== undefined ? { S: String(item.price) } : {}),
      ...(item.volAnnual !== undefined
        ? { sigma: String(item.volAnnual) }
        : {}),
    }));
  };

  const handleSearch = async () => {
    const rawTerm = searchTerm.trim();
    const normalizedSymbol = normalizeTicker(rawTerm);
    if (!rawTerm) {
      setSearchMessage('Informe um ticker ou nome.');
      setSearchResults([]);
      setPinnedResults(null);
      setSelectedResultIndex('');
      return;
    }
    setSearchLoading(true);
    setSearchMessage(null);
    setSearchResults([]);
    setPinnedResults(null);
    setSelectedResultIndex('');
    try {
      const data = await loadMarketData();
      const matches = getMatches(data, rawTerm);

      if (matches.length === 0) {
        setSearchMessage('Ativo nao encontrado.');
        return;
      }

      const exactSymbolMatch = matches.find((item) => {
        if (typeof item?.symbol !== 'string') return false;
        return item.symbol.toUpperCase() === normalizedSymbol;
      });
      const preferredMatch =
        exactSymbolMatch ?? (matches.length === 1 ? matches[0] : null);

      if (preferredMatch) {
        applySearchItemToForm(
          toSearchItem(preferredMatch, normalizedSymbol),
        );
      }

      setSearchResults(
        matches.map((item) => toSearchItem(item, normalizedSymbol)),
      );
    } catch (err) {
      setSearchMessage('Erro ao consultar dados.');
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    const term = searchTerm.trim();
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (!term || term.length < AUTOCOMPLETE_MIN_CHARS) {
      if (autocompleteController.current) {
        autocompleteController.current.abort();
      }
      setSearchLoading(false);
      setSearchResults([]);
      setSelectedResultIndex('');
      setSearchMessage(null);
      return;
    }

    debounceTimer.current = setTimeout(() => {
      if (autocompleteController.current) {
        autocompleteController.current.abort();
      }
      const controller = new AbortController();
      autocompleteController.current = controller;

      setSearchLoading(true);
      setSearchMessage(null);
      loadMarketData(controller.signal)
        .then((data) => {
          const matches = getMatches(data, term);
          setSearchResults(
            matches.map((item) => toSearchItem(item, normalizeTicker(term))),
          );
          if (matches.length === 0) {
            setSearchMessage('Nenhum resultado.');
          }
        })
        .catch((err) => {
          if ((err as Error).name === 'AbortError') return;
          setSearchMessage('Erro ao consultar dados.');
        })
        .finally(() => {
          setSearchLoading(false);
        });
    }, AUTOCOMPLETE_DEBOUNCE_MS);
  }, [searchTerm]);

  useEffect(
    () => () => {
      if (autocompleteController.current) {
        autocompleteController.current.abort();
      }
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    },
    [],
  );

  const handleChange = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
  };

  const calculateClassic = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const parsed = parseInputs(form, { requireP: false });
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    const { S, K, r, sigma, dataAtual, dataVencimento } = parsed;
    const diasUteis = calcularDiasUteis(dataAtual, dataVencimento);
    const T = calcularTempoEmAnos(dataAtual, dataVencimento);
    const call = blackScholesCall(S, K, r, sigma, dataAtual, dataVencimento);
    const put = blackScholesPut(S, K, r, sigma, dataAtual, dataVencimento);
    const gregas = calculaGregas(S, K, r, sigma, dataAtual, dataVencimento);

    saveResultPayload({
      variant: 'classico',
      result: {
        call,
        put,
        T,
        diasUteis,
        ...gregas,
        inputs: form,
      },
    });
    navigate('/resultado');
  };

  const calculateModified = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const parsed = parseInputs(form, { requireP: true });
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    const { S, K, r, sigma, p, dataAtual, dataVencimento } = parsed;
    const diasUteis = calcularDiasUteis(dataAtual, dataVencimento);
    const T = calcularTempoEmAnos(dataAtual, dataVencimento);
    const call = blackScholesCallModified(
      S,
      K,
      r,
      sigma,
      p,
      dataAtual,
      dataVencimento,
    );
    const put = blackScholesPutModified(
      S,
      K,
      r,
      sigma,
      p,
      dataAtual,
      dataVencimento,
    );

    saveResultPayload({
      variant: 'modificado',
      p,
      result: {
        call,
        put,
        T,
        diasUteis,
        inputs: form,
      },
    });
    navigate('/resultado-modificado');
  };

  return (
    <main style={styles.container}>
      <div>
        <h1 style={styles.title}>Calculadora Black-Scholes</h1>
        <p style={styles.subtitle}>
          Preencha os parametros anuais. Datas sao usadas para calcular T (dias uteis/252).
        </p>
      </div>

      <div style={styles.searchRow}>
        <input
          style={{ ...styles.input, ...styles.searchInput, marginTop: 0 }}
          value={searchTerm}
          onChange={(e) => {
            setPinnedResults(null);
            setSelectedResultIndex('');
            setSearchTerm(e.target.value);
          }}
          placeholder="Buscar ativo (ticker ou nome, ex: PETR4.SA, Ambev)"
        />
        <button
          style={{ ...styles.secondaryButton, marginTop: 0 }}
          type="button"
          onClick={handleSearch}
          disabled={searchLoading}
        >
          {searchLoading ? 'Buscando...' : 'Pesquisar'}
        </button>
      </div>

      {searchMessage ? <p style={styles.error}>{searchMessage}</p> : null}
      {displayedResults.length > 0 ? (
        <select
          style={{ ...styles.input, ...styles.searchInput, marginTop: 0 }}
          size={Math.min(6, displayedResults.length + 1)}
          value={selectedResultIndex}
          onChange={(e) => {
            const value = e.target.value;
            setSelectedResultIndex(value);
            if (value === '') return;
            const index = Number(value);
            if (!Number.isFinite(index)) return;
            const item = displayedResults[index];
            if (!item) return;

            // Aplica os dados ao formulário
            applySearchItemToForm(item);

            // Escreve o ticker do ativo na caixa de busca
            setSearchTerm(item.symbol);

            // Limpa os resultados para fechar a aba de sugestões
            setSearchResults([]);
            setPinnedResults(null);
            setSelectedResultIndex('');
          }}
        >
          <option value="" disabled>
            Selecione um ativo
          </option>
          {displayedResults.map((item, index) => (
            <option
              key={`${item.symbol}-${item.exchange}`}
              value={String(index)}
            >
              {item.symbol} - {item.name}
              {item.price !== undefined ? ` (R$ ${item.price})` : ''}
            </option>
          ))}
        </select>
      ) : null}

      <form style={styles.form} onSubmit={handleSubmit}>
        <Input
          label="S - Preco do ativo"
          hint="Preco atual do ativo subjacente (spot)."
          value={form.S}
          onChange={(e) => handleChange('S', e.target.value)}
          inputMode="decimal"
        />
        <Input
          label="K - Preco de exercicio"
          hint="Strike: preco de exercicio no vencimento."
          value={form.K}
          onChange={(e) => handleChange('K', e.target.value)}
          inputMode="decimal"
        />
        <Input
          label="r - Taxa livre de risco (anual)"
          hint="Taxa livre de risco anual em decimal Selic(0.05 = 5%)."
          value={form.r}
          onChange={(e) => handleChange('r', e.target.value)}
          inputMode="decimal"
        />
        <Input
          label="sigma - Volatilidade anual"
          hint="Volatilidade anual do ativo em decimal (0.2 = 20%)."
          value={form.sigma}
          onChange={(e) => handleChange('sigma', e.target.value)}
          inputMode="decimal"
        />
        <Input
          label="p - Parametro (modelo modificado)"
          hint="Parametro do Black-Scholes modificado; use apenas no modificado (sugestao: 0.5 a 1.5)."
          value={form.p}
          onChange={(e) => handleChange('p', e.target.value)}
          inputMode="decimal"
          placeholder="1.0"
        />
        <Input
          label="Data atual (DD/MM/AAAA)"
          hint="Data base para calcular o tempo ate o vencimento."
          value={form.dataAtual}
          onChange={(e) => handleChange('dataAtual', e.target.value)}
          inputMode="text"
          placeholder="12/12/2025"
        />
        <Input
          label="Data de vencimento (DD/MM/AAAA)"
          hint="Data de expiracao da opcao."
          value={form.dataVencimento}
          onChange={(e) => handleChange('dataVencimento', e.target.value)}
          inputMode="text"
          placeholder="12/03/2026"
        />

        {error ? <p style={styles.error}>{error}</p> : null}

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            style={{ ...styles.button, ...styles.actionButton }}
            type="button"
            onClick={calculateClassic}
          >
            Calcular classico
          </button>
          <button
            style={{ ...styles.secondaryButton, ...styles.actionButton }}
            type="button"
            onClick={calculateModified}
          >
            Calcular modificado
          </button>
        </div>
      </form>
    </main>
  );
}

function Input({
  label,
  hint,
  ...props
}: {
  label: string;
  hint?: string;
  value: string;
  inputMode?: 'decimal' | 'text';
  placeholder?: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label style={styles.inputGroup}>
      <span style={styles.labelRow}>
        <span style={styles.label}>{label}</span>
        {hint ? <InfoTip text={hint} /> : null}
      </span>
      <input style={styles.input} {...props} />
    </label>
  );
}

function InfoTip({ text }: { text: string }) {
  const [isPinned, setIsPinned] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isOpen = isPinned || isHovered;

  return (
    <span
      style={styles.hintWrapper}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        type="button"
        style={styles.hintIcon}
        aria-label={`Ajuda: ${text}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsPinned((prev) => !prev);
        }}
        onBlur={() => setIsPinned(false)}
      >
        ?
      </button>
      {isOpen ? (
        <span style={styles.hintBubble} role="tooltip">
          {text}
        </span>
      ) : null}
    </span>
  );
}

function parseInputs(
  form: FormState,
  { requireP }: { requireP: boolean },
):
  | {
    ok: true;
    S: number;
    K: number;
    r: number;
    sigma: number;
    p?: number;
    dataAtual: Date;
    dataVencimento: Date;
  }
  | { ok: false; error: string } {
  const S = Number(form.S);
  const K = Number(form.K);
  const r = Number(form.r);
  const sigma = Number(form.sigma);
  const p = Number(form.p);
  const dataAtual = parseDate(form.dataAtual);
  const dataVencimento = parseDate(form.dataVencimento);

  if ([S, K, r, sigma].some((n) => Number.isNaN(n))) {
    return { ok: false, error: 'Preencha valores numericos validos.' };
  }

  if (requireP && (Number.isNaN(p) || p <= 0)) {
    return { ok: false, error: 'Parametro p deve ser maior que zero.' };
  }

  if (!dataAtual || !dataVencimento) {
    return { ok: false, error: 'Datas devem estar no formato DD/MM/AAAA.' };
  }

  return {
    ok: true,
    S,
    K,
    r,
    sigma,
    ...(requireP ? { p } : {}),
    dataAtual,
    dataVencimento,
  };
}
