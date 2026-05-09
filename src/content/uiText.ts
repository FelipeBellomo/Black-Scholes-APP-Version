export const uiText = {
  form: {
    title: 'Calculadora Black-Scholes',
    subtitle:
      'Preencha os parâmetros anuais. Datas são usadas para calcular T (dias úteis/252).',
    search: {
      placeholder: 'Buscar ativo (ticker ou nome, ex: PETR4.SA, Ambev)',
      emptyTerm: 'Informe um ticker ou nome.',
      notFound: 'Ativo não encontrado.',
      fetchError: 'Erro ao consultar dados.',
      noResults: 'Nenhum resultado.',
      searchingAsset: 'Buscando ativo',
      searchAsset: 'Pesquisar ativo',
      selectAsset: 'Selecione um ativo',
    },
    fields: {
      spot: {
        label: 'S - Preço do ativo',
        hint: 'Preço atual do ativo subjacente (spot).',
      },
      strike: {
        label: 'K - Preço de exercício',
        hint: 'Strike: preço de exercício no vencimento.',
      },
      riskFreeRate: {
        label: 'r - Taxa livre de risco (anual)',
        hint: 'Taxa livre de risco anual em decimal Selic(0.05 = 5%).',
      },
      volatility: {
        label: 'sigma - Volatilidade anual',
        hint: 'Volatilidade anual do ativo em decimal (0.2 = 20%).',
      },
      currentDate: {
        label: 'Data atual (DD/MM/AAAA)',
        hint: 'Data base para calcular o tempo até o vencimento.',
      },
      expirationDate: {
        label: 'Data de vencimento (DD/MM/AAAA)',
        hint: 'Data de expiração da opção.',
        openCalendar: 'Abrir calendário de vencimento',
      },
      pParameter: {
        label: 'p - Parâmetro (modelo modificado)',
        hint:
          'Parâmetro do Black-Scholes modificado; use apenas no modificado (sugestão: 0,5 a 1,5).',
        explain: 'Explicar parâmetro p',
      },
    },
    actions: {
      calculateClassic: 'Calcular clássico',
      calculateModified: 'Calcular modificado',
      close: 'Fechar',
    },
    accessibility: {
      helpPrefix: 'Ajuda',
    },
    errors: {
      invalidNumbers: 'Preencha valores numéricos válidos.',
      invalidP: 'Parâmetro p deve ser maior que zero.',
      invalidDates: 'Datas devem estar no formato DD/MM/AAAA.',
      bcbFallback: 'Falha na API BCB. Usando valor padrão.',
    },
    pInfoSheet: {
      title: 'O que é o parâmetro p?',
      paragraphs: [
        'O modelo modificado de Black-Scholes introduz o parâmetro p, responsável por ajustar a intensidade da difusão no modelo.',
        'No modelo clássico de Black-Scholes temos:',
        'p = 1',
        'Neste caso, o comportamento do preço segue a difusão tradicional assumida pelo modelo original.',
        'No modelo modificado:',
        '0 < p < ∞',
        'O parâmetro p controla o quanto a solução se espalha ao longo do tempo:',
        '0 < p < 1: difusão mais suave;',
        'p = 1: modelo clássico;',
        'p > 1: difusão mais intensa.',
        'De forma intuitiva, o parâmetro p permite ajustar como o modelo reage às condições reais do mercado, principalmente em cenários onde o Black-Scholes tradicional apresenta limitações, como:',
      ],
      limitations: [
        'opções próximas do vencimento;',
        'volatilidade smile;',
        'volatilidade skew;',
        'mudanças abruptas na volatilidade;',
        'opções fora do dinheiro (OTM).',
      ],
      conclusion:
        'Na prática, o parâmetro p atua como um coeficiente de difusão efetiva do mercado, permitindo que o modelo se adapte melhor ao comportamento observado nos preços reais.',
    },
  },
  result: {
    empty: 'Nenhum resultado salvo. Redirecionando...',
    titles: {
      modified: 'Black-Scholes Modificado',
      classic: 'Black-Scholes Clássico',
    },
    rows: {
      callPrice: 'Preço teórico - Call (C)',
      putPrice: 'Preço teórico - Put (P)',
      timeToExpiration: 'Tempo até o vencimento (anos)',
      businessDays: 'Dias úteis considerados',
      pParameter: 'Parâmetro p',
    },
    sections: {
      usedParameters: 'Parâmetros usados',
      currentDate: 'Data atual',
      expiration: 'Vencimento',
    },
    actions: {
      back: 'Voltar',
    },
  },
} as const;
