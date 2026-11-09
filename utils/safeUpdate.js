// Build a strict, schema-shaped update object from untrusted request data.
// Only explicitly listed fields are accepted; MongoDB operators and dotted paths are rejected.
function sanitize(value, shape) {
  if (value === null) return null;

  if (Array.isArray(shape)) {
    if (!Array.isArray(value)) return undefined;
    const items = value.map(item => sanitize(item, shape[0]));
    return items.some(item => item === undefined) ? undefined : items;
  }

  if (shape && typeof shape === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      if (key.startsWith('$') || key.includes('.') ||
          ['__proto__', 'prototype', 'constructor'].includes(key) ||
          !Object.prototype.hasOwnProperty.call(shape, key)) return undefined;
      const safeValue = sanitize(item, shape[key]);
      if (safeValue === undefined) return undefined;
      result[key] = safeValue;
    }
    return result;
  }

  if (value && typeof value === 'object') return undefined;
  return value;
}

module.exports = function safeUpdate(body, allowedFields) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const result = sanitize(body, allowedFields);
  return result && Object.keys(result).length ? result : null;
};
