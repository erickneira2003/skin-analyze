import axios from 'axios';
import FormData from 'form-data';
import sharp from 'sharp';

// Tell Vercel to disable body parsing so we can handle raw binary
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Only POST requests allowed' });
  }

  try {
    // Read the raw binary body (image uploaded)
    const buffers = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }
    const rawBuffer = Buffer.concat(buffers);

    // Convert uploaded image to JPEG using sharp (required by AILab)
    const jpegBuffer = await sharp(rawBuffer).jpeg().toBuffer();

    // Create multipart/form-data request
    const formData = new FormData();
    formData.append('image', jpegBuffer, {
      filename: 'selfie.jpg',
      contentType: 'image/jpeg',
    });

    // Send the request to AILab
    const response = await axios.post(
      'https://www.ailabapi.com/api/portrait/analysis/skin-analysis-pro',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'ailabapi-api-key': 'ey7mV5aEppSHoWqFBqkRbQJwa0DjA6ozxhKG1TMz8ZluSOEV22x08WruKAbIdZU5', // replace if needed
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 20000, // 20 seconds
      }
    );

    // Success: send AILab's result back to frontend
    res.status(200).json(response.data);

  } catch (err) {
    if (err.response) {
      console.error('❌ AILab API error:', err.response.status, err.response.data);
      res.status(err.response.status).json({
        error_msg: err.response.data?.error_msg || err.response.data?.message || 'Unknown AILab error',
      });
    } else {
      console.error('❌ Unexpected error:', err.message);
      res.status(500).json({ error_msg: err.message || 'Internal server error' });
    }
  }
}

