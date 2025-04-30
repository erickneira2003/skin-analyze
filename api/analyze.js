import formidable from 'formidable';
import fs from 'fs/promises';
import sharp from 'sharp';
import axios from 'axios';
import FormData from 'form-data';

// Disable default body parser
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
    // Parse the incoming multipart/form-data
    const form = new formidable.IncomingForm({ keepExtensions: true });

    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const uploadedFile = files.image;
    if (!uploadedFile) {
      return res.status(400).json({ message: 'No image uploaded' });
    }

    // Read file from disk and convert to JPEG
    const buffer = await fs.readFile(uploadedFile.filepath);
    const jpegBuffer = await sharp(buffer).jpeg().toBuffer();

    // Create FormData to send to AILab
    const apiForm = new FormData();
    apiForm.append('image', jpegBuffer, {
      filename: 'converted.jpg',
      contentType: 'image/jpeg',
    });

    const response = await axios.post(
      'https://www.ailabapi.com/api/portrait/analysis/skin-analysis-pro',
      apiForm,
      {
        headers: {
          ...apiForm.getHeaders(),
          'ailabapi-api-key': 'ey7mV5aEppSHoWqFBqkRbQJwa0DjA6ozxhKG1TMz8ZluSOEV22x08WruKAbIdZU5',
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 20000,
      }
    );

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


