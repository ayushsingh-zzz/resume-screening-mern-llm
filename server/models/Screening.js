
const mongoose = require('mongoose');

const screeningSchema = new mongoose.Schema(
  {
    recruiterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JobCase',
      index: true
    },

    fileName: {
      type: String,
      required: true
    },

    jobDescription: {
      type: String,
      required: true
    },

    result: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },

    // Candidate shortlisting status
    status: {
      type: String,
      enum: ['Under Review', 'Shortlisted', 'Rejected'],
      default: 'Under Review'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Screening', screeningSchema);
