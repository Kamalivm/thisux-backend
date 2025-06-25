const Link = require('../models/Link');
const { validationResult } = require('express-validator');
const { nanoid } = require('nanoid');

const linkController = {
    // Create a new short link
    createLink: async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { originalUrl, customSlug, title, description, tags, expiresAt } = req.body;
            const userId = req.user._id;

            // Log incoming data for debugging
            console.log('Creating link with data:', { originalUrl, customSlug, title, description, tags, expiresAt, userId });

            // Check for existing customSlug
            if (customSlug) {
                const existingLink = await Link.findOne({
                    $or: [{ customSlug }, { shortCode: customSlug }]
                });
                if (existingLink) {
                    return res.status(409).json({
                        success: false,
                        message: 'Custom slug is already taken'
                    });
                }
            }

            let shortCode = customSlug || nanoid(10); // Use 10 characters for lower collision chance
            let isUnique = false;
            let attempts = 0;
            const maxAttempts = 10; // Increased attempts for reliability

            while (!isUnique && attempts < maxAttempts) {
                const existing = await Link.findOne({ shortCode }).lean(); // Use lean() for performance
                if (!existing) isUnique = true;
                else shortCode = nanoid(10); // Regenerate on collision
                attempts++;
            }

            if (!isUnique) {
                console.error('Failed to generate unique shortCode after', maxAttempts, 'attempts');
                return res.status(500).json({
                    success: false,
                    message: 'Unable to generate a unique short code after multiple attempts. Please try again later.'
                });
            }

            // Create new link instance
            const link = new Link({
                originalUrl: originalUrl.trim(),
                shortCode,
                customSlug: customSlug?.trim() || undefined,
                title: title?.trim() || 'Untitled Link',
                description: description?.trim() || undefined,
                userId,
                tags: Array.isArray(tags) ? tags.map(t => t.trim()).filter(t => t) : [],
                expiresAt: expiresAt ? new Date(expiresAt) : undefined
            });

            // Save with error handling
            const savedLink = await link.save({ writeConcern: { w: 'majority' } })
                .catch(err => {
                    console.error('Save error:', err);
                    throw err;
                });

            res.status(201).json({
                success: true,
                message: 'Short link created successfully',
                data: {
                    link: {
                        ...savedLink.toJSON(),
                        shortUrl: savedLink.getShortUrl()
                    }
                }
            });
        } catch (error) {
            console.error('Create link error:', error);
            let message = 'Failed to create short link';
            if (error.name === 'MongoError' && error.code === 11000) {
                message = 'Duplicate key error. Please try a different custom slug.';
            } else if (error.name === 'ValidationError') {
                message = 'Validation failed: ' + Object.values(error.errors).map(e => e.message).join(', ');
            }
            res.status(500).json({
                success: false,
                message: message,
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    getUserLinks: async (req, res) => {
        try {
            const userId = req.user._id;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const search = req.query.search;
            const sortBy = req.query.sortBy || 'createdAt';
            const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

            const query = { userId };

            if (search) {
                query.$or = [
                    { title: { $regex: search, $options: 'i' } },
                    { originalUrl: { $regex: search, $options: 'i' } },
                    { customSlug: { $regex: search, $options: 'i' } },
                    { shortCode: { $regex: search, $options: 'i' } }
                ];
            }

            const links = await Link.find(query)
                .sort({ [sortBy]: sortOrder })
                .limit(limit * 1)
                .skip((page - 1) * limit)
                .lean();

            const total = await Link.countDocuments(query);

            const linksWithUrls = links.map(link => ({
                ...link,
                shortUrl: `${process.env.BASE_URL || 'http://localhost:5000'}/r/${link.customSlug || link.shortCode}`
            }));

            res.json({
                success: true,
                data: {
                    links: linksWithUrls,
                    pagination: {
                        current: page,
                        total: Math.ceil(total / limit),
                        count: links.length,
                        totalCount: total
                    }
                }
            });
        } catch (error) {
            console.error('Get user links error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch links',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    getLinkById: async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user._id;

            const link = await Link.findOne({ _id: id, userId });

            if (!link) {
                return res.status(404).json({
                    success: false,
                    message: 'Link not found'
                });
            }

            res.json({
                success: true,
                data: {
                    link: {
                        ...link.toJSON(),
                        shortUrl: link.getShortUrl()
                    }
                }
            });
        } catch (error) {
            console.error('Get link by ID error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch link',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    updateLink: async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { id } = req.params;
            const userId = req.user._id;
            const { originalUrl, customSlug, title, description, tags, expiresAt } = req.body;

            if (customSlug) {
                const existingLink = await Link.findOne({
                    $or: [
                        { customSlug },
                        { shortCode: customSlug }
                    ],
                    _id: { $ne: id }
                });

                if (existingLink) {
                    return res.status(409).json({
                        success: false,
                        message: 'Custom slug is already taken'
                    });
                }
            }

            const link = await Link.findOne({ _id: id, userId });

            if (!link) {
                return res.status(404).json({
                    success: false,
                    message: 'Link not found'
                });
            }

            link.originalUrl = originalUrl?.trim() || link.originalUrl;
            link.customSlug = customSlug?.trim() || link.customSlug;
            link.title = title?.trim() || link.title;
            link.description = description?.trim() || link.description;
            link.tags = tags || link.tags;
            link.expiresAt = expiresAt ? new Date(expiresAt) : link.expiresAt;

            await link.save();

            res.json({
                success: true,
                message: 'Link updated successfully',
                data: {
                    link: {
                        ...link.toJSON(),
                        shortUrl: link.getShortUrl()
                    }
                }
            });
        } catch (error) {
            console.error('Update link error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update link',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    deleteLink: async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user._id;

            const link = await Link.findOneAndDelete({ _id: id, userId });

            if (!link) {
                return res.status(404).json({
                    success: false,
                    message: 'Link not found'
                });
            }

            res.json({
                success: true,
                message: 'Link deleted successfully'
            });
        } catch (error) {
            console.error('Delete link error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete link',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    getLinkAnalytics: async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user._id;

            const link = await Link.findOne({ _id: id, userId });

            if (!link) {
                return res.status(404).json({
                    success: false,
                    message: 'Link not found'
                });
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);

            const analytics = {
                totalClicks: link.clicks,
                clicksToday: link.clicksToday,
                clicksThisWeek: link.clicksThisWeek,
                clickDetails: link.clickDetails.map(click => ({
                    timestamp: click.timestamp,
                    ipAddress: click.ipAddress,
                    userAgent: click.userAgent,
                    referer: click.referer,
                    country: click.country,
                    city: click.city
                }))
            };

            res.json({
                success: true,
                data: {
                    link: {
                        ...link.toJSON(),
                        shortUrl: link.getShortUrl(),
                        analytics
                    }
                }
            });
        } catch (error) {
            console.error('Get link analytics error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch link analytics',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
};

module.exports = linkController;