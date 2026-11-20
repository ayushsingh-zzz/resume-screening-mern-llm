
const mongoose = require('mongoose');

const jobCaseSchema = new mongoose.Schema(
  {
    recruiterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    jobTitle: {
      type: String,
      required: true,
      trim: true
    },

    jobDescription: {
      type: String,
      required: true,
      trim: true
    },

    status: {
      type: String,
      enum: ['Active', 'Closed'],
      default: 'Active'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('JobCase', jobCaseSchema);
