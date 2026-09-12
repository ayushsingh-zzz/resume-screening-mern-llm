const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    resumeFileName: {
      type: String,
      required: true
    },

    resumeText: {
      type: String,
      required: true
    },

    score: {
      type: Number,
      min: 0,
      max: 100,
      required: true
    },

    breakdown: {
      skills: {
        type: Number,
        min: 0,
        max: 40
      },

      experience: {
        type: Number,
        min: 0,
        max: 30
      },

      education: {
        type: Number,
        min: 0,
        max: 15
      },

      projects: {
        type: Number,
        min: 0,
        max: 15
      }
    },

    matchedSkills: {
      type: [String],
      default: []
    },

    missingSkills: {
      type: [String],
      default: []
    },

    summary: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Candidate', candidateSchema);