import {
  addDays,
  diffDays,
  eachDay,
  isValidTimeZone,
  localHour,
  startOfIsoWeek,
  toLocalDate,
} from '../src/utils/dates.js';
import { DomainError } from '../src/utils/errors.js';

describe('toLocalDate', () => {
  it('converte para o dia local do fuso, nao o dia UTC', () => {
    // 01:30 UTC de 11/09 ainda e 22:30 de 10/09 em Sao Paulo (UTC-3).
    const instant = new Date('2026-09-11T01:30:00Z');
    expect(toLocalDate(instant, 'America/Sao_Paulo')).toBe('2026-09-10');
    expect(toLocalDate(instant, 'UTC')).toBe('2026-09-11');
    expect(toLocalDate(instant, 'Asia/Tokyo')).toBe('2026-09-11');
  });

  it('rejeita fuso invalido com DomainError', () => {
    expect(() => toLocalDate(new Date(), 'Mars/Olympus')).toThrow(DomainError);
  });
});

describe('localHour', () => {
  it('devolve a hora local 0-23', () => {
    expect(localHour(new Date('2026-09-11T01:30:00Z'), 'America/Sao_Paulo')).toBe(22);
    expect(localHour(new Date('2026-09-11T03:00:00Z'), 'America/Sao_Paulo')).toBe(0);
  });
});

describe('isValidTimeZone', () => {
  it('aceita IANA e rejeita lixo', () => {
    expect(isValidTimeZone('America/Sao_Paulo')).toBe(true);
    expect(isValidTimeZone('not/a_zone')).toBe(false);
  });
});

describe('aritmetica de datas', () => {
  it('addDays atravessa mes e ano', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('diffDays e eachDay', () => {
    expect(diffDays('2026-09-01', '2026-09-08')).toBe(7);
    expect(eachDay('2026-09-01', '2026-09-03')).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
    expect(eachDay('2026-09-03', '2026-09-01')).toEqual([]);
  });

  it('startOfIsoWeek devolve a segunda-feira', () => {
    expect(startOfIsoWeek('2026-09-10')).toBe('2026-09-07'); // quinta
    expect(startOfIsoWeek('2026-09-13')).toBe('2026-09-07'); // domingo
    expect(startOfIsoWeek('2026-09-07')).toBe('2026-09-07'); // segunda
  });

  it('rejeita data malformada ou inexistente', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow(DomainError);
    expect(() => addDays('10/09/2026', 1)).toThrow(DomainError);
  });
});
