// Build a strict, schema-shaped update object from untrusted request data.
// Only explicitly listed fields are accepted; MongoDB operators and dotted paths are rejected.
function sanitize(value, shape) {
  if (Array.isArray(shape)) {
    if (!Array.isArray(value)) return undefined;
    const items = value.map(item => {
      if (item === null && shape[0] && typeof shape[0] === 'object') return undefined;
      return sanitize(item, shape[0]);
    });
    return items.some(item => item === undefined) ? undefined : items;
  }

  if (value === null) {
    // Do not allow replacing a nested object wholesale; callers may update its leaves.
    return shape && typeof shape === 'object' ? undefined : null;
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

function flattenNestedObjects(value, prefix, result) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, nestedValue] of Object.entries(value)) {
      flattenNestedObjects(nestedValue, prefix ? `${prefix}.${key}` : key, result);
    }
  } else if (prefix) {
    result[prefix] = value;
  }
}

module.exports = function safeUpdate(body, allowedFields) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const sanitized = sanitize(body, allowedFields);
  if (!sanitized) return null;

  // Dotted leaf paths make MongoDB apply partial nested changes without erasing siblings.
  const update = {};
  flattenNestedObjects(sanitized, '', update);
  return Object.keys(update).length ? update : null;
};
