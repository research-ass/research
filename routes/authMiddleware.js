const jwt = require('jsonwebtoken');
function auth(req, res, next) {
    // Get the token from the request header
    const token = req.header('Authorization');

    // Check if token exists
    if (!token) {
        return res.status(401).json({ msg: 'No token, authorization denied.' });
    }

    try {
        // Verify the token
        const decoded = jwt.verify(token, 'your_jwt_secret');

        // Add the decoded user payload to the request object
        req.user = decoded.user;

        // Proceed to the next middleware or route handler
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Token is not valid.' });
    }
}

module.exports = auth;

