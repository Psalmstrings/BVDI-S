const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  console.error(`[Error Handler] ${err.stack || err.message}`);

  // Mongoose duplicate key error (e.g. VIN or Email)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    if (field === 'vin') {
      return res.status(400).json({
        success: false,
        message: 'A voter record with this VIN already exists.',
      });
    }
    if (field === 'email') {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }
    if (field === 'recruiterCode') {
      return res.status(400).json({
        success: false,
        message: 'A recruiter with this code already exists.',
      });
    }
    return res.status(400).json({
      success: false,
      message: `Duplicate entry for ${field}.`,
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map((val) => val.message)
      .join('. ');
    return res.status(400).json({
      success: false,
      message,
    });
  }

  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(404).json({
      success: false,
      message: 'Resource not found with specified ID.',
    });
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Internal Server Error',
  });
};

module.exports = errorHandler;
