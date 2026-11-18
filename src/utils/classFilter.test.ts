import {describe, expect, it} from 'vitest';
import {filterByClass, parseClassFilter} from './classFilter';

const records = [
  {id: 1, scheduleId: 1},
  {id: 2, scheduleId: 2},
  {id: 3},
  {id: 4, scheduleId: 99}, // its class was deleted
  {id: 5, scheduleId: 1},
];
const classIds = [1, 2];
const ids = (rs: {id: number}[]) => rs.map((r) => r.id);

describe('filterByClass', () => {
  it('keeps everything for all classes', () => {
    expect(ids(filterByClass(records, 'all', classIds))).toEqual([1, 2, 3, 4, 5]);
  });

  it('keeps one class, in the order given', () => {
    expect(ids(filterByClass(records, 1, classIds))).toEqual([1, 5]);
    expect(ids(filterByClass(records, 2, classIds))).toEqual([2]);
  });

  it('counts a session whose class was deleted as having none', () => {
    expect(ids(filterByClass(records, 'none', classIds))).toEqual([3, 4]);
  });

  it('finds nothing for a class with no sessions', () => {
    expect(filterByClass(records, 7, [...classIds, 7])).toEqual([]);
  });
});

describe('parseClassFilter', () => {
  it('reads back what a select or storage holds', () => {
    expect(parseClassFilter('all')).toBe('all');
    expect(parseClassFilter('none')).toBe('none');
    expect(parseClassFilter('12')).toBe(12);
  });

  it('falls back to all for anything else', () => {
    expect(parseClassFilter(null)).toBe('all');
    expect(parseClassFilter('')).toBe('all');
    expect(parseClassFilter('kelas')).toBe('all');
    expect(parseClassFilter('1.5')).toBe('all');
  });
});
