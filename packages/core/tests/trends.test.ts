import {
  aggregateByWeek,
  calorieAdherencePercent,
  loggingStreakDays,
  movingAverage,
  seriesChange,
  workoutAdherencePercent,
} from '../src/domain/progress/trends.js';

describe('movingAverage', () => {
  it('usa janela de calendario, nao de quantidade de pontos', () => {
    const result = movingAverage([
      { date: '2026-09-01', value: 80 },
      { date: '2026-09-03', value: 82 },
      // 2026-09-20 esta fora da janela de 7 dias das anteriores
      { date: '2026-09-20', value: 70 },
    ]);
    expect(result).toEqual([
      { date: '2026-09-01', value: 80 },
      { date: '2026-09-03', value: 81 },
      { date: '2026-09-20', value: 70 },
    ]);
  });

  it('ordena a entrada antes de calcular', () => {
    const result = movingAverage([
      { date: '2026-09-02', value: 2 },
      { date: '2026-09-01', value: 4 },
    ]);
    expect(result.map((p) => p.date)).toEqual(['2026-09-01', '2026-09-02']);
    expect(result[1]!.value).toBe(3);
  });
});

describe('aggregateByWeek', () => {
  it('agrupa pela segunda-feira da semana ISO', () => {
    expect(
      aggregateByWeek([
        { date: '2026-09-07', value: 80 },
        { date: '2026-09-13', value: 82 },
        { date: '2026-09-14', value: 79 },
      ]),
    ).toEqual([
      { date: '2026-09-07', value: 81 },
      { date: '2026-09-14', value: 79 },
    ]);
  });
});

describe('calorieAdherencePercent', () => {
  it('conta apenas dias com registro, com tolerancia de 10%', () => {
    expect(
      calorieAdherencePercent([
        { consumed: 2000, target: 2000 },
        { consumed: 2200, target: 2000 }, // limite exato: dentro
        { consumed: 2300, target: 2000 }, // fora
        { consumed: 0, target: 2000 }, // sem registro: ignorado
      ]),
    ).toBe(67);
  });

  it('zero sem dias registrados', () => {
    expect(calorieAdherencePercent([])).toBe(0);
  });
});

describe('workoutAdherencePercent', () => {
  it('limita a 100%', () => {
    expect(workoutAdherencePercent(3, 4)).toBe(75);
    expect(workoutAdherencePercent(5, 4)).toBe(100);
    expect(workoutAdherencePercent(1, 0)).toBe(0);
  });
});

describe('loggingStreakDays', () => {
  it('conta dias consecutivos ate hoje', () => {
    expect(loggingStreakDays(['2026-09-08', '2026-09-09', '2026-09-10'], '2026-09-10')).toBe(3);
  });

  it('sem registro hoje, conta a partir de ontem', () => {
    expect(loggingStreakDays(['2026-09-08', '2026-09-09'], '2026-09-10')).toBe(2);
  });

  it('buraco interrompe a sequencia', () => {
    expect(loggingStreakDays(['2026-09-07', '2026-09-09', '2026-09-10'], '2026-09-10')).toBe(2);
    expect(loggingStreakDays([], '2026-09-10')).toBe(0);
  });
});

describe('seriesChange', () => {
  it('ultimo menos primeiro', () => {
    expect(
      seriesChange([
        { date: '2026-09-10', value: 78.4 },
        { date: '2026-09-01', value: 80 },
      ]),
    ).toBe(-1.6);
    expect(seriesChange([{ date: '2026-09-01', value: 80 }])).toBe(0);
  });
});
