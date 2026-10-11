
const dns = require('dns');
dns.setServers(['1.1.1.1', '8.8.8.8']);

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');

const { parseResume } = require('./parseResume');
const { scoreResume } = require('./scoreResume');

const app = express();
const PORT = process.env.PORT || 5000;

// Upload files to memory; no permanent file storage is needed.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, callback) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new Error('Only PDF and DOCX files are allowed.'));
    }
  }
});

app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => console.error('MongoDB connection error:', err.message));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is running'
  });
});

// Resume screening endpoint
app.post('/api/screen', (req, res, next) => {
  upload.single('resume')(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        error: err.message
      });
    }

    next();
  });
}, async (req, res) => {
  try {
    const { jobDescription } = req.body;

    if (!req.file) {
      return res.status(400).json({
        error: 'Please upload a resume.'
      });
    }

    if (!jobDescription || !jobDescription.trim()) {
      return res.status(400).json({
        error: 'Please provide a job description.'
      });
    }

    const resumeText = await parseResume(
      req.file.buffer,
      req.file.originalname
    );

    const result = await scoreResume(
      resumeText,
      jobDescription
    );

    res.json({
      success: true,
      fileName: req.file.originalname,
      result
    });
  } catch (error) {
    console.error('Screening error:', error.message);

    res.status(500).json({
      error: 'Resume screening failed. Please try again.'
    });
  }
});

// General error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);

  if (!res.headersSent) {
    res.status(500).json({
      error: 'An unexpected server error occurred.'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
