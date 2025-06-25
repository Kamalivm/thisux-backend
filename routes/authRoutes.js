const express = require('express');
   const { check } = require('express-validator');
   const authController = require('../controllers/authController');
   const auth = require('../middleware/auth');

   const router = express.Router();

   router.post(
     '/register',
     [
       check('name', 'Name is required').notEmpty().isLength({ min: 2, max: 50 }),
       check('email', 'Please include a valid email').isEmail(),
       check('password', 'Password must be at least 6 characters').isLength({ min: 6 })
     ],
     authController.register
   );

   router.post(
     '/login',
     [
       check('email', 'Please include a valid email').isEmail(),
       check('password', 'Password is required').notEmpty()
     ],
     authController.login
   );

   router.get('/profile', auth, authController.getProfile);

   router.put(
     '/profile',
     [
       auth,
       check('name', 'Name is required').notEmpty().isLength({ min: 2, max: 50 })
     ],
     authController.updateProfile
   );

   router.put(
     '/password',
     [
       auth,
       check('currentPassword', 'Current password is required').notEmpty(),
       check('newPassword', 'New password must be at least 6 characters').isLength({ min: 6 })
     ],
     authController.changePassword
   );

   router.get('/verify', auth, authController.verifyToken);

   module.exports = router;