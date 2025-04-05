import puppeteer from 'puppeteer';
import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

// Initialize S3 client with region from environment variables
const s3 = new AWS.S3({
  region: process.env.AWS_REGION,
  // AWS credentials are automatically read from env vars
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
    // Launch Puppeteer with no-sandbox flags for serverless environments
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4' });
    await browser.close();

    // Generate a unique filename using timestamp and UUID
    const filename = `${Date.now()}-${uuidv4()}.pdf`;

    // S3 upload parameters
    const params = {
      Bucket: process.env.S3_BUCKET_NAME, // "ace-coatings-roi-pdfs"
      Key: filename,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
      ACL: 'public-read', // Makes the file publicly accessible
    };

    // Upload the PDF to S3
    const s3Result = await s3.upload(params).promise();

    // Return the public URL of the uploaded PDF
    return res.status(200).json({
      success: true,
      url: s3Result.Location,
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
Future enhancements:
- API key header validation
- Rate limiting
- Lifecycle expiration rules for PDFs
*/
