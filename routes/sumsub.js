const express = require('express');
const router = express.Router();
const { generateAccessToken } = require('../integrations/sumsub');

// Sumsub token endpoint - requires authentication
// Stores applicantId and sets kyc_status to 'pending' on first use
router.get('/token', async (req, res) => {
  try {
    // Require authentication
    if (!req.user || !req.user.id || !req.user.email) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userId = req.user.id;
    const userEmail = req.user.email;
    
    // Access database from req (passed via middleware)
    const database = req.database;
    if (!database || !database.users) {
      return res.status(500).json({ error: 'Database not available' });
    }
    
    const user = database.users.get(userEmail);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Use existing applicantId if available, otherwise use userId
    // Sumsub will create the applicant on first token request
    const applicantId = user.sumsub_applicant_id || userId;
    
    // Generate access token from Sumsub
    const data = await generateAccessToken(applicantId);
    
    // Store applicantId from Sumsub response (if provided) and update kyc_status if this is the first time
    if (!user.sumsub_applicant_id) {
      // Sumsub returns applicantId in the response, use it if available
      user.sumsub_applicant_id = data.applicantId || applicantId;
      user.kyc_status = 'pending';
      // Also update legacy field for backward compatibility
      if (!user.kycStatus || user.kycStatus === 'not_started') {
        user.kycStatus = 'pending';
      }
      
      // Save to database
      if (req.saveDatabase) {
        req.saveDatabase();
      }
    }

    return res.json({ token: data.token });
  } catch (err) {
    console.error('Sumsub token error:', err);
    return res.status(500).json({ error: 'Failed to generate Sumsub token' });
  }
});

module.exports = router;

