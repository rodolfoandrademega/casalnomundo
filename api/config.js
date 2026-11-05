module.exports = function handler(_request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || ''
  });
};
