export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ success: false, error: 'Method Not Allowed' });
  }

  const { html } = req.body;
  if (!html) {
    return res
      .status(400)
      .json({ success: false, error: 'Missing HTML content' });
  }

  // (Optional) You can add sanitization here if needed

  // Simply return the HTML in the JSON response
  return res.status(200).json({ success: true, html });
}
