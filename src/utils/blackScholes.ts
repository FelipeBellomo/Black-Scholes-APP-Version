const BUSINESS_DAYS_IN_YEAR = 252;

/**
 * Funcao erro aproximada (Abramowitz & Stegun 7.1.26).
 * Evita dependencias externas para a CDF da normal padrao.
 */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1 / (1 + p * absX);
  const y =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) *
    Math.exp(-absX * absX);

  return sign * y;
}


// Alias semantico para aderir a notacao N(x).
export const N = normalCdf;

/**
 * Conta dias uteis (segunda a sexta) entre duas datas.
 * Datas sao normalizadas para meia-noite para evitar problemas de fuso horario.
*/
export function calcularDiasUteis(dataAtual: Date, dataVencimento: Date): number {
  const inicio = new Date(
    Date.UTC(
      dataAtual.getFullYear(),
      dataAtual.getMonth(),
      dataAtual.getDate(),
    ),
  );
  const fim = new Date(
    Date.UTC(
      dataVencimento.getFullYear(),
      dataVencimento.getMonth(),
      dataVencimento.getDate(),
    ),
  );

  if (fim <= inicio) {
    return 0;
  }

  let dias = 0;
  const cursor = new Date(inicio);

  while (cursor < fim) {
    const diaSemana = cursor.getUTCDay(); // 0 domingo, 6 sabado
    if (diaSemana !== 0 && diaSemana !== 6) {
      dias += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dias;
}

/**
 * Converte diferenca de datas em anos usando 252 dias uteis.
*/
export function calcularTempoEmAnos(
  dataAtual: Date,
  dataVencimento: Date,
): number {
  const diasUteis = calcularDiasUteis(dataAtual, dataVencimento);
  return diasUteis / BUSINESS_DAYS_IN_YEAR;
}

function ensurePositive(value: number, fallback = 1e-12): number {
  return value > 0 ? value : fallback;
}


/**
 * CDF da normal padrao N(x) usando erf (precisao ~1e-7).
 */
export function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

export function normalPdf(x: number): number {
  return (1.0 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
}

// Cria objeto para exportar todas juntas

interface ResultadoGregas {
  deltaCall: number;
  deltaPut: number;
  vega: number;
  gama: number;

}

// calcula as 3 gregas (Delta, Vega, Gama)
export function calculaGregas(
  S: number,
  K: number,
  r: number,
  sigma: number,
  dataAtual: Date,
  dataVencimento: Date,
): ResultadoGregas {

  const T = calcularTempoEmAnos(dataAtual, dataVencimento);

  const safeSigma = ensurePositive(sigma);
  const sqrtT = Math.sqrt(T);
  const d1 =
    (Math.log(S / K) + (r + 0.5 * safeSigma * safeSigma) * T) /
    (safeSigma * sqrtT);

  const phid1 = normalPdf(d1);
  const deltaCall = normalCdf(d1);
  const deltaPut = deltaCall - 1;

  const vega = S * phid1 * sqrtT;
  const gama = phid1 / (S * safeSigma * sqrtT);

  return {
    deltaCall,
    deltaPut,
    vega: vega / 100,
    gama,
  };


}

/**
 * Black-Scholes para opcao de compra europeia (CALL).
 */
export function blackScholesCall(
  S: number,
  K: number,
  r: number,
  sigma: number,
  dataAtual: Date,
  dataVencimento: Date,
): number {
  const T = calcularTempoEmAnos(dataAtual, dataVencimento);
  if (T <= 0) {
    return Math.max(S - K, 0);
  }

  const safeSigma = ensurePositive(sigma);
  const sqrtT = Math.sqrt(T);
  const d1 =
    (Math.log(S / K) + (r + 0.5 * safeSigma * safeSigma) * T) /
    (safeSigma * sqrtT);
  const d2 = d1 - safeSigma * sqrtT;

  return S * normalCdf(d1) - K * Math.exp(-r * T) * normalCdf(d2);
}

/**
 * Black-Scholes para opcao de venda europeia (PUT).
 */
export function blackScholesPut(
  S: number,
  K: number,
  r: number,
  sigma: number,
  dataAtual: Date,
  dataVencimento: Date,
): number {
  const T = calcularTempoEmAnos(dataAtual, dataVencimento);
  if (T <= 0) {
    return Math.max(K - S, 0);
  }

  const safeSigma = ensurePositive(sigma);
  const sqrtT = Math.sqrt(T);
  const d1 =
    (Math.log(S / K) + (r + 0.5 * safeSigma * safeSigma) * T) /
    (safeSigma * sqrtT);
  const d2 = d1 - safeSigma * sqrtT;

  return K * Math.exp(-r * T) * normalCdf(-d2) - S * normalCdf(-d1);
}

/**
 * Variante modificada do Black-Scholes com parametro p e fator A(tau).
 * tau = tempo ate o vencimento (anos).
 */
export function blackScholesCallModified(
  S: number,
  K: number,
  r: number,
  sigma: number,
  p: number,
  dataAtual: Date,
  dataVencimento: Date,
): number {
  const tau = calcularTempoEmAnos(dataAtual, dataVencimento);
  if (tau <= 0) {
    return Math.max(S - K, 0);
  }

  const safeSigma = ensurePositive(sigma);
  const safeP = ensurePositive(p);
  const sigmaSq = safeSigma * safeSigma;
  const sqrtPTau = Math.sqrt(safeP * tau);
  const aTau = Math.exp((safeP - 1) * (sigmaSq / 2) * tau);
  const base = Math.log(S / K) - 0.5 * sigmaSq * tau + r * tau;
  const d1 =
    (base + safeP * sigmaSq * tau) / (safeSigma * sqrtPTau);
  const d2 = base / (safeSigma * sqrtPTau);

  return aTau * S * normalCdf(d1) - K * Math.exp(-r * tau) * normalCdf(d2);
}

export function blackScholesPutModified(
  S: number,
  K: number,
  r: number,
  sigma: number,
  p: number,
  dataAtual: Date,
  dataVencimento: Date,
): number {
  const tau = calcularTempoEmAnos(dataAtual, dataVencimento);
  if (tau <= 0) {
    return Math.max(K - S, 0);
  }

  const safeSigma = ensurePositive(sigma);
  const safeP = ensurePositive(p);
  const sigmaSq = safeSigma * safeSigma;
  const sqrtPTau = Math.sqrt(safeP * tau);
  const aTau = Math.exp((safeP - 1) * (sigmaSq / 2) * tau);
  const base = Math.log(S / K) - 0.5 * sigmaSq * tau + r * tau;
  const d1 =
    (base + safeP * sigmaSq * tau) / (safeSigma * sqrtPTau);
  const d2 = base / (safeSigma * sqrtPTau);

  return (
    K * Math.exp(-r * tau) * normalCdf(-d2) -
    aTau * S * normalCdf(-d1)
  );
}
