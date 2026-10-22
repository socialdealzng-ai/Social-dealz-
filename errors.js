// One consistent JSON error shape: { error: { code, message, details? } }
class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function notFoundApi(req, res) {
  res.status(404).json({ error: { code: 'not_found', message: 'That API route does not exist.' } });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof HttpError) {
    return res
      .status(err.status)
      .json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'invalid_json', message: 'The request body is not valid JSON.' } });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'too_large', message: 'The request body is too large.' } });
  }

  // Never leak internal details to the client.
  console.error('Unhandled error:', err);
  return res
    .status(500)
    .json({ error: { code: 'server_error', message: 'Something went wrong on our side. Please try again.' } });
}

module.exports = { HttpError, notFoundApi, errorHandler };
                      
