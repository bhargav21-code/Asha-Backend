// Forward rejected async route-handler promises to Express error middleware.
module.exports = handler => (req, res, next) =>
  Promise.resolve().then(() => handler(req, res)).catch(next);
