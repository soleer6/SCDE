import { useCallback, useState } from 'react';
import { readKnownGrades, writeKnownGrade } from './api.js';

/** Per-problem grades known to this browser (see api.js: backend gap). */
export function useKnownGrades(instanceId) {
  const [grades, setGrades] = useState(() => readKnownGrades(instanceId));
  const [prevId, setPrevId] = useState(instanceId);
  if (prevId !== instanceId) {
    setPrevId(instanceId);
    setGrades(readKnownGrades(instanceId));
  }

  const remember = useCallback(
    (problemId, value) => {
      writeKnownGrade(instanceId, problemId, value);
      setGrades((g) => ({ ...g, [problemId]: value }));
    },
    [instanceId],
  );

  /** True when the server total is non-null but we know no per-problem grade (graded elsewhere). */
  const unknownTotal = (total, problems) => total != null && problems.every((p) => grades[p.id] === undefined);

  return { grades, remember, unknownTotal };
}
