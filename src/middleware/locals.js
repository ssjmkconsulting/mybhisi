function attachLocals(req, res, next) {
  res.locals.currentUser = req.session?.user || null;
  res.locals.currentPath = req.path;
  next();
}

module.exports = { attachLocals };
