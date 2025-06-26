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
            // Check if user is authenticated
            if (!req.user) {
                return res.status(401).json({ success: false, message: 'Unauthorized: User not authenticated' });
            }
            // Validate ObjectId
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({ success: false, message: 'Invalid link ID' });
            }
            console.log(`Attempting to find link with ID: ${id}, userId: ${req.user._id}`);
            const link = await Link.findOne({ _id: id, userId: req.user._id });
            if (!link) {
                return res.status(404).json({ success: false, message: 'Link not found or you do not have access' });
            }
            console.log(`Recording click for link: ${id}`);
            await link.recordClick({
                ipAddress: req.body.ipAddress || req.ip || 'unknown',
                userAgent: req.body.userAgent || req.get('User-Agent') || 'unknown',
                referer: req.get('Referer') || '',
                country: req.headers['cf-ipcountry'] || '',
                city: ''
            });
            console.log(`Click recorded successfully for link: ${id}`);
            res.json({ success: true, message: 'Click recorded', data: { link } });
        } catch (error) {
            console.error('Record click error:', {
                message: error.message,
                stack: error.stack,
                linkId: id,
                userId: req.user?._id,
                requestBody: req.body,
                headers: req.headers
            });
            res.status(500).json({
                success: false,
                message: 'Failed to record click',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
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