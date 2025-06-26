const express = require('express');
const { check } = require('express-validator');
const auth = require('../middleware/auth');
const linkController = require('../controllers/linkController');
const mongoose = require('mongoose');

const router = express.Router();

router.post(
    '/',
    [
        auth,
        check('originalUrl', 'Valid URL is required').isURL(),
        check('customSlug', 'Custom slug must be 3-50 characters and contain only letters, numbers, hyphens, or underscores')
            .optional()
            .isLength({ min: 3, max: 50 })
            .matches(/^[a-zA-Z0-9-_]+$/),
        check('title', 'Title cannot exceed 200 characters').optional().isLength({ max: 200 }),
        check('description', 'Description cannot exceed 500 characters').optional().isLength({ max: 500 }),
        check('tags', 'Tags must be an array of strings').optional().isArray(),
        check('expiresAt', 'Expires at must be a valid date').optional().isISO8601()
    ],
    linkController.createLink
);

app.post('/api/links/:id/click', async (req, res) => {
    try {
        const { id } = req.params;

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid link ID' });
        }

        const link = await Link.findByIdAndUpdate(
            id,
            { $inc: { clicks: 1 } },
            { new: true }
        );

        if (!link) {
            return res.status(404).json({ error: 'Link not found' });
        }

        res.json(link);
    } catch (error) {
        console.error('Click tracking error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/', auth, linkController.getUserLinks);

router.get('/:id', auth, linkController.getLinkById);

router.put(
    '/:id',
    [
        auth,
        check('originalUrl', 'Valid URL is required').optional().isURL(),
        check('customSlug', 'Custom slug must be 3-50 characters and contain only letters, numbers, hyphens, or underscores')
            .optional()
            .isLength({ min: 3, max: 50 })
            .matches(/^[a-zA-Z0-9-_]+$/),
        check('title', 'Title cannot exceed 200 characters').optional().isLength({ max: 200 }),
        check('description', 'Description cannot exceed 500 characters').optional().isLength({ max: 500 }),
        check('tags', 'Tags must be an array of strings').optional().isArray(),
        check('expiresAt', 'Expires at must be a valid date').optional().isISO8601()
    ],
    linkController.updateLink
);

router.delete('/:id', auth, linkController.deleteLink);

router.get('/:id/analytics', auth, linkController.getLinkAnalytics);

module.exports = router;