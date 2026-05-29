// Middleware 404
export const notFound = (req, res, _next) => {
  res.status(404).json({ error: `Route introuvable : ${req.method} ${req.originalUrl}` });
};

// Middleware d'erreur centralisé
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, _req, res, _next) => {
  console.error('[API error]', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Erreur interne du serveur',
  });
};

// Wrapper pour attraper les rejets async sans try/catch partout
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
