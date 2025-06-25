const express = require('express');
const Link = require('../models/Link');

const router = express.Router();

// Redirect to original URL
router.get('/:code', async (req, res) => {
  try {
    const link = await Link.findByCode(req.params.code);

    if (!link) {
      return res.status(404).json({
        success: false,
        message: 'Link not found or has expired'
      });
    }

    // Record click
    await link.recordClick({
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer'),
      country: req.headers['cf-ipcountry'] || '', // Assuming Cloudflare or similar for geo data
      city: '' // Would need a geo-IP service for accurate city data
    });

    // Redirect to original URL
    res.redirect(301, link.originalUrl);
  } catch (error) {
    console.error('Redirect error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to redirect',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;