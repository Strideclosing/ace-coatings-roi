import chromium from 'chrome-aws-lambda';
import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

// Initialize S3 client with region from environment variables
const s3 = new AWS.S3({
  region: process.env.AWS_REGION,
});

export default async function handler(req, res) {
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
    // Launch Chromium using chrome-aws-lambda
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

    // Generate a unique filename
    const filename = `${Date.now()}-${uuidv4()}.pdf`;

    // Configure S3 upload parameters
    const params = {
      Bucket: process.env.S3_BUCKET_NAME, // "ace-coatings-roi-pdfs"
      Key: filename,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
      ACL: 'public-read',
    };

    // Upload the PDF to S3
    const s3Result = await s3.upload(params).promise();

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
Future Security Enhancements:
- API key header validation
- Rate limiting
- Lifecycle rules for PDF expiration
*/
