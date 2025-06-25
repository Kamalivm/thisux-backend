const express = require('express');
const { check } = require('express-validator');
const auth = require('../middleware/auth');
const linkController = require('../controllers/linkController');

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
router.post(
    '/:id/click',
    auth,
    [
        check('ipAddress').optional().isString(),
        check('userAgent').optional().isString()
    ],
    async (req, res) => {
        try {
            const { id } = req.params;
            const link = await Link.findOne({ _id: id, userId: req.user._id });
            if (!link) {
                return res.status(404).json({ success: false, message: 'Link not found' });
            }
            await link.recordClick({
                ipAddress: req.body.ipAddress || req.ip,
                userAgent: req.body.userAgent || req.get('User-Agent'),
                referer: req.get('Referer') || '',
                country: req.headers['cf-ipcountry'] || '',
                city: '' // Add geo-IP service if needed
            });
            res.json({ success: true, message: 'Click recorded' });
        } catch (error) {
            console.error('Record click error:', error);
            res.status(500).json({ success: false, message: 'Failed to record click', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
        }
    }
);

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