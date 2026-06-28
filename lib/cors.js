// The widget is embedded on customers' own websites, so the API is called
// cross-origin. Allow all origins for the public endpoints (chat/onboarding).
export function applyCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// Call at the top of a handler; returns true if it handled a preflight request.
export function handledPreflight(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}
