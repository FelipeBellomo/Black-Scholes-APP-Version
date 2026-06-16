export type Language = 'pt-BR' | 'en' | 'es';

export const DEFAULT_LANGUAGE: Language = 'pt-BR';
export const LANGUAGE_STORAGE_KEY = 'app_language';

const ptBRText = {
  menu: {
    options: 'Opções',
    language: 'Idioma',
    languages: {
      'pt-BR': 'Português',
      en: 'English',
      es: 'Español',
    },
  },
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
        placeholder: '12/12/2025',
      },
      expirationDate: {
        label: 'Data de vencimento (DD/MM/AAAA)',
        hint: 'Data de expiração da opção.',
        placeholder: '12/03/2026',
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
        'volatility smile;',
        'volatility skew;',
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
    parameters: {
      sigma: 'sigma',
      deltaCall: 'Delta Call',
      deltaPut: 'Delta Put',
      vega: 'Vega',
      gamma: 'Gamma',
    },
    actions: {
      back: 'Voltar',
    },
  },
} as const;

const enText = {
  menu: {
    options: 'Options',
    language: 'Language',
    languages: {
      'pt-BR': 'Português',
      en: 'English',
      es: 'Español',
    },
  },
  form: {
    title: 'Black-Scholes Calculator',
    subtitle:
      'Fill in the annual parameters. Dates are used to calculate T (business days/252).',
    search: {
      placeholder: 'Search asset (ticker or name, e.g. AAPL, Apple)',
      emptyTerm: 'Enter a ticker or name.',
      notFound: 'Asset not found.',
      fetchError: 'Error fetching data.',
      noResults: 'No results.',
      searchingAsset: 'Searching asset',
      searchAsset: 'Search asset',
      selectAsset: 'Select an asset',
    },
    fields: {
      spot: {
        label: 'S - Asset price',
        hint: 'Current price of the underlying asset (spot).',
      },
      strike: {
        label: 'K - Strike price',
        hint: 'Strike: exercise price at expiration.',
      },
      riskFreeRate: {
        label: 'r - Risk-free rate (annual)',
        hint: 'Annual risk-free rate as a decimal Selic(0.05 = 5%).',
      },
      volatility: {
        label: 'sigma - Annual volatility',
        hint: 'Annual asset volatility as a decimal (0.2 = 20%).',
      },
      currentDate: {
        label: 'Current date (DD/MM/YYYY)',
        hint: 'Base date used to calculate time to expiration.',
        placeholder: '12/12/2025',
      },
      expirationDate: {
        label: 'Expiration date (DD/MM/YYYY)',
        hint: 'Option expiration date.',
        placeholder: '12/03/2026',
        openCalendar: 'Open expiration calendar',
      },
      pParameter: {
        label: 'p - Parameter (modified model)',
        hint:
          'Parameter of the modified Black-Scholes model; use only in the modified model (suggestion: 0.5 to 1.5).',
        explain: 'Explain parameter p',
      },
    },
    actions: {
      calculateClassic: 'Calculate classic',
      calculateModified: 'Calculate modified',
      close: 'Close',
    },
    accessibility: {
      helpPrefix: 'Help',
    },
    errors: {
      invalidNumbers: 'Enter valid numeric values.',
      invalidP: 'Parameter p must be greater than zero.',
      invalidDates: 'Dates must use DD/MM/YYYY format.',
      bcbFallback: 'BCB API failed. Using default value.',
    },
    pInfoSheet: {
      title: 'What is parameter p?',
      paragraphs: [
        'The modified Black-Scholes model introduces parameter p, which adjusts the diffusion intensity in the model.',
        'In the classic Black-Scholes model we have:',
        'p = 1',
        'In this case, price behavior follows the traditional diffusion assumed by the original model.',
        'In the modified model:',
        '0 < p < ∞',
        'Parameter p controls how much the solution spreads over time:',
        '0 < p < 1: smoother diffusion;',
        'p = 1: classic model;',
        'p > 1: more intense diffusion.',
        'Intuitively, parameter p adjusts how the model reacts to real market conditions, especially in scenarios where traditional Black-Scholes has limitations, such as:',
      ],
      limitations: [
        'options close to expiration;',
        'volatility smile;',
        'volatility skew;',
        'abrupt volatility changes;',
        'out-of-the-money options (OTM).',
      ],
      conclusion:
        'In practice, parameter p acts as an effective market diffusion coefficient, allowing the model to better adapt to observed real price behavior.',
    },
  },
  result: {
    empty: 'No saved result. Redirecting...',
    titles: {
      modified: 'Modified Black-Scholes',
      classic: 'Classic Black-Scholes',
    },
    rows: {
      callPrice: 'Theoretical price - Call (C)',
      putPrice: 'Theoretical price - Put (P)',
      timeToExpiration: 'Time to expiration (years)',
      businessDays: 'Business days considered',
      pParameter: 'Parameter p',
    },
    sections: {
      usedParameters: 'Parameters used',
      currentDate: 'Current date',
      expiration: 'Expiration',
    },
    parameters: {
      sigma: 'sigma',
      deltaCall: 'Delta Call',
      deltaPut: 'Delta Put',
      vega: 'Vega',
      gamma: 'Gamma',
    },
    actions: {
      back: 'Back',
    },
  },
} as const;

const esText = {
  menu: {
    options: 'Opciones',
    language: 'Idioma',
    languages: {
      'pt-BR': 'Português',
      en: 'English',
      es: 'Español',
    },
  },
  form: {
    title: 'Calculadora Black-Scholes',
    subtitle:
      'Complete los parámetros anuales. Las fechas se usan para calcular T (días hábiles/252).',
    search: {
      placeholder: 'Buscar activo (ticker o nombre, ej.: AAPL, Apple)',
      emptyTerm: 'Ingrese un ticker o nombre.',
      notFound: 'Activo no encontrado.',
      fetchError: 'Error al consultar datos.',
      noResults: 'Sin resultados.',
      searchingAsset: 'Buscando activo',
      searchAsset: 'Buscar activo',
      selectAsset: 'Seleccione un activo',
    },
    fields: {
      spot: {
        label: 'S - Precio del activo',
        hint: 'Precio actual del activo subyacente (spot).',
      },
      strike: {
        label: 'K - Precio de ejercicio',
        hint: 'Strike: precio de ejercicio al vencimiento.',
      },
      riskFreeRate: {
        label: 'r - Tasa libre de riesgo (anual)',
        hint: 'Tasa libre de riesgo anual en decimal Selic(0.05 = 5%).',
      },
      volatility: {
        label: 'sigma - Volatilidad anual',
        hint: 'Volatilidad anual del activo en decimal (0.2 = 20%).',
      },
      currentDate: {
        label: 'Fecha actual (DD/MM/AAAA)',
        hint: 'Fecha base para calcular el tiempo hasta el vencimiento.',
        placeholder: '12/12/2025',
      },
      expirationDate: {
        label: 'Fecha de vencimiento (DD/MM/AAAA)',
        hint: 'Fecha de expiración de la opción.',
        placeholder: '12/03/2026',
        openCalendar: 'Abrir calendario de vencimiento',
      },
      pParameter: {
        label: 'p - Parámetro (modelo modificado)',
        hint:
          'Parámetro del modelo Black-Scholes modificado; úselo solo en el modelo modificado (sugerencia: 0.5 a 1.5).',
        explain: 'Explicar parámetro p',
      },
    },
    actions: {
      calculateClassic: 'Calcular clásico',
      calculateModified: 'Calcular modificado',
      close: 'Cerrar',
    },
    accessibility: {
      helpPrefix: 'Ayuda',
    },
    errors: {
      invalidNumbers: 'Ingrese valores numéricos válidos.',
      invalidP: 'El parámetro p debe ser mayor que cero.',
      invalidDates: 'Las fechas deben estar en formato DD/MM/AAAA.',
      bcbFallback: 'Falló la API BCB. Usando valor predeterminado.',
    },
    pInfoSheet: {
      title: '¿Qué es el parámetro p?',
      paragraphs: [
        'El modelo Black-Scholes modificado introduce el parámetro p, responsable de ajustar la intensidad de difusión en el modelo.',
        'En el modelo clásico de Black-Scholes tenemos:',
        'p = 1',
        'En este caso, el comportamiento del precio sigue la difusión tradicional asumida por el modelo original.',
        'En el modelo modificado:',
        '0 < p < ∞',
        'El parámetro p controla cuánto se dispersa la solución a lo largo del tiempo:',
        '0 < p < 1: difusión más suave;',
        'p = 1: modelo clásico;',
        'p > 1: difusión más intensa.',
        'De forma intuitiva, el parámetro p permite ajustar cómo reacciona el modelo a las condiciones reales del mercado, especialmente en escenarios donde el Black-Scholes tradicional presenta limitaciones, como:',
      ],
      limitations: [
        'opciones cercanas al vencimiento;',
        'volatility smile;',
        'volatility skew;',
        'cambios abruptos en la volatilidad;',
        'opciones fuera del dinero (OTM).',
      ],
      conclusion:
        'En la práctica, el parámetro p actúa como un coeficiente de difusión efectiva del mercado, permitiendo que el modelo se adapte mejor al comportamiento observado en los precios reales.',
    },
  },
  result: {
    empty: 'No hay resultado guardado. Redirigiendo...',
    titles: {
      modified: 'Black-Scholes Modificado',
      classic: 'Black-Scholes Clásico',
    },
    rows: {
      callPrice: 'Precio teórico - Call (C)',
      putPrice: 'Precio teórico - Put (P)',
      timeToExpiration: 'Tiempo hasta el vencimiento (años)',
      businessDays: 'Días hábiles considerados',
      pParameter: 'Parámetro p',
    },
    sections: {
      usedParameters: 'Parámetros usados',
      currentDate: 'Fecha actual',
      expiration: 'Vencimiento',
    },
    parameters: {
      sigma: 'sigma',
      deltaCall: 'Delta Call',
      deltaPut: 'Delta Put',
      vega: 'Vega',
      gamma: 'Gamma',
    },
    actions: {
      back: 'Volver',
    },
  },
} as const;

export const uiTextByLanguage = {
  'pt-BR': ptBRText,
  en: enText,
  es: esText,
} as const;

export type UiText = (typeof uiTextByLanguage)[Language];

export function isLanguage(value: string | null): value is Language {
  return value === 'pt-BR' || value === 'en' || value === 'es';
}

export function getUiText(language: Language): UiText {
  return uiTextByLanguage[language];
}

export const uiText = uiTextByLanguage[DEFAULT_LANGUAGE];
