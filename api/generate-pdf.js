import chromium from 'chrome-aws-lambda';
import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

// Initialize S3 client (uses env vars for credentials and region)
const s3 = new AWS.S3({
  region: process.env.AWS_REGION,
  // AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are automatically picked up from process.env
});

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

  try {
    // Generate the PDF using headless Chrome
    const browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4' });
    await browser.close();

    // Create a unique filename: you can use a timestamp and a UUID
    const filename = `${Date.now()}-${uuidv4()}.pdf`;

    // Configure S3 upload parameters
    const params = {
      Bucket: process.env.S3_BUCKET_NAME, // Should be set to "ace-coatings-roi-pdfs"
      Key: filename,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
      ACL: 'public-read', // This makes the file accessible via a public URL
    };

    // Upload the PDF to S3
    const s3Result = await s3.upload(params).promise();

    // Optional: Log for analytics
    console.log('PDF successfully uploaded to S3 at:', s3Result.Location);

    // Return JSON response with the public URL
    return res.status(200).json({
      success: true,
      url: s3Result.Location, // e.g., https://ace-coatings-roi-pdfs.s3.us-east-2.amazonaws.com/<filename>.pdf
    });
  } catch (error) {
    console.error('Error generating/uploading PDF:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate and upload PDF',
    });
  }
}

/*
Future Security Enhancements:
- API key header validation to restrict access
- Rate limiting to prevent abuse
- Lifecycle rules or presigned URLs for managing PDF expiration
*/
