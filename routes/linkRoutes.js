const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Link = require('../models/Link'); // Adjust path as needed
const auth = require('../middleware/auth'); // Adjust path as needed

// Get all links for a user
router.get('/', auth, async (req, res) => {
    try {
        const links = await Link.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.json({
            success: true,
            data: { links }
        });
    } catch (error) {
        console.error('Error fetching links:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch links'
        });
    }
});

// Record click (this is line 26 where the error occurs)
router.post('/:id/click', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { ipAddress, userAgent } = req.body;
        
        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid link ID'
            });
        }
        
        // Find and update the link
        const link = await Link.findOneAndUpdate(
            { _id: id, user: req.user.id }, // Ensure user owns the link
            { 
                $inc: { clicks: 1 },
                $push: {
                    clickHistory: {
                        timestamp: new Date(),
                        ipAddress: ipAddress || 'unknown',
                        userAgent: userAgent || 'unknown'
                    }
                }
            },
            { new: true }
        );
        
        if (!link) {
            return res.status(404).json({
                success: false,
                message: 'Link not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Click recorded successfully',
            data: { link }
        });
    } catch (error) {
        console.error('Click tracking error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to record click'
        });
    }
});

// Get single link
router.get('/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid link ID'
            });
        }
        
        const link = await Link.findOne({ _id: id, user: req.user.id });
        
        if (!link) {
            return res.status(404).json({
                success: false,
                message: 'Link not found'
            });
        }
        
        res.json({
            success: true,
            data: { link }
        });
    } catch (error) {
        console.error('Error fetching link:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch link'
        });
    }
});

// Create new link
router.post('/', auth, async (req, res) => {
    try {
        const { originalUrl, title, description } = req.body;
        
        const link = new Link({
            originalUrl,
            title,
            description,
            user: req.user.id,
            clicks: 0,
            clickHistory: []
        });
        
        await link.save();
        
        res.status(201).json({
            success: true,
            message: 'Link created successfully',
            data: { link }
        });
    } catch (error) {
        console.error('Error creating link:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create link'
        });
    }
});

// Update link
router.put('/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description } = req.body;
        
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid link ID'
            });
        }
        
        const link = await Link.findOneAndUpdate(
            { _id: id, user: req.user.id },
            { title, description },
            { new: true }
        );
        
        if (!link) {
            return res.status(404).json({
                success: false,
                message: 'Link not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Link updated successfully',
            data: { link }
        });
    } catch (error) {
        console.error('Error updating link:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update link'
        });
    }
});

// Delete link
router.delete('/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid link ID'
            });
        }
        
        const link = await Link.findOneAndDelete({ _id: id, user: req.user.id });
        
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
        console.error('Error deleting link:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete link'
        });
    }
});

module.exports = router;