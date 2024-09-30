const express = require('express');
const Item = require('../model/item.js');
const User = require('../model/user.js');
const router = new express.Router();
const preExec = require('../middleware/middleware.js');
const uuid = require('uuid');
const getHashFromRequest = require('../helper/helper.js');
const { trace, context } = require('@opentelemetry/api');  // Import trace and context from OpenTelemetry

router.use(preExec);

router.get('/v1/items', async (req, res) => {
	const hashedToken = getHashFromRequest(req);

	const ownerUser = await User.findOne({ apikey: hashedToken });

	const items = await Item.find({ owner: ownerUser.id });
	const formatItems = items.map((x) => ({ key: x.key, value: x.value }));

	res.send(formatItems);
});

router.put('/v1/item/:key', async (req, res) => {
	
	try {
		const hashedToken = getHashFromRequest(res);
		// Get the current active span
		const currentSpan = trace.getSpan(context.active());
		if (currentSpan) {
		  currentSpan.recordException(error);
		  currentSpan.setStatus({ code: 2, message: 'MongoDB failure' }); // Code 2 represents an error in OpenTelemetry.
		}
		const ownerUser = await User.findOne({ apikey: hashedToken });
	} catch {}
	
	res.status(500).send();
});

router.put('/v1/items/:key', async (req, res) => {
	if (!req.params.key) {
		res.status(400).send('Bad request: item key must be defined');
	}

	const hashedToken = getHashFromRequest(req);

	const ownerUser = await User.findOne({ apikey: hashedToken });

	const existingItemWithKey = await Item.findOne({ key: req.params.key, owner: ownerUser.id });
	if (existingItemWithKey) {
		await Item.deleteOne({ key: req.params.key });
	}

	try {
		await new Item({
			id: uuid.v4(),
			key: req.params.key,
			value: req.body,
			owner: ownerUser.id,
		}).save();
	} catch (error) {
		res.status(400).send('Bad request: ' + error);
		return;
	}

	res.send(req.params.key);
});

router.get('/v1/items/:key', async (req, res) => {
	if (!req.params.key) {
		res.status(400).send('Bad request');
		return;
	}

	const hashedToken = getHashFromRequest(req);

	const ownerUser = await User.findOne({ apikey: hashedToken });

	const item = await Item.findOne({ key: req.params.key, owner: ownerUser.id });
	if (!item) {
		res.status(404).send('No such item found');
		return;
	}

	res.send(item.value);
	
});

router.delete('/v1/items/:key', async (req, res) => {
	if (!req.params.key) {
		res.status(400).send('Bad request');
		return;
	}

	const hashedToken = getHashFromRequest(req);

	const ownerUser = await User.findOne({ apikey: hashedToken });

	const item = await Item.findOne({ key: req.params.key });
	if (item?.owner === ownerUser?.id) {
		await Item.deleteOne({ key: req.params.key });
		res.status(204).send();
		return;
	}

	res.status(404).send('No such item found');
});

module.exports = router;
