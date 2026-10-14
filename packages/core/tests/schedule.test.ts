import { nextTrainingDay, trainingWeekdays, weekdayOf, workoutIndexForDate } from '../src/domain/training/schedule.js';
import { DomainError } from '../src/utils/errors.js';

describe('agenda de treino', () => {
  it('espaca os dias de treino na semana', () => {
    expect(trainingWeekdays(3)).toEqual([0, 2, 4]);
    expect(trainingWeekdays(2)).toEqual([0, 3]);
    expect(() => trainingWeekdays(0)).toThrow(DomainError);
  });

  it('weekdayOf usa 0 = segunda', () => {
    expect(weekdayOf('2026-09-28')).toBe(0); // segunda
    expect(weekdayOf('2026-10-04')).toBe(6); // domingo
  });

  it('treino do dia e descanso', () => {
    expect(workoutIndexForDate(3, '2026-09-28')).toBe(0); // seg -> A
    expect(workoutIndexForDate(3, '2026-09-30')).toBe(1); // qua -> B
    expect(workoutIndexForDate(3, '2026-09-29')).toBeNull(); // ter -> descanso
  });

  it('proximo treino atravessa a semana', () => {
    expect(nextTrainingDay(3, '2026-10-02')).toEqual({ date: '2026-10-05', workoutIndex: 0 }); // sex -> seg
    expect(nextTrainingDay(3, '2026-09-29')).toEqual({ date: '2026-09-30', workoutIndex: 1 });
  });
});
