
const dns = require('dns');

dns.setServers(['1.1.1.1', '8.8.8.8']);

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');

const scrypt = promisify(crypto.scrypt);

const { parseResume } = require('./parseResume');
const { runScreeningPipeline } = require('./screening/screeningPipeline');

const Screening = require('./models/Screening');
const User = require('./models/User');
const authenticateToken = require('./middleware/auth');
const JobCase = require('./models/JobCase');
const ScoreCache = require('./models/ScoreCache');


// ============================================
// SCREENING CACHE CONFIGURATION
// ============================================

const SCORING_VERSION = 'v11-category-name-test-3';
const PIPELINE_VERSION = 'v2-semantic-integration';

function getCurrentMonthYear() {
  const date = new Date();

  const monthNames = [
    'January', 'February', 'March', 'April',
    'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December'
  ];

  return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

function createScreeningCacheKey({
  resumeText,
  jobDescription,
  asOfDate
}) {
  const cacheData = {
    resumeText,
    jobDescription,
    scoringVersion: SCORING_VERSION,
    pipelineVersion: PIPELINE_VERSION,
    asOfDate
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(cacheData))
    .digest('hex');
}


const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  exposedHeaders: ['X-Screening-Cache']
}));
app.use(express.json());

// Resume upload configuration
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
      return callback(null, true);
    }

    callback(new Error('Only PDF and DOCX files are allowed.'));
  }
});

// Password helpers
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);

  return `${salt}:${derivedKey.toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
  const [salt, originalHash] = storedHash.split(':');

  if (!salt || !originalHash) {
    return false;
  }

  const derivedKey = await scrypt(password, salt, 64);
  const originalBuffer = Buffer.from(originalHash, 'hex');

  return (
    originalBuffer.length === derivedKey.length &&
    crypto.timingSafeEqual(originalBuffer, derivedKey)
  );
}

// Generate login token
function createToken(userId) {
  return jwt.sign(
    {},
    process.env.JWT_SECRET,
    {
      subject: userId.toString(),
      expiresIn: '7d'
    }
  );
}


// Register recruiter
app.post('/api/auth/register', async (req, res) => {
  try {
    const {
      fullName,
      companyName,
      recruiterRole,
      email,
      password
    } = req.body;

    // Validate required fields
    if (
      typeof fullName !== 'string' ||
      typeof companyName !== 'string' ||
      typeof recruiterRole !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !fullName.trim() ||
      !companyName.trim() ||
      !recruiterRole.trim() ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        error: 'Please fill in all required fields.'
      });
    }

    // Validate email
    const normalizedEmail = email.trim().toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid email address.'
      });
    }

    // Validate password
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must contain at least 8 characters.'
      });
    }

    // Check for existing account
    const existingUser = await User.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email already exists.'
      });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create recruiter account
    const user = await User.create({
      fullName: fullName.trim(),
      companyName: companyName.trim(),
      recruiterRole: recruiterRole.trim(),
      email: normalizedEmail,
      passwordHash
    });

    const token = createToken(user._id);

    return res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        companyName: user.companyName,
        recruiterRole: user.recruiterRole,
        email: user.email
      }
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email already exists.'
      });
    }

    console.error('Registration error:', error);

    return res.status(500).json({
      success: false,
      error: 'Could not create your account.'
    });
  }
});


// Recruiter login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required.'
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase()
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
    }

    const passwordMatches = await verifyPassword(
      password,
      user.passwordHash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
    }

    const token = createToken(user._id);

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Login error:', error);

    return res.status(500).json({
      success: false,
      error: 'Login failed. Please try again.'
    });
  }
});


// Create a new recruitment case
app.post('/api/cases', authenticateToken, async (req, res) => {
  try {
    const { jobTitle, jobDescription } = req.body;

    if (
      typeof jobTitle !== 'string' ||
      !jobTitle.trim() ||
      typeof jobDescription !== 'string' ||
      !jobDescription.trim()
    ) {
      return res.status(400).json({
        error: 'Job title and job description are required.'
      });
    }

    const newCase = await JobCase.create({
      recruiterId: req.user.id,
      jobTitle: jobTitle.trim(),
      jobDescription: jobDescription.trim()
    });

    return res.status(201).json({
      message: 'Recruitment case created successfully.',
      jobCase: newCase
    });

  } catch (error) {
    console.error('Create case error:', error);

    return res.status(500).json({
      error: 'Could not create recruitment case.'
    });
  }
});


// Get recruitment cases belonging to the logged-in recruiter
app.get('/api/cases', authenticateToken, async (req, res) => {
  try {
    const cases = await JobCase.find({
      recruiterId: req.user.id
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      cases
    });

  } catch (error) {
    console.error('Fetch cases error:', error);

    return res.status(500).json({
      error: 'Could not retrieve recruitment cases.'
    });
  }
});


// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is running',
    database:
      mongoose.connection.readyState === 1
        ? 'connected'
        : 'disconnected'
  });
});

// Protected resume screening
app.post(
  '/api/screen',
  authenticateToken,

  (req, res, next) => {
    upload.single('resume')(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message
        });
      }

      next();
    });
  },

  async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
          success: false,
          error: 'Database is not connected. Please try again.'
        });
      }

      const { caseId } = req.body;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Please upload a resume.'
        });
      }

      // Validate recruitment case ID
      if (!caseId || !mongoose.Types.ObjectId.isValid(caseId)) {
        return res.status(400).json({
          success: false,
          error: 'A valid recruitment case is required.'
        });
      }

      // Find case belonging to the logged-in recruiter
      const jobCase = await JobCase.findOne({
        _id: caseId,
        recruiterId: req.user.id
      });

      if (!jobCase) {
        return res.status(404).json({
          success: false,
          error: 'Recruitment case not found.'
        });
      }

      // Always use the saved job description
      const jobDescription = jobCase.jobDescription;

      const resumeText = await parseResume(
        req.file.buffer,
        req.file.originalname
      );

      if (
        typeof resumeText !== 'string' ||
        !resumeText.trim()
      ) {
        return res.status(400).json({
          success: false,
          error: 'No readable text found in the resume.'
        });
      }
// ============================================
// SCREENING CACHE LOOKUP
// ============================================

const asOfDate = getCurrentMonthYear();

const cacheKey = createScreeningCacheKey({
  resumeText,
  jobDescription,
  asOfDate
});

let result = null;
let cacheHit = false;

// Check whether this exact evaluation already exists.
try {
  const cachedResult = await ScoreCache
    .findOne({ cacheKey })
    .lean();

  if (cachedResult && cachedResult.result) {
    result = cachedResult.result;
    cacheHit = true;

    console.log('[Cache HIT] Reusing previous screening result.');
  }
} catch (cacheError) {
  console.error(
    '[Cache READ ERROR]',
    cacheError.message
  );

  console.log('Continuing with fresh screening...');
}

// ============================================
// RUN PIPELINE ON CACHE MISS
// ============================================

if (!cacheHit) {
  console.log('[Cache MISS] Running screening pipeline...');

  result = await runScreeningPipeline({
    resumeText,
    jobDescription,
    asOfDate
  });

  // Store the complete validated result.
  try {
    await ScoreCache.updateOne(
      { cacheKey },
      {
        $setOnInsert: {
          cacheKey,
          result
        }
      },
      { upsert: true }
    );

    console.log('[Cache SAVE] Screening result cached.');
  } catch (cacheError) {
    console.error(
      '[Cache WRITE ERROR]',
      cacheError.message
    );

    // A cache write failure must not discard
    // a successfully completed screening.
  }
}

console.log(
  `[Screening] Evaluation source: ${cacheHit ? 'CACHE' : 'PIPELINE'}`
);


      console.log(
        'Screening result:',
        JSON.stringify(result, null, 2)
      );

      // Save screening with recruiter and case references
      const screening = await Screening.create({
        recruiterId: req.user.id,
        caseId: jobCase._id,
        fileName: req.file.originalname,
        jobDescription: jobDescription,
        result
      });

      console.log(
        'Screening saved successfully:',
        screening._id.toString()
      );

      res.set(
       'X-Screening-Cache',
        cacheHit ? 'HIT' : 'MISS'
      );

      return res.status(200).json({
        success: true,
        screeningId: screening._id,
        caseId: screening.caseId,
        fileName: screening.fileName,
        result: screening.result,
        createdAt: screening.createdAt
      });

    } catch (error) {
      console.error('Screening error:', error);

      return res.status(500).json({
        success: false,
        error: 'Resume screening failed. Please try again.'
      });
    }
  }
);


// Protected recruiter-specific, case-wise screening history

app.get(
  '/api/screenings',
  authenticateToken,
  async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
          success: false,
          error: 'Database is not connected.'
        });
      }

      const { caseId } = req.query;

      // A case ID is required for case-wise history.
      if (!caseId || !mongoose.Types.ObjectId.isValid(caseId)) {
        return res.status(400).json({
          success: false,
          error: 'A valid recruitment case ID is required.'
        });
      }

      // Verify that this case belongs to the logged-in recruiter.
      const jobCase = await JobCase.findOne({
        _id: caseId,
        recruiterId: req.user.id
      });

      if (!jobCase) {
        return res.status(404).json({
          success: false,
          error: 'Recruitment case not found.'
        });
      }

      // Fetch only screenings belonging to this recruiter and case.
      const screenings = await Screening.find({
        recruiterId: req.user.id,
        caseId: jobCase._id
      })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

      return res.status(200).json({
        success: true,
        caseId: jobCase._id,
        jobTitle: jobCase.jobTitle,
        screenings
      });

    } catch (error) {
      console.error('Fetch screenings error:', error);

      return res.status(500).json({
        success: false,
        error: 'Could not retrieve screening history.'
      });
    }
  }
);


// Update candidate shortlisting status
app.patch(
  '/api/screenings/:screeningId/status',
  authenticateToken,
  async (req, res) => {
    try {
      const { screeningId } = req.params;
      const { caseId, status } = req.body;

      const allowedStatuses = [
        'Under Review',
        'Shortlisted',
        'Rejected'
      ];

      // Validate IDs
      if (
        !mongoose.Types.ObjectId.isValid(screeningId) ||
        !caseId ||
        !mongoose.Types.ObjectId.isValid(caseId)
      ) {
        return res.status(400).json({
          success: false,
          error: 'Valid screening and case IDs are required.'
        });
      }

      // Validate status
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid candidate status.'
        });
      }

      // Verify that the case belongs to this recruiter
      const jobCase = await JobCase.findOne({
        _id: caseId,
        recruiterId: req.user.id
      });

      if (!jobCase) {
        return res.status(404).json({
          success: false,
          error: 'Recruitment case not found.'
        });
      }

      // Update only a screening belonging to this recruiter and case
      const screening = await Screening.findOneAndUpdate(
        {
          _id: screeningId,
          recruiterId: req.user.id,
          caseId: jobCase._id
        },
        {
          $set: { status }
        },
        {
          new: true,
          runValidators: true
        }
      );

      if (!screening) {
        return res.status(404).json({
          success: false,
          error: 'Candidate screening not found in this case.'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Candidate status updated successfully.',
        screening: {
          _id: screening._id,
          status: screening.status
        }
      });

    } catch (error) {
      console.error('Update candidate status error:', error);

      return res.status(500).json({
        success: false,
        error: 'Could not update candidate status.'
      });
    }
  }
);

// Delete an individual candidate screening
app.delete(
  '/api/screenings/:screeningId',
  authenticateToken,
  async (req, res) => {
    try {
      const { screeningId } = req.params;
      const { caseId } = req.query;

      // Validate screening and case IDs
      if (
        !mongoose.Types.ObjectId.isValid(screeningId) ||
        !caseId ||
        !mongoose.Types.ObjectId.isValid(caseId)
      ) {
        return res.status(400).json({
          success: false,
          error: 'Valid screening and case IDs are required.'
        });
      }

      // Verify that the case belongs to the logged-in recruiter
      const jobCase = await JobCase.findOne({
        _id: caseId,
        recruiterId: req.user.id
      });

      if (!jobCase) {
        return res.status(404).json({
          success: false,
          error: 'Recruitment case not found.'
        });
      }

      // Delete only this recruiter's screening in this case
      const deletedScreening = await Screening.findOneAndDelete({
        _id: screeningId,
        recruiterId: req.user.id,
        caseId: jobCase._id
      });

      if (!deletedScreening) {
        return res.status(404).json({
          success: false,
          error: 'Candidate screening not found.'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Candidate screening deleted successfully.'
      });

    } catch (error) {
      console.error('Delete screening error:', error);

      return res.status(500).json({
        success: false,
        error: 'Could not delete candidate screening.'
      });
    }
  }
);




// Handle unexpected errors
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);

  if (res.headersSent) {
    return next(err);
  }

  return res.status(500).json({
    success: false,
    error: 'An unexpected server error occurred.'
  });
});


// Connect to MongoDB before starting server
async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is missing from the .env file.');
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is missing from the .env file.');
    }

    await mongoose.connect(process.env.MONGODB_URI);

    console.log('MongoDB connected successfully');

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error('Server startup failed:', error.message);
    process.exit(1);
  }
}

startServer();
