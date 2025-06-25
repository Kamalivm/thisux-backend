const mongoose = require('mongoose');
const { nanoid } = require('nanoid');

const clickSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        default: Date.now
    },
    ipAddress: {
        type: String,
        required: true
    },
    userAgent: String,
    referer: String,
    country: String,
    city: String
});

const linkSchema = new mongoose.Schema({
    originalUrl: {
        type: String,
        required: [true, 'Original URL is required'],
        trim: true,
        validate: {
            validator: function (url) {
                // Basic URL validation
                const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
                return urlPattern.test(url);
            },
            message: 'Please enter a valid URL'
        }
    },
    shortCode: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: [4, 'Short code must be at least 4 characters long'],
        maxlength: [20, 'Short code cannot exceed 20 characters'],
        match: [/^[a-zA-Z0-9-_]+$/, 'Short code can only contain letters, numbers, hyphens, and underscores']
    },
    customSlug: {
        type: String,
        trim: true,
        sparse: true,
        unique: true,
        minlength: [3, 'Custom slug must be at least 3 characters long'],
        maxlength: [50, 'Custom slug cannot exceed 50 characters'],
        match: [/^[a-zA-Z0-9-_]+$/, 'Custom slug can only contain letters, numbers, hyphens, and underscores']
    },
    title: {
        type: String,
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters'],
        default: 'Untitled Link'
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    clicks: {
        type: Number,
        default: 0,
        min: [0, 'Clicks cannot be negative']
    },
    clickDetails: [clickSchema],
    isActive: {
        type: Boolean,
        default: true
    },
    expiresAt: {
        type: Date,
        default: null
    },
    tags: [{
        type: String,
        trim: true,
        maxlength: [30, 'Tag cannot exceed 30 characters']
    }],
    lastClickedAt: {
        type: Date
    },
    qrCode: {
        type: String
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for better query performance
linkSchema.index({ userId: 1, createdAt: -1 });
linkSchema.index({ shortCode: 1 });
linkSchema.index({ customSlug: 1 });
linkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Pre-save middleware to generate short code if not provided
linkSchema.pre('save', function (next) {
    if (!this.shortCode) {
        this.shortCode = nanoid(8);
    }

    // Ensure originalUrl has protocol
    if (this.originalUrl && !this.originalUrl.startsWith('http')) {
        this.originalUrl = 'https://' + this.originalUrl;
    }

    next();
});

// Instance method to get full short URL
linkSchema.methods.getShortUrl = function () {
    const baseUrl = process.env.BASE_URL || 'https://thisux-backend.onrender.com/';
    const code = this.customSlug || this.shortCode;
    console.log(`Generating short URL: ${baseUrl}/r/${code}`);
    return `${baseUrl}/r/${code}`;
};

// Instance method to record a click
linkSchema.methods.recordClick = async function (clickData = {}) {
    const click = {
        timestamp: new Date(),
        ipAddress: clickData.ipAddress || 'unknown',
        userAgent: clickData.userAgent || '',
        referer: clickData.referer || '',
        country: clickData.country || '',
        city: clickData.city || ''
    };

    this.clickDetails.push(click);
    this.clicks += 1;
    this.lastClickedAt = new Date();

    if (this.clickDetails.length > 1000) {
        this.clickDetails = this.clickDetails.slice(-1000);
    }

    await this.save();
    return this;
};

// Static method to find by short code or custom slug
linkSchema.statics.findByCode = function (code) {
    return this.findOne({
        $or: [
            { shortCode: code },
            { customSlug: code }
        ],
        isActive: true,
        $or: [
            { expiresAt: null },
            { expiresAt: { $gt: new Date() } }
        ]
    });
};

// Static method to get user's link analytics
linkSchema.statics.getUserAnalytics = async function (userId) {
    const result = await this.aggregate([
        { $match: { userId: mongoose.Types.ObjectId(userId) } },
        {
            $group: {
                _id: null,
                totalLinks: { $sum: 1 },
                totalClicks: { $sum: '$clicks' },
                activeLinks: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $eq: ['$isActive', true] },
                                    {
                                        $or: [
                                            { $eq: ['$expiresAt', null] },
                                            { $gt: ['$expiresAt', new Date()] }
                                        ]
                                    }
                                ]
                            },
                            1,
                            0
                        ]
                    }
                }
            }
        }
    ]);

    return result[0] || { totalLinks: 0, totalClicks: 0, activeLinks: 0 };
};

// Virtual for click analytics
linkSchema.virtual('clicksToday').get(function () {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.clickDetails.filter(click =>
        click.timestamp >= today
    ).length;
});

linkSchema.virtual('clicksThisWeek').get(function () {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    return this.clickDetails.filter(click =>
        click.timestamp >= weekAgo
    ).length;
});

// Transform JSON output
linkSchema.methods.toJSON = function () {
    const link = this.toObject({ virtuals: true });
    delete link.__v;
    delete link.clickDetails;
    return link;
};

const Link = mongoose.model('Link', linkSchema);

module.exports = Link;