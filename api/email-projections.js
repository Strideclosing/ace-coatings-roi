export default async function handler(req, res) {
  // Only allow POST requests.
  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ success: false, error: 'Method Not Allowed' });
  }

  // Security check: Only proceed if the x-api-key header matches the secret key.
  // Ensure that PDF_API_KEY is set in your Vercel environment variables.
  if (
    req.headers['825b9547-557c-437d-914e-28c5593179f8'] !==
    process.env.PDF_API_KEY
  ) {
    return res.status(403).json({ success: false, error: 'Unauthorized' });
  }

  // Assume that Make.com now sends a base64-encoded HTML string.
  const { html: encodedHtml } = req.body;

  try {
    // Decode the base64-encoded HTML string using Buffer.
    const html = Buffer.from(encodedHtml, 'base64').toString('utf-8');

    // For testing, we return the decoded HTML and a success flag.
    return res.status(200).json({ success: true, html });
  } catch (error) {
    console.error('Error decoding HTML:', error);
    return res
      .status(500)
      .json({ success: false, error: 'Error decoding HTML' });
  }
}
