/* Minimal validator for the OpenAPI 3.0 subset that drf-spectacular emits
 * ($ref, allOf/oneOf/anyOf, nullable, enum, object/array/scalars, the
 * date/date-time/decimal/email formats, pattern, maxLength).
 *
 * Stricter than OpenAPI on purpose: an object schema that lists `properties`
 * and no `additionalProperties` rejects unknown keys, because a field the
 * backend does not declare is a field the mock invented.
 */

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function createValidator(schemas) {
  const resolve = (s) => (s?.$ref ? schemas[s.$ref.split('/').pop()] : s);

  /* Properties an allOf/$ref chain allows, to judge extra keys once. */
  function declared(schema) {
    const s = resolve(schema);
    if (!s) return { props: {}, open: true };
    if (s.allOf) {
      return s.allOf.map(declared).reduce((a, b) => ({ props: { ...a.props, ...b.props }, open: a.open || b.open }), { props: {}, open: false });
    }
    if (s.properties) return { props: s.properties, open: Boolean(s.additionalProperties) };
    return { props: {}, open: true };
  }

  function check(schema, value, at, errors) {
    const s = resolve(schema);
    if (!s) return errors;
    if (value === null) {
      if (!s.nullable && !(s.enum && s.enum.includes(null))) errors.push(`${at}: null not allowed`);
      return errors;
    }
    if (s.allOf) {
      s.allOf.forEach((part) => checkNoExtras(part, value, at, errors));
      const { props, open } = declared(s);
      if (!open && isObject(value)) extras(value, props, at, errors);
      return errors;
    }
    const alternatives = s.oneOf ?? s.anyOf;
    if (alternatives) {
      if (!alternatives.some((alt) => check(alt, value, at, []).length === 0)) {
        errors.push(`${at}: matches none of ${alternatives.map((a) => a.$ref?.split('/').pop() ?? a.type ?? '?').join(' | ')}`);
      }
      return errors;
    }
    if (s.enum && !s.enum.includes(value)) {
      errors.push(`${at}: ${JSON.stringify(value)} not in enum [${s.enum.join(', ')}]`);
      return errors;
    }
    switch (s.type) {
      case 'object': {
        if (!isObject(value)) return push(errors, at, 'object', value);
        (s.required ?? []).forEach((k) => {
          if (!(k in value) && !s.properties?.[k]?.writeOnly) errors.push(`${at}.${k}: required field missing`);
        });
        Object.entries(s.properties ?? {}).forEach(([k, sub]) => {
          if (k in value) check(sub, value[k], `${at}.${k}`, errors);
        });
        if (s.properties && !s.additionalProperties) extras(value, s.properties, at, errors);
        else if (isObject(s.additionalProperties)) {
          Object.entries(value).forEach(([k, v]) => {
            if (!s.properties?.[k]) check(s.additionalProperties, v, `${at}.${k}`, errors);
          });
        }
        return errors;
      }
      case 'array':
        if (!Array.isArray(value)) return push(errors, at, 'array', value);
        value.forEach((item, i) => check(s.items, item, `${at}[${i}]`, errors));
        return errors;
      case 'string':
        if (typeof value !== 'string') return push(errors, at, `string${s.format ? `(${s.format})` : ''}`, value);
        if (s.format === 'date' && !DATE.test(value)) errors.push(`${at}: "${value}" is not a date`);
        if (s.format === 'date-time' && (DATE.test(value) || Number.isNaN(Date.parse(value)))) errors.push(`${at}: "${value}" is not a date-time`);
        if (s.format === 'email' && !value.includes('@')) errors.push(`${at}: "${value}" is not an email`);
        if (s.pattern && !new RegExp(s.pattern).test(value)) errors.push(`${at}: "${value}" does not match ${s.pattern}`);
        if (s.maxLength && value.length > s.maxLength) errors.push(`${at}: longer than ${s.maxLength}`);
        return errors;
      case 'integer':
        if (!Number.isInteger(value)) push(errors, at, 'integer', value);
        return errors;
      case 'number':
        if (typeof value !== 'number') push(errors, at, 'number', value);
        return errors;
      case 'boolean':
        if (typeof value !== 'boolean') push(errors, at, 'boolean', value);
        return errors;
      default:
        if (s.properties || s.required) return check({ ...s, type: 'object' }, value, at, errors);
        return errors;
    }
  }

  /* allOf members are checked without their own extra-key rule; the union decides. */
  function checkNoExtras(part, value, at, errors) {
    const s = resolve(part);
    if (s?.properties && !s.additionalProperties && isObject(value)) {
      return check({ ...s, additionalProperties: true }, value, at, errors);
    }
    return check(part, value, at, errors);
  }

  return (schema, value, at = '$') => check(schema, value, at, []);
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function extras(value, props, at, errors) {
  Object.keys(value).forEach((k) => {
    if (!(k in props)) errors.push(`${at}.${k}: field not in the contract`);
  });
}

function push(errors, at, expected, value) {
  errors.push(`${at}: expected ${expected}, got ${Array.isArray(value) ? 'array' : typeof value} ${JSON.stringify(value)?.slice(0, 40)}`);
  return errors;
}
