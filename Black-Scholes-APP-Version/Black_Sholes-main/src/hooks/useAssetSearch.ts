import { useCallback, useEffect, useRef, useState } from 'react';
import { getAssetYahoo, searchAssetsYahoo } from '../services/yahooApi';
import { AssetDetails, AssetResult } from '../types';

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const cacheAutocomplete: Map<string, CacheEntry<AssetResult[]>> = new Map();
const cacheLookup: Map<string, CacheEntry<AssetDetails>> = new Map();

const AUTOCOMPLETE_TTL_MS = 60 * 1000;
const LOOKUP_TTL_MS = 5 * 60 * 1000;
const DEBOUNCE_MS = 350;

export function useAssetSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AssetResult[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<AssetDetails | null>(null);
  const [loadingAutocomplete, setLoadingAutocomplete] = useState(false);
  const [errorAutocomplete, setErrorAutocomplete] = useState<string | null>(null);
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [errorLookup, setErrorLookup] = useState<string | null>(null);

  const autocompleteController = useRef<AbortController | null>(null);
  const lookupController = useRef<AbortController | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const normalizeQuery = (text: string) =>
    text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');

  const onChangeQuery = useCallback(
    (text: string) => {
      setQuery(text);
      setErrorAutocomplete(null);
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      const normalized = normalizeQuery(text);
      if (normalized.length < 2) {
        setResults([]);
        return;
      }

      debounceTimer.current = setTimeout(() => {
        void runAutocomplete(normalized);
      }, DEBOUNCE_MS);
    },
    [],
  );

  const runAutocomplete = useCallback(
    async (normalizedQuery: string) => {
      const cached = cacheAutocomplete.get(normalizedQuery);
      if (cached && cached.expiresAt > Date.now()) {
        setResults(cached.value);
        return;
      }

      if (autocompleteController.current) {
        autocompleteController.current.abort();
      }
      const controller = new AbortController();
      autocompleteController.current = controller;

      setLoadingAutocomplete(true);
      setErrorAutocomplete(null);
      try {
        const res = await searchAssetsYahoo(
          normalizedQuery,
          controller.signal,
        );
        setResults(res);
        cacheAutocomplete.set(normalizedQuery, {
          value: res,
          expiresAt: Date.now() + AUTOCOMPLETE_TTL_MS,
        });
        if (res.length === 0) {
          setErrorAutocomplete('Nenhum resultado.');
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        console.error('autocomplete error', normalizedQuery, err);
        setErrorAutocomplete('Erro ao buscar ativos.');
      } finally {
        setLoadingAutocomplete(false);
      }
    },
    [],
  );

  const onSelectResult = useCallback(
    async (item: AssetResult) => {
      setErrorLookup(null);
      const cached = cacheLookup.get(item.symbol);
      if (cached && cached.expiresAt > Date.now()) {
        setSelectedAsset(cached.value);
        return;
      }

      if (lookupController.current) {
        lookupController.current.abort();
      }
      const controller = new AbortController();
      lookupController.current = controller;

      setLoadingLookup(true);
      try {
        const detail = await getAssetYahoo(item.symbol, controller.signal);
        setSelectedAsset(detail);
        cacheLookup.set(item.symbol, {
          value: detail,
          expiresAt: Date.now() + LOOKUP_TTL_MS,
        });
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        console.error('lookup error', item.symbol, err);
        setErrorLookup('Erro ao carregar ativo.');
      } finally {
        setLoadingLookup(false);
      }
    },
    [],
  );

  useEffect(
    () => () => {
      if (autocompleteController.current) {
        autocompleteController.current.abort();
      }
      if (lookupController.current) {
        lookupController.current.abort();
      }
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    },
    [],
  );

  return {
    query,
    results,
    selectedAsset,
    loadingAutocomplete,
    errorAutocomplete,
    loadingLookup,
    errorLookup,
    onChangeQuery,
    onSelectResult,
  };
}
