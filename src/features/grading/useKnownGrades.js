import { useCallback, useState } from 'react';
import { readKnownGrades, writeKnownGrade } from './api.js';

/**
 * Per-problem grades for one instance (see api.js).
 * `server` is serverGrades(instance): when present it wins over the browser
 * cache; grades saved during this session override it until the next server
 * read arrives. `server === null` means the backend does not expose grades.
 */
export function useKnownGrades(instanceId, server = null) {
  const [local, setLocal] = useState(() => readKnownGrades(instanceId));
  const [saved, setSaved] = useState({});
  const [prev, setPrev] = useState({ instanceId, server });
  if (prev.instanceId !== instanceId || prev.server !== server) {
    setPrev({ instanceId, server });
    if (prev.instanceId !== instanceId) setLocal(readKnownGrades(instanceId));
    setSaved({});
  }

  const grades = { ...(server ?? local), ...saved };
  const fromServer = server !== null;

  const remember = useCallback(
    (problemId, value) => {
      writeKnownGrade(instanceId, problemId, value);
      setLocal((g) => ({ ...g, [problemId]: value }));
      setSaved((g) => ({ ...g, [problemId]: value }));
    },
    [instanceId],
  );

  /** True when the server total is non-null but we know no per-problem grade (graded elsewhere, old backend). */
  const unknownTotal = (total, problems) => !fromServer && total != null && problems.every((p) => grades[p.id] === undefined);

  return { grades, remember, unknownTotal, fromServer };
}
