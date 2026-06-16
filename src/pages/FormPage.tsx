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
import { type Language, type UiText } from '../content/uiText';
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

type Market = 'BR' | 'US';

const today = new Date();
const defaultVencimento = new Date();
defaultVencimento.setDate(today.getDate() + 90);

const MARKET_DATA_URLS = {
  BR: 'https://raw.githubusercontent.com/iagomarcolino/Consultprice/main/data/marketdata.json',
  US: 'https://raw.githubusercontent.com/iagomarcolino/Consultprice_US/main/data/marketdata.json',
};
const AUTOCOMPLETE_MIN_CHARS = 2;
const AUTOCOMPLETE_DEBOUNCE_MS = 350;

function normalizeTicker(raw: string, market: Market): string {
  const ticker = raw.trim().toUpperCase();
  if (!ticker) return '';
  if (market === 'US') return ticker;
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
  price?: number | null;
  vol_annual?: number | null;

};

const marketDataCache: {
  data: MarketDataItem[] | null;
  fetchedAt: number;
} = {
  data: null,
  fetchedAt: 0,
};


async function loadMarketData(
  market: Market,
  signal?: AbortSignal,
): Promise<MarketDataItem[]> {
  const CHAVE_CACHE = `market_data_diario_${market}`;

  // Tenta buscar do armazenamento local (válido até 23:59)
  const dadosEmCache = obterJsonDiario<MarketDataItem[]>(CHAVE_CACHE);

  if (dadosEmCache) {
    console.log("Dados carregados do cache diário local.");
    return dadosEmCache;
  }


  const resp = await fetch(`${MARKET_DATA_URLS[market]}?t=${Date.now()}`, {
    cache: 'no-store',
    signal,
  });

  if (!resp.ok) {
    throw new Error('HTTP error');
  }

  const json = await resp.json();
  const data = Array.isArray(json?.data) ? json.data : [];

  // Salva os dados baixados no armazenamento local para o resto do dia
  salvarJsonDiario<MarketDataItem[]>(CHAVE_CACHE, data);

  return data;
}


function getMatches(
  data: MarketDataItem[],
  rawTerm: string,
  market: Market,
): MarketDataItem[] {
  const term = rawTerm.trim();
  if (!term) return [];

  const exactSymbol = normalizeTicker(term, market);
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
    price: item.price ?? undefined,
    volAnnual: item.vol_annual ?? undefined,
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

type FormPageProps = {
  language: Language;
  onLanguageChange: (language: Language) => void;
  t: UiText;
};

export default function FormPage({
  language,
  onLanguageChange,
  t,
}: FormPageProps) {
  const [form, setForm] = useState<FormState>(() => loadCachedFormState());
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
  const [pinnedResults, setPinnedResults] = useState<SearchItem[] | null>(null);
  const [selectedResultIndex, setSelectedResultIndex] = useState('');
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<Market>('BR');
  const [isPInfoOpen, setIsPInfoOpen] = useState(false);
  const navigate = useNavigate();
  const autocompleteController = useRef<AbortController | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextAutocompleteRef = useRef(false);
  const vencimentoDateInputRef = useRef<HTMLInputElement | null>(null);
  const selectedMarketRef = useRef<Market>('BR');
  const optionsMenuRef = useRef<HTMLDivElement | null>(null);
  const displayedResults = pinnedResults ?? searchResults;
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);

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
        setSelicError(t.form.errors.bcbFallback);
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
      ...(item.price !== undefined
        ? {
          S: String(item.price),
          K: (item.price * 1.05).toFixed(2)
        }
        : {}),
      ...(item.volAnnual !== undefined
        ? { sigma: String(item.volAnnual) }
        : {}),
    }));
  };

  const handleMarketButtonClick = (market: Market) => {
    if (market === selectedMarket) {
      void handleSearch();
      return;
    }

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    if (autocompleteController.current) {
      autocompleteController.current.abort();
    }

    setSelectedMarket(market);
    selectedMarketRef.current = market;
    setSearchResults([]);
    setPinnedResults(null);
    setSelectedResultIndex('');
    setSearchMessage(null);
    setSearchLoading(false);
  };

  const handleSearch = async () => {
    const market = selectedMarket;
    const rawTerm = searchTerm.trim();
    const normalizedSymbol = normalizeTicker(rawTerm, market);
    if (!rawTerm) {
      setSearchMessage(t.form.search.emptyTerm);
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
      const data = await loadMarketData(market);
      if (selectedMarketRef.current !== market) return;
      const matches = getMatches(data, rawTerm, market);

      if (matches.length === 0) {
        setSearchMessage(t.form.search.notFound);
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
      if (selectedMarketRef.current === market) {
        setSearchMessage(t.form.search.fetchError);
      }
    } finally {
      if (selectedMarketRef.current === market) {
        setSearchLoading(false);
      }
    }
  };

  useEffect(() => {
    const market = selectedMarket;
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
      loadMarketData(market, controller.signal)
        .then((data) => {
          if (selectedMarketRef.current !== market) return;
          const matches = getMatches(data, term, market);
          setSearchResults(
            matches.map((item) =>
              toSearchItem(item, normalizeTicker(term, market)),
            ),
          );
          if (matches.length === 0) {
            setSearchMessage(t.form.search.noResults);
          }
        })
        .catch((err) => {
          if ((err as Error).name === 'AbortError') return;
          if (selectedMarketRef.current === market) {
            setSearchMessage(t.form.search.fetchError);
          }
        })
        .finally(() => {
          if (selectedMarketRef.current === market) {
            setSearchLoading(false);
          }
        });
    }, AUTOCOMPLETE_DEBOUNCE_MS);
  }, [searchTerm, selectedMarket]);

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

  useEffect(() => {
    if (!isOptionsOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!optionsMenuRef.current?.contains(event.target as Node)) {
        setIsOptionsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOptionsOpen]);

  const handleLanguageChange = (nextLanguage: Language) => {
    onLanguageChange(nextLanguage);
    setIsOptionsOpen(false);
  };

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
    const parsed = parseInputs(form, { requireP: false }, t);
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
    const parsed = parseInputs(form, { requireP: true }, t);
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
      <div style={formHeaderStyle}>
        <h1 style={styles.title}>{t.form.title}</h1>
        <p style={styles.subtitle}>
          {t.form.subtitle}
        </p>
        <div ref={optionsMenuRef} style={optionsWrapperStyle}>
          <button
            type="button"
            aria-label={t.menu.options}
            aria-expanded={isOptionsOpen}
            style={optionsButtonStyle}
            onClick={() => setIsOptionsOpen((prev) => !prev)}
          >
            <span style={optionsBarStyle} />
            <span style={optionsBarStyle} />
            <span style={optionsBarStyle} />
          </button>
          {isOptionsOpen ? (
            <div style={optionsMenuStyle}>
              <p style={optionsMenuTitleStyle}>{t.menu.language}</p>
              {(['pt-BR', 'en', 'es'] as Language[]).map((item) => {
                const isSelected = item === language;
                return (
                  <button
                    key={item}
                    type="button"
                    style={{
                      ...languageOptionStyle,
                      ...(isSelected ? languageOptionActiveStyle : {}),
                    }}
                    onClick={() => handleLanguageChange(item)}
                  >
                    {t.menu.languages[item]}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <div
        style={{
          ...styles.searchRow,
          flexWrap: 'nowrap',
          width: '100%',
        }}
      >
        <input
          style={{
            ...styles.input,
            ...styles.searchInput,
            marginTop: 0,
            flex: 1,
            minWidth: 0,
          }}
          value={searchTerm}
          onChange={(e) => {
            setPinnedResults(null);
            setSelectedResultIndex('');
            setSearchTerm(e.target.value);
          }}
          placeholder={t.form.search.placeholder}
        />
        {(['BR', 'US'] as Market[]).map((market) => {
          const isSelected = selectedMarket === market;
          return (
            <button
              key={market}
              style={{
                ...styles.secondaryButton,
                width: 48,
                height: 48,
                flexShrink: 0,
                padding: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 0,
                ...(isSelected
                  ? {
                    backgroundColor: '#38bdf8',
                    color: '#0b172a',
                  }
                  : {}),
              }}
              type="button"
              onClick={() => handleMarketButtonClick(market)}
              disabled={isSelected && searchLoading}
              aria-pressed={isSelected}
              aria-label={`${t.form.search.searchAsset} ${market}`}
            >
              {market}
            </button>
          );
        })}
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
            {t.form.search.selectAsset}
          </option>
          {displayedResults.map((item, index) => (
            <option
              key={`${item.symbol}-${item.exchange}`}
              value={String(index)}
            >
              {item.symbol} - {item.name}
              {item.price !== undefined
                ? ` (${selectedMarket === 'US' ? '$' : 'R$'} ${item.price})`
                : ''}
            </option>
          ))}
        </select>
      ) : null}

      <form style={styles.form} onSubmit={handleSubmit}>
        <Input
          label={t.form.fields.spot.label}
          hint={t.form.fields.spot.hint}
          helpPrefix={t.form.accessibility.helpPrefix}
          value={form.S}
          onChange={(e) => handleChange('S', e.target.value)}
          inputMode="decimal"
        />
        <Input
          label={t.form.fields.strike.label}
          hint={t.form.fields.strike.hint}
          helpPrefix={t.form.accessibility.helpPrefix}
          value={form.K}
          onChange={(e) => handleChange('K', e.target.value)}
          inputMode="decimal"
        />
        <Input
          label={t.form.fields.riskFreeRate.label}
          hint={t.form.fields.riskFreeRate.hint}
          helpPrefix={t.form.accessibility.helpPrefix}
          value={form.r}
          onChange={(e) => handleChange('r', e.target.value)}
          inputMode="decimal"
        />
        <Input
          label={t.form.fields.volatility.label}
          hint={t.form.fields.volatility.hint}
          helpPrefix={t.form.accessibility.helpPrefix}
          value={form.sigma}
          onChange={(e) => handleChange('sigma', e.target.value)}
          inputMode="decimal"
        />
        <Input
          label={t.form.fields.currentDate.label}
          hint={t.form.fields.currentDate.hint}
          helpPrefix={t.form.accessibility.helpPrefix}
          value={form.dataAtual}
          onChange={(e) => handleChange('dataAtual', e.target.value)}
          inputMode="text"
          placeholder={t.form.fields.currentDate.placeholder}
        />
        <Input
          label={t.form.fields.expirationDate.label}
          hint={t.form.fields.expirationDate.hint}
          helpPrefix={t.form.accessibility.helpPrefix}
          value={form.dataVencimento}
          onChange={(e) => handleChange('dataVencimento', e.target.value)}
          inputMode="text"
          placeholder={t.form.fields.expirationDate.placeholder}
          leadingIcon={<CalendarIcon />}
          leadingIconLabel={t.form.fields.expirationDate.openCalendar}
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
              {t.form.fields.pParameter.label}
            </span>
            <InfoTip
              helpPrefix={t.form.accessibility.helpPrefix}
              text={t.form.fields.pParameter.hint}
            />
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
              aria-label={t.form.fields.pParameter.explain}
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
            {t.form.actions.calculateClassic}
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
            {t.form.actions.calculateModified}
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
              {t.form.pInfoSheet.title}
            </h2>
            <p style={bottomSheetTextStyle}>
              {t.form.pInfoSheet.paragraphs[0]}
            </p>
            <p style={bottomSheetTextStyle}>
              {t.form.pInfoSheet.paragraphs[1]}
            </p>
            <p style={bottomSheetTextStyle}>
              {t.form.pInfoSheet.paragraphs[2]}
            </p>
            <p style={bottomSheetTextStyle}>
              {t.form.pInfoSheet.paragraphs[3]}
            </p>
            <p style={bottomSheetTextStyle}>
              {t.form.pInfoSheet.paragraphs[4]}
            </p>
            <p style={bottomSheetTextStyle}>
              {t.form.pInfoSheet.paragraphs[5]}
            </p>
            <p style={bottomSheetTextStyle}>
              {t.form.pInfoSheet.paragraphs[6]}
            </p>
            <ul style={bottomSheetListStyle}>
              {t.form.pInfoSheet.paragraphs.slice(7, 10).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p style={bottomSheetTextStyle}>
              {t.form.pInfoSheet.paragraphs[10]}
            </p>
            <ul style={bottomSheetListStyle}>
              {t.form.pInfoSheet.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p style={bottomSheetTextStyle}>
              {t.form.pInfoSheet.conclusion}
            </p>
            <button
              type="button"
              style={bottomSheetCloseButtonStyle}
              onClick={() => setIsPInfoOpen(false)}
            >
              {t.form.actions.close}
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
  helpPrefix,
  leadingIcon,
  leadingIconLabel,
  onLeadingIconClick,
  ...props
}: {
  label: string;
  hint?: string;
  helpPrefix: string;
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
        {hint ? <InfoTip helpPrefix={helpPrefix} text={hint} /> : null}
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

const formHeaderStyle: React.CSSProperties = {
  position: 'relative',
  paddingRight: 54,
};

const optionsWrapperStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  right: 0,
  zIndex: 20,
};

const optionsButtonStyle: React.CSSProperties = {
  width: 42,
  height: 42,
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  padding: 0,
  border: '1px solid #38bdf8',
  borderRadius: 10,
  backgroundColor: '#0b1220',
  color: '#38bdf8',
  cursor: 'pointer',
};

const optionsBarStyle: React.CSSProperties = {
  width: 18,
  height: 2,
  borderRadius: 999,
  backgroundColor: 'currentColor',
};

const optionsMenuStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 8px)',
  right: 0,
  minWidth: 164,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: 10,
  border: '1px solid #1e293b',
  borderRadius: 10,
  backgroundColor: '#0b1220',
  boxShadow: '0 10px 24px rgba(0, 0, 0, 0.35)',
};

const optionsMenuTitleStyle: React.CSSProperties = {
  margin: '0 0 4px',
  color: '#cbd5e1',
  fontSize: 13,
  fontWeight: 700,
};

const languageOptionStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #334155',
  borderRadius: 8,
  backgroundColor: 'transparent',
  color: '#e2e8f0',
  fontSize: 14,
  textAlign: 'left',
  cursor: 'pointer',
};

const languageOptionActiveStyle: React.CSSProperties = {
  borderColor: '#38bdf8',
  backgroundColor: '#38bdf8',
  color: '#0b172a',
  fontWeight: 700,
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

function InfoTip({ helpPrefix, text }: { helpPrefix: string; text: string }) {
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
        aria-label={`${helpPrefix}: ${text}`}
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
  t: UiText,
): ParsedInputsModified | ParsedInputsError;
function parseInputs(
  form: FormState,
  options: { requireP: false },
  t: UiText,
): ParsedInputsClassic | ParsedInputsError;
function parseInputs(
  form: FormState,
  { requireP }: { requireP: boolean },
  t: UiText,
): ParsedInputsClassic | ParsedInputsModified | ParsedInputsError {
  const S = Number(form.S);
  const K = Number(form.K);
  const r = Number(form.r);
  const sigma = Number(form.sigma);
  const p = Number(form.p);
  const dataAtual = parseDate(form.dataAtual);
  const dataVencimento = parseDate(form.dataVencimento);

  if ([S, K, r, sigma].some((n) => Number.isNaN(n))) {
    return { ok: false, error: t.form.errors.invalidNumbers };
  }

  if (requireP && (Number.isNaN(p) || p <= 0)) {
    return { ok: false, error: t.form.errors.invalidP };
  }

  if (!dataAtual || !dataVencimento) {
    return { ok: false, error: t.form.errors.invalidDates };
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
