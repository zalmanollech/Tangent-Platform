// Simple logger for blockchain service
// Can be enhanced with winston or other logging libraries

module.exports = {
    info: (message, data) => {
        console.log(`[INFO] ${message}`, data || '');
    },
    warn: (message, data) => {
        console.warn(`[WARN] ${message}`, data || '');
    },
    error: (message, data) => {
        console.error(`[ERROR] ${message}`, data || '');
    }
};
