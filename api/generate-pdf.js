import chromium from 'chrome-aws-lambda';
import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

// Initialize S3 client with region from environment variables
const s3 = new AWS.S3({
  region: process.env.AWS_REGION,
  // AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are automatically picked up from env vars
});

export default async function handler(req, res) {
  // Only accept POST requests
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
    // Generate PDF from HTML using Puppeteer
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

    // Generate a unique filename using timestamp and UUID
    const filename = `${Date.now()}-${uuidv4()}.pdf`;

    // Upload the PDF to S3 with public-read ACL
    const params = {
      Bucket: process.env.S3_BUCKET_NAME, // "ace-coatings-roi-pdfs"
      Key: filename,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
      ACL: 'public-read',
    };

    // Use s3.upload() which returns a promise
    const s3Result = await s3.upload(params).promise();

    // Optional: Log the upload for analytics
    console.log('PDF uploaded to S3:', s3Result.Location);

    // Respond with the public URL of the uploaded PDF
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
- Implement API key header validation to restrict access
- Add rate limiting to prevent abuse
- Consider using presigned URLs or lifecycle rules for PDF expiration
*/
