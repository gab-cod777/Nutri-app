/** Arredonda para `decimals` casas, sem o erro de ponto flutuante do `toFixed`. */
export function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Limita `value` ao intervalo [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Percentual de `value` sobre `total`, protegido contra divisao por zero. */
export function percentOf(value: number, total: number, decimals = 0): number {
  if (total <= 0) return 0;
  return round((value / total) * 100, decimals);
}

/** Soma numeros arredondando o resultado, util para totais de macros. */
export function sumRounded(values: readonly number[], decimals = 0): number {
  return round(
    values.reduce((acc, v) => acc + v, 0),
    decimals,
  );
}
