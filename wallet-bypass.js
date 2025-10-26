// Quick bypass - paste this in your browser console (F12)
function bypassWalletConnection() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const token = localStorage.getItem('token');
    
    if (user && token) {
        console.log('✅ Bypassing wallet connection, redirecting to dashboard...');
        window.location.href = '/dashboard/authenticated?role=' + user.role + '&token=' + encodeURIComponent(token);
    } else {
        alert('Please login first');
    }
}

// Call the function
bypassWalletConnection();

