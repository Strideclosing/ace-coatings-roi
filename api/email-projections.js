export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ success: false, error: 'Method Not Allowed' });
  }
  // Assume that Make.com now sends a base64-encoded HTML string.
  const { html: encodedHtml } = req.body;
  try {
    // Decode the base64-encoded HTML
    const html = Buffer.from(encodedHtml, 'base64').toString('utf-8');

    // Now proceed as usual with your decoded HTML
    // For testing, we can just return it:
    return res.status(200).json({ success: true, html });
  } catch (error) {
    console.error('Error decoding HTML:', error);
    return res
      .status(500)
      .json({ success: false, error: 'Error decoding HTML' });
  }
}
