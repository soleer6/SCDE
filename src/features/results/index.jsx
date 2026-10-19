
/* Owner: Claude. Student result view, rendered by /exams/:examId when the
   user's role in the subject is STUDENT (no routes of its own). */
export default {
  id: 'results',
  order: 25,
  mocks: [],
  i18n: {
    es: {
      crumbs: { subjects: 'Asignaturas' },
      empty: { title: 'Tu nota aún no está publicada', body: 'Recibirás una notificación cuando la coordinación publique las notas de este examen.' },
      hero: {
        grade: 'Tu nota', over: 'sobre {{max}}', reviewOpen: 'Revisión abierta hasta el {{end}}',
        review: { SCHEDULED: 'La revisión empieza el {{start}}', CLOSED: 'El periodo de revisión ha terminado', COMPLETED: 'La revisión ha concluido' },
      },
      pdf: {
        hiddenTitle: 'El examen corregido se mostrará durante la revisión',
        hiddenBody: 'Podrás ver tus páginas con las anotaciones cuando se abra el periodo de revisión.',
        hiddenAfter: 'Tras la revisión, la asignatura no permite volver a consultar las páginas.',
        error: 'No se ha podido cargar tu examen',
      },
      breakdown: { title: 'Desglose', problem: 'Problema', score: 'Nota', max: 'Máx.', hidden: 'El desglose por problema se muestra durante la revisión.' },
      comment: { title: 'Comentario del profesorado' },
      review: {
        title: 'Revisión', notOpen: 'Todavía no hay periodo de revisión para este examen.', closed: 'El periodo de revisión no está abierto.',
        help: 'Marca los problemas cuya corrección quieres que se revise y explica el motivo.',
        reason: 'Motivo', reasonPlaceholder: 'Qué crees que no se ha valorado bien',
        submit_one: 'Pedir revisión de {{count}} problema', submit_other: 'Pedir revisión de {{count}} problemas',
        sent_one: 'Solicitud enviada', sent_other: '{{count}} solicitudes enviadas', alreadySent: 'ya solicitada',
        partial: 'Enviadas {{count}} de {{total}}: el resto ya estaba solicitado.', noneCreated: 'Esos problemas ya tenían una solicitud de revisión.',
        requests: 'Tus solicitudes',
        pending: 'Pendiente', resolved: 'Resuelta', reply: 'Respuesta',
        noProblems: 'Este examen no permite ver los problemas en revisión.',
        noIds: 'No se puede pedir revisión desde aquí: el servidor no indica los problemas del examen. Contacta con la coordinación.',
        errors: { REVIEW_NOT_OPEN: 'El periodo de revisión no está abierto.', INSTANCE_NOT_IN_REVIEW: 'Tu examen no está en revisión.' },
      },
    },
    en: {
      crumbs: { subjects: 'Subjects' },
      empty: { title: "Your grade isn't published yet", body: "You'll get a notification when grades for this exam are published." },
      hero: {
        grade: 'Your grade', over: 'out of {{max}}', reviewOpen: 'Review open until {{end}}',
        review: { SCHEDULED: 'Review starts on {{start}}', CLOSED: 'The review period has ended', COMPLETED: 'The review is complete' },
      },
      pdf: {
        hiddenTitle: 'Your graded exam is shown during review',
        hiddenBody: "You'll see your pages with annotations once the review period opens.",
        hiddenAfter: "After review, this subject doesn't allow viewing the pages again.",
        error: "Couldn't load your exam",
      },
      breakdown: { title: 'Breakdown', problem: 'Problem', score: 'Grade', max: 'Max', hidden: 'The per-problem breakdown is shown during review.' },
      comment: { title: "Teacher's comment" },
      review: {
        title: 'Review', notOpen: 'No review period for this exam yet.', closed: 'The review period is not open.',
        help: 'Select the problems you want reviewed and explain why.',
        reason: 'Reason', reasonPlaceholder: "What you think wasn't assessed correctly",
        submit_one: 'Request review of {{count}} problem', submit_other: 'Request review of {{count}} problems',
        sent_one: 'Request sent', sent_other: '{{count}} requests sent', alreadySent: 'already requested',
        partial: 'Sent {{count}} of {{total}}: the rest had already been requested.', noneCreated: 'Those problems already had a review request.',
        requests: 'Your requests',
        pending: 'Pending', resolved: 'Resolved', reply: 'Reply',
        noProblems: "This exam doesn't show problems during review.",
        noIds: "You can't request a review here: the server doesn't list the exam's problems. Contact the coordinator.",
        errors: { REVIEW_NOT_OPEN: 'The review period is not open.', INSTANCE_NOT_IN_REVIEW: 'Your exam is not in review.' },
      },
    },
  },
};
