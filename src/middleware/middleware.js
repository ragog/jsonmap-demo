const User = require('../model/user.js');
const crypto = require('crypto');
const getHashFromRequest = require('../helper/helper.js');
const { trace, context } = require('@opentelemetry/api'); // Import trace and context from OpenTelemetry

const authMiddleware = async function (req, res, next) {
	console.log(`Request received: ${req.method} ${req.url}`);

	if (req.url.includes('/users')) {
		next();
		return;
	}

	const authHeader = req.headers.authorization;

	if (!authHeader) {
		console.log('Received request with missing Authorization header - ignoring');
		res.status(401).send('Missing Authorization header');
		return;
	}

	if (authHeader.startsWith('Bearer ')) {
		const hashedToken = getHashFromRequest(req);

    // mocking error
		if (req.path.includes('/item/')) {
			try {
				// const items = await User.find();
				// res.json(items);
        throw new Error('Some Error!')
			} catch (error) {
				const currentSpan = trace.getSpan(context.active());
				if (currentSpan) {
					currentSpan.recordException(error);
					currentSpan.setStatus({ code: 2, message: 'MongoDB failure' });
				}
			}
		}

		User.find({ apikey: hashedToken }).countDocuments((error, count) => {
			if (count === 0) {
				console.log('Received request with unknown API key - ignoring');
				res.status(401).send('Unknown API key');
			} else {
				next();
			}
		});
	} else {
		res.status(401).send('Unknown format - should be Bearer <API_KEY>');
	}
};

module.exports = authMiddleware;
