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
import { uiText } from '../content/uiText';
import { salvarJsonDiario, obterJsonDiario } from '../utils/dailyStorage';


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
  const CHAVE_CACHE = 'market_data_diario';

  // 1. Tenta buscar do armazenamento local (válido até 23:59)
  const dadosEmCache = obterJsonDiario<MarketDataItem[]>(CHAVE_CACHE);

  if (dadosEmCache) {
    console.log("Dados carregados do cache diário local.");
    return dadosEmCache;
  }

  // 2. Se não tem cache ou já passou de meia-noite, faz a requisição no GitHub
  console.log("Baixando dados do GitHub...");
  const resp = await fetch(`${MARKET_DATA_URL}?t=${Date.now()}`, {
    cache: 'no-store',
    signal,
  });

  if (!resp.ok) {
    throw new Error('HTTP error');
  }

  const json = await resp.json();
  const data = Array.isArray(json?.data) ? json.data : [];

  // 3. Salva os dados baixados no armazenamento local para o resto do dia
  salvarJsonDiario<MarketDataItem[]>(CHAVE_CACHE, data);

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
  p: '0.75',
  dataAtual: formatDateInput(today),
  dataVencimento: formatDateInput(defaultVencimento),
};

const FORM_CACHE_KEY = 'black-scholes:form';

function loadCachedFormState(): FormState {
  const raw = localStorage.getItem(FORM_CACHE_KEY);
  if (!raw) {
    return initialState;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<FormState> | null;
    if (
      !parsed ||
      typeof parsed.S !== 'string' ||
      typeof parsed.K !== 'string' ||
      typeof parsed.r !== 'string' ||
      typeof parsed.sigma !== 'string' ||
      typeof parsed.p !== 'string' ||
      typeof parsed.dataAtual !== 'string' ||
      typeof parsed.dataVencimento !== 'string'
    ) {
      return initialState;
    }

    return {
      S: parsed.S,
      K: parsed.K,
      r: parsed.r,
      sigma: parsed.sigma,
      p: parsed.p,
      dataAtual: parsed.dataAtual,
      dataVencimento: parsed.dataVencimento,
    };
  } catch {
    return initialState;
  }
}

function saveCachedFormState(form: FormState) {
  try {
    localStorage.setItem(FORM_CACHE_KEY, JSON.stringify(form));
  } catch {
    // Ignora erros de storage para nao bloquear o calculo.
  }
}

export default function FormPage() {
  const [form, setForm] = useState<FormState>(() => loadCachedFormState());
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
  const [pinnedResults, setPinnedResults] = useState<SearchItem[] | null>(null);
  const [selectedResultIndex, setSelectedResultIndex] = useState('');
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isPInfoOpen, setIsPInfoOpen] = useState(false);
  const navigate = useNavigate();
  const autocompleteController = useRef<AbortController | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextAutocompleteRef = useRef(false);
  const vencimentoDateInputRef = useRef<HTMLInputElement | null>(null);
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
          r: prev.r || String(taxaAtual)
        }));
      } catch (e) {
        setSelicError(uiText.form.errors.bcbFallback);
        // Valor de fallback caso a API do BCB falhe
        setForm((prev) => ({ ...prev, r: prev.r || '0.105' }));
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
      setSearchMessage(uiText.form.search.emptyTerm);
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
        setSearchMessage(uiText.form.search.notFound);
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
      setSearchMessage(uiText.form.search.fetchError);
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    const term = searchTerm.trim();
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (skipNextAutocompleteRef.current) {
      skipNextAutocompleteRef.current = false;
      if (autocompleteController.current) {
        autocompleteController.current.abort();
      }
      setSearchResults([]);
      setPinnedResults(null);
      setSelectedResultIndex('');
      return;
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
            setSearchMessage(uiText.form.search.noResults);
          }
        })
        .catch((err) => {
          if ((err as Error).name === 'AbortError') return;
          setSearchMessage(uiText.form.search.fetchError);
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

  const openVencimentoDatePicker = () => {
    const input = vencimentoDateInputRef.current;
    if (!input) return;

    const dateInput = input as HTMLInputElement & {
      showPicker?: () => void;
    };

    if (typeof dateInput.showPicker === 'function') {
      try {
        dateInput.showPicker();
        return;
      } catch {
        // Continua com o fallback quando o WebView nao permite showPicker.
      }
    }

    input.focus();
    input.click();
  };

  const handleVencimentoDateChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const formattedDate = formatNativeDateInput(event.target.value);
    if (!formattedDate) return;
    handleChange('dataVencimento', formattedDate);
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

    saveCachedFormState(form);
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

    saveCachedFormState(form);
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
        <h1 style={styles.title}>{uiText.form.title}</h1>
        <p style={styles.subtitle}>
          {uiText.form.subtitle}
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
          placeholder={uiText.form.search.placeholder}
        />
        <button
          style={{
            ...styles.secondaryButton,
            width: 48,
            height: 48,
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 0,
          }}
          type="button"
          onClick={handleSearch}
          disabled={searchLoading}
          aria-label={
            searchLoading
              ? uiText.form.search.searchingAsset
              : uiText.form.search.searchAsset
          }
        >
          <SearchIcon />
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
            skipNextAutocompleteRef.current = true;
            setSearchTerm(item.symbol);

            // Limpa os resultados para fechar a aba de sugestões
            setSearchResults([]);
            setPinnedResults(null);
            setSelectedResultIndex('');
            setSearchMessage(null);
          }}
        >
          <option value="" disabled>
            {uiText.form.search.selectAsset}
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
          label={uiText.form.fields.spot.label}
          hint={uiText.form.fields.spot.hint}
          value={form.S}
          onChange={(e) => handleChange('S', e.target.value)}
          inputMode="decimal"
        />
        <Input
          label={uiText.form.fields.strike.label}
          hint={uiText.form.fields.strike.hint}
          value={form.K}
          onChange={(e) => handleChange('K', e.target.value)}
          inputMode="decimal"
        />
        <Input
          label={uiText.form.fields.riskFreeRate.label}
          hint={uiText.form.fields.riskFreeRate.hint}
          value={form.r}
          onChange={(e) => handleChange('r', e.target.value)}
          inputMode="decimal"
        />
        <Input
          label={uiText.form.fields.volatility.label}
          hint={uiText.form.fields.volatility.hint}
          value={form.sigma}
          onChange={(e) => handleChange('sigma', e.target.value)}
          inputMode="decimal"
        />
        <Input
          label={uiText.form.fields.currentDate.label}
          hint={uiText.form.fields.currentDate.hint}
          value={form.dataAtual}
          onChange={(e) => handleChange('dataAtual', e.target.value)}
          inputMode="text"
          placeholder="12/12/2025"
        />
        <Input
          label={uiText.form.fields.expirationDate.label}
          hint={uiText.form.fields.expirationDate.hint}
          value={form.dataVencimento}
          onChange={(e) => handleChange('dataVencimento', e.target.value)}
          inputMode="text"
          placeholder="12/03/2026"
          leadingIcon={<CalendarIcon />}
          leadingIconLabel={uiText.form.fields.expirationDate.openCalendar}
          onLeadingIconClick={openVencimentoDatePicker}
        />
        <input
          ref={vencimentoDateInputRef}
          type="date"
          value={toNativeDateInputValue(form.dataVencimento)}
          onChange={handleVencimentoDateChange}
          aria-hidden="true"
          tabIndex={-1}
          style={hiddenDateInputStyle}
        />
        <label style={styles.inputGroup}>
          <span style={styles.labelRow}>
            <span style={styles.label}>
              {uiText.form.fields.pParameter.label}
            </span>
            <InfoTip text={uiText.form.fields.pParameter.hint} />
          </span>
          <span style={pInputRowStyle}>
            <input
              style={{ ...styles.input, width: 128 }}
              value={form.p}
              onChange={(e) => handleChange('p', e.target.value)}
              inputMode="decimal"
              placeholder="1.0"
            />
            <button
              type="button"
              aria-label={uiText.form.fields.pParameter.explain}
              style={pInfoButtonStyle}
              onClick={() => setIsPInfoOpen(true)}
            >
              <LightbulbIcon />
            </button>
          </span>
        </label>

        {error ? <p style={styles.error}>{error}</p> : null}

        <div
          style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'nowrap',
            width: '100%',
          }}
        >
          <button
            style={{
              ...styles.button,
              ...styles.actionButton,
              minWidth: 0,
              fontSize: '14px',
              padding: '12px 8px',
            }}
            type="button"
            onClick={calculateClassic}
          >
            {uiText.form.actions.calculateClassic}
          </button>
          <button
            style={{
              ...styles.secondaryButton,
              ...styles.actionButton,
              minWidth: 0,
              fontSize: '14px',
              padding: '12px 8px',
            }}
            type="button"
            onClick={calculateModified}
          >
            {uiText.form.actions.calculateModified}
          </button>
        </div>
      </form>
      {isPInfoOpen ? (
        <div
          style={bottomSheetOverlayStyle}
          onClick={() => setIsPInfoOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="p-info-title"
            style={bottomSheetStyle}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="p-info-title" style={bottomSheetTitleStyle}>
              {uiText.form.pInfoSheet.title}
            </h2>
            <p style={bottomSheetTextStyle}>
              {uiText.form.pInfoSheet.paragraphs[0]}
            </p>
            <p style={bottomSheetTextStyle}>
              {uiText.form.pInfoSheet.paragraphs[1]}
            </p>
            <p style={bottomSheetTextStyle}>
              {uiText.form.pInfoSheet.paragraphs[2]}
            </p>
            <p style={bottomSheetTextStyle}>
              {uiText.form.pInfoSheet.paragraphs[3]}
            </p>
            <p style={bottomSheetTextStyle}>
              {uiText.form.pInfoSheet.paragraphs[4]}
            </p>
            <p style={bottomSheetTextStyle}>
              {uiText.form.pInfoSheet.paragraphs[5]}
            </p>
            <p style={bottomSheetTextStyle}>
              {uiText.form.pInfoSheet.paragraphs[6]}
            </p>
            <ul style={bottomSheetListStyle}>
              {uiText.form.pInfoSheet.paragraphs.slice(7, 10).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p style={bottomSheetTextStyle}>
              {uiText.form.pInfoSheet.paragraphs[10]}
            </p>
            <ul style={bottomSheetListStyle}>
              {uiText.form.pInfoSheet.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p style={bottomSheetTextStyle}>
              {uiText.form.pInfoSheet.conclusion}
            </p>
            <button
              type="button"
              style={bottomSheetCloseButtonStyle}
              onClick={() => setIsPInfoOpen(false)}
            >
              {uiText.form.actions.close}
            </button>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function Input({
  label,
  hint,
  leadingIcon,
  leadingIconLabel,
  onLeadingIconClick,
  ...props
}: {
  label: string;
  hint?: string;
  leadingIcon?: React.ReactNode;
  leadingIconLabel?: string;
  onLeadingIconClick?: () => void;
  value: string;
  inputMode?: 'decimal' | 'text';
  placeholder?: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const input = (
    <input
      style={
        leadingIcon
          ? { ...styles.input, width: '100%', paddingLeft: 42 }
          : styles.input
      }
      {...props}
    />
  );

  return (
    <label style={styles.inputGroup}>
      <span style={styles.labelRow}>
        <span style={styles.label}>{label}</span>
        {hint ? <InfoTip text={hint} /> : null}
      </span>
      {leadingIcon ? (
        <span style={inputIconWrapperStyle}>
          <button
            type="button"
            aria-label={leadingIconLabel}
            style={inputIconButtonStyle}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onLeadingIconClick?.();
            }}
          >
            {leadingIcon}
          </button>
          {input}
        </span>
      ) : (
        input
      )}
    </label>
  );
}

function CalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function LightbulbIcon() {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4 12.74V16h8v-1.26A7 7 0 0 0 12 2z" />
    </svg>
  );
}

function formatNativeDateInput(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function toNativeDateInputValue(value: string): string {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return '';
  const [day, month, year] = value.split('/');
  return `${year}-${month}-${day}`;
}

const inputIconWrapperStyle: React.CSSProperties = {
  position: 'relative',
  display: 'block',
  width: '100%',
};

const inputIconButtonStyle: React.CSSProperties = {
  position: 'absolute',
  left: 12,
  top: '50%',
  transform: 'translateY(-50%)',
  zIndex: 1,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  padding: 0,
  border: 'none',
  backgroundColor: 'transparent',
  color: '#38bdf8',
  cursor: 'pointer',
};

const hiddenDateInputStyle: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  border: 0,
  opacity: 0,
  pointerEvents: 'none',
};

const pInputRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: '8px',
};

const pInfoButtonStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  border: '1px solid #38bdf8',
  borderRadius: 10,
  backgroundColor: 'transparent',
  color: '#38bdf8',
  cursor: 'pointer',
};

const bottomSheetOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  backgroundColor: 'rgba(0, 0, 0, 0.55)',
  padding: '16px',
  boxSizing: 'border-box',
};

const bottomSheetStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '760px',
  maxHeight: '70vh',
  overflowY: 'auto',
  backgroundColor: '#0b1220',
  color: '#e2e8f0',
  border: '1px solid #1e293b',
  borderRadius: '16px 16px 0 0',
  padding: '18px',
  boxSizing: 'border-box',
  boxShadow: '0 -12px 30px rgba(0, 0, 0, 0.35)',
};

const bottomSheetTitleStyle: React.CSSProperties = {
  margin: '0 0 10px',
  fontSize: '18px',
  fontWeight: 700,
};

const bottomSheetTextStyle: React.CSSProperties = {
  margin: '0 0 16px',
  color: '#cbd5e1',
  fontSize: '14px',
  lineHeight: 1.5,
};

const bottomSheetListStyle: React.CSSProperties = {
  margin: '0 0 16px',
  paddingLeft: '20px',
  color: '#cbd5e1',
  fontSize: '14px',
  lineHeight: 1.5,
};

const bottomSheetCloseButtonStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#38bdf8',
  color: '#0b172a',
  fontWeight: 700,
  fontSize: '15px',
  padding: '12px',
  border: 'none',
  borderRadius: 10,
  cursor: 'pointer',
};

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
        aria-label={`${uiText.form.accessibility.helpPrefix}: ${text}`}
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

type ParsedInputsBase = {
  ok: true;
  S: number;
  K: number;
  r: number;
  sigma: number;
  dataAtual: Date;
  dataVencimento: Date;
};

type ParsedInputsClassic = ParsedInputsBase;
type ParsedInputsModified = ParsedInputsBase & { p: number };
type ParsedInputsError = { ok: false; error: string };

function parseInputs(
  form: FormState,
  options: { requireP: true },
): ParsedInputsModified | ParsedInputsError;
function parseInputs(
  form: FormState,
  options: { requireP: false },
): ParsedInputsClassic | ParsedInputsError;
function parseInputs(
  form: FormState,
  { requireP }: { requireP: boolean },
): ParsedInputsClassic | ParsedInputsModified | ParsedInputsError {
  const S = Number(form.S);
  const K = Number(form.K);
  const r = Number(form.r);
  const sigma = Number(form.sigma);
  const p = Number(form.p);
  const dataAtual = parseDate(form.dataAtual);
  const dataVencimento = parseDate(form.dataVencimento);

  if ([S, K, r, sigma].some((n) => Number.isNaN(n))) {
    return { ok: false, error: uiText.form.errors.invalidNumbers };
  }

  if (requireP && (Number.isNaN(p) || p <= 0)) {
    return { ok: false, error: uiText.form.errors.invalidP };
  }

  if (!dataAtual || !dataVencimento) {
    return { ok: false, error: uiText.form.errors.invalidDates };
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
