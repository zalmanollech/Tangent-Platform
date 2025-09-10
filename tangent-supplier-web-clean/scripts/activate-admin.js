// Admin account activation script
const { getDatabase } = require('../lib/database');
const { passwordUtils } = require('../lib/security');

async function activateAdminAccount() {
  try {
    const db = getDatabase();
    const email = 'ollech@gmail.com';
    const password = 'admin123';
    
    // Find existing user
    let user = db.findUserByEmail(email);
    
    if (user) {
      // Update existing user to be active admin
      const passHash = await passwordUtils.hashPassword(password);
      db.update('users', user.id, {
        passHash,
        role: 'admin',
        isActive: true,
        emailVerified: true,
        lastUpdated: new Date().toISOString(),
        updatedBy: 'activation-script'
      });
      console.log('✅ Admin account updated and activated:', email);
    } else {
      // Create new admin user
      const passHash = await passwordUtils.hashPassword(password);
      const userData = {
        email: email.toLowerCase(),
        passHash,
        role: 'admin',
        kyc: {
          status: 'verified',
          files: [],
          cryptoExperience: 'expert',
          hasWallet: true
        },
        isActive: true,
        emailVerified: true,
        registrationDate: new Date().toISOString(),
        createdBy: 'activation-script'
      };
      
      user = db.createUser(userData);
      console.log('✅ Admin account created and activated:', email);
    }
    
    // Verify the account is active
    const updatedUser = db.findUserByEmail(email);
    console.log('Account status:', {
      email: updatedUser.email,
      role: updatedUser.role,
      isActive: updatedUser.isActive,
      emailVerified: updatedUser.emailVerified
    });
    
    return { success: true, user: updatedUser };
  } catch (error) {
    console.error('❌ Activation failed:', error);
    return { success: false, error: error.message };
  }
}

// Run if called directly
if (require.main === module) {
  activateAdminAccount().then(result => {
    if (result.success) {
      console.log('🎉 Admin account activation completed successfully!');
      process.exit(0);
    } else {
      console.error('💥 Admin account activation failed:', result.error);
      process.exit(1);
    }
  });
}

module.exports = { activateAdminAccount };
