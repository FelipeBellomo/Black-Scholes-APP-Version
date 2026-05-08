export type SearchItem = {
  symbol: string;
  name: string;
  exchange: string;
  price?: number;
  currency?: string;
  volAnnual?: number;
};

const QUOTE_URL = 'https://query1.finance.yahoo.com/v7/finance/quote?symbols=';

/**
 * Busca cotacoes usando a API de quote do Yahoo Finance.
 */
export async function searchQuotes(
  term: string,
  limit = 5,
): Promise<SearchItem[]> {
  if (!term.trim()) {
    return [];
  }

  const resp = await fetch(`${QUOTE_URL}${encodeURIComponent(term.trim())}`);
  if (!resp.ok) {
    throw new Error('Erro ao buscar ativos');
  }

  const data = await resp.json();
  const results = Array.isArray(data?.quoteResponse?.result)
    ? data.quoteResponse.result
    : [];

  return results.slice(0, limit).map((q: any) => ({
    symbol: q.symbol ?? '',
    name: q.shortName ?? q.longName ?? q.symbol ?? '',
    exchange: q.fullExchangeName ?? q.exchange ?? '',
    price: q.regularMarketPrice,
    currency: q.currency,
  }));
}
