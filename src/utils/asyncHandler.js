const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => next(err));
  };
};

/*

--> Ways to handle Error 

const asyncHandler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (error) {
    return res.status(error.code || 500).json({
      status: "failed",
      msg: error.message,
    });
  }
};

*/

module.exports = { asyncHandler };
