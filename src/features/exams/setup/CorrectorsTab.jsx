import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAction, useApi } from '../../../lib/hooks.js';
import { Badge, Button, Checkbox, DataTable, ErrorState, Loader, Panel, Stats, useToast } from '../../../ui';
import { createAssignmentRule, deleteAssignmentRule, getCoverage, listAssignmentRules, listSubjectMembers } from '../api.js';

/** Corrector assignment rules (RF-8.1/8.3) + coverage check (RF-8.5).
 *  A rule = which teachers grade which problems (optionally per group / model). */
export default function CorrectorsTab({ exam }) {
  const { t } = useTranslation('exams');
  const { t: tc } = useTranslation();
  const toast = useToast();
  const rules = useApi(() => listAssignmentRules(exam.id), [exam.id]);
  const coverage = useApi(() => getCoverage(exam.id), [exam.id]);
  const teachers = useApi(
    async () => (await listSubjectMembers(exam.subject_id, ['COORDINATOR', 'TEACHER'])).sort((a, b) => (a.role === b.role ? 0 : a.role === 'COORDINATOR' ? -1 : 1)),
    [exam.subject_id],
  );
  const del = useAction((id) => deleteAssignmentRule(id));

  const problems = (exam.models_problems ?? []).flatMap((m) => m.problems.map((p) => ({ ...p, model: m.label })));
  const problemName = (id) => problems.find((p) => p.id === id)?.name ?? id;
  const teacherName = (id) => teachers.data?.find((m) => m.user_id === id)?.user_name ?? id;
  const refresh = () => {
    rules.reload();
    coverage.reload();
  };

  const onDelete = async (id) => {
    try {
      await del.run(id);
      toast.success(t('setup.correctors.deleted'));
      refresh();
    } catch (e) {
      toast.error(tc(`errors.${e.code}`, { defaultValue: e.code }));
    }
  };

  return (
    <div className="ui-stack">
      {coverage.data && (
        <Stats
          items={[
            { label: t('setup.correctors.covered'), value: `${coverage.data.covered_problems}/${coverage.data.total_problems}`, tone: coverage.data.complete ? 'green' : 'gold' },
            { label: t('setup.correctors.rules'), value: coverage.data.rules_count },
            { label: t('setup.correctors.instances'), value: coverage.data.total_instances },
          ]}
        />
      )}
      {coverage.data && !coverage.data.complete && (
        <p className="u-muted">
          {t('setup.correctors.uncovered')}{' '}
          {coverage.data.uncovered_problems.map((u) => (
            <Badge key={u.problem_id} tone="gold">
              {u.problem_name}
            </Badge>
          ))}
        </p>
      )}

      <Panel title={t('setup.correctors.listTitle')} flush>
        {rules.initialLoading || teachers.initialLoading ? (
          <Loader />
        ) : rules.error ? (
          <ErrorState error={rules.error} onRetry={rules.reload} />
        ) : (
          <DataTable
            caption={t('setup.correctors.listTitle')}
            rows={rules.data}
            empty={<p className="setup-pad u-muted">{t('setup.correctors.empty')}</p>}
            columns={[
              { key: 'problems', header: t('setup.correctors.problems'), render: (r) => r.problems.map(problemName).join(', ') },
              { key: 'correctors', header: t('setup.correctors.correctors'), render: (r) => r.correctors.map(teacherName).join(', ') },
              {
                key: 'del',
                header: '',
                render: (r) => (
                  <Button size="sm" variant="ghost" onClick={() => onDelete(r.id)} aria-label={t('setup.correctors.delete')}>
                    {t('setup.correctors.delete')}
                  </Button>
                ),
              },
            ]}
          />
        )}
      </Panel>

      {teachers.error ? (
        <ErrorState error={teachers.error} onRetry={teachers.reload} />
      ) : (
        teachers.data && <NewRuleForm examId={exam.id} problems={problems} teachers={teachers.data} onCreated={refresh} />
      )}
    </div>
  );
}

function NewRuleForm({ examId, problems, teachers, onCreated }) {
  const { t } = useTranslation('exams');
  const { t: tc } = useTranslation();
  const toast = useToast();
  const [pick, setPick] = useState(new Set());
  const [who, setWho] = useState(new Set());
  const create = useAction(() => createAssignmentRule(examId, { problems: [...pick], correctors: [...who], groups: [], models_filter: [] }));
  const toggle = (set, setter, id) => {
    const n = new Set(set);
    n.has(id) ? n.delete(id) : n.add(id);
    setter(n);
  };

  const submit = async () => {
    try {
      await create.run();
      setPick(new Set());
      setWho(new Set());
      toast.success(t('setup.correctors.created'));
      onCreated();
    } catch (e) {
      toast.error(tc(`errors.${e.code}`, { defaultValue: e.code }));
    }
  };

  return (
    <Panel title={t('setup.correctors.newTitle')}>
      <div className="setup-two">
        <fieldset className="setup-fieldset">
          <legend>{t('setup.correctors.problems')}</legend>
          {problems.map((p) => (
            <Checkbox key={p.id} label={`${p.name} · ${t('setup.structure.model', { label: p.model })}`} checked={pick.has(p.id)} onChange={() => toggle(pick, setPick, p.id)} />
          ))}
        </fieldset>
        <fieldset className="setup-fieldset">
          <legend>{t('setup.correctors.correctors')}</legend>
          {teachers.map((m) => (
            <Checkbox key={m.user_id} label={`${m.user_name} · ${tc(`roles.${m.role}`, { defaultValue: m.role })}`} checked={who.has(m.user_id)} onChange={() => toggle(who, setWho, m.user_id)} />
          ))}
        </fieldset>
      </div>
      <div className="setup-actions">
        <Button variant="solid" onClick={submit} disabled={!pick.size || !who.size} loading={create.pending}>
          {t('setup.correctors.create')}
        </Button>
      </div>
    </Panel>
  );
}
