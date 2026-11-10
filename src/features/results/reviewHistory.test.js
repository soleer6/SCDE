import { beforeEach, expect, it } from 'vitest';
import { rememberReviewScores, previousReviewScores } from './reviewHistory.js';
beforeEach(() => localStorage.clear());
it('keeps exact zero/negative scores and totals across reloads, scoped by student, instance and request', () => {
 const inst = { id: 'i', total_score: '0.00', grades: [{ problem_id: 'p', score: '-1.25' }] };
 rememberReviewScores('elena', inst, [{ id: 'r', problem_id: 'p' }]);
 expect(previousReviewScores('elena','i','r')).toMatchObject({ score:'-1.25',total:'0.00' });
 expect(previousReviewScores('other','i','r')).toBeNull();
 expect(previousReviewScores('elena','other','r')).toBeNull();
 inst.grades[0].score='2.00'; rememberReviewScores('elena',inst,[{ id:'r',problem_id:'p' }]);
 expect(previousReviewScores('elena','i','r').score).toBe('-1.25');
});
it('does not invent old values for legacy requests or absent grade breakdowns', () => {
 expect(previousReviewScores('elena','i','legacy')).toBeNull();
 rememberReviewScores('elena',{id:'i'},[{id:'r',problem_id:'p'}]);
 expect(previousReviewScores('elena','i','r')).toMatchObject({score:null,total:null});
});
