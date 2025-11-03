// Storage Service for Traidefi
// Handles PDF uploads to Supabase Storage or AWS S3

const axios = require('axios');
const FormData = require('form-data');

const STORAGE_TYPE = process.env.STORAGE_TYPE || 'supabase';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'traidefi-reports';

/**
 * Upload file to Supabase Storage
 */
async function uploadToSupabaseStorage(fileContent, fileName, contentType = 'text/html') {
    try {
        if (!SUPABASE_URL || !SUPABASE_KEY) {
            console.warn('[WARN] Supabase Storage not configured. Skipping upload.');
            return null;
        }
        
        console.log('[INFO] Uploading to Supabase Storage:', fileName);
        
        // Create form data
        const formData = new FormData();
        formData.append('file', Buffer.from(fileContent), {
            filename: fileName,
            contentType: contentType
        });
        
        // Upload to Supabase Storage
        const response = await axios.post(
            `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${fileName}`,
            formData,
            {
                headers: {
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    ...formData.getHeaders()
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            }
        );
        
        // Get public URL
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${fileName}`;
        console.log('[INFO] File uploaded successfully:', publicUrl);
        
        return publicUrl;
        
    } catch (error) {
        console.error('[ERROR] Supabase Storage upload error:', error.message);
        if (error.response) {
            console.error('[ERROR] Response:', error.response.data);
        }
        throw error;
    }
}

/**
 * Upload file to storage (supports Supabase or S3)
 */
async function uploadFile(fileContent, fileName, contentType = 'text/html') {
    try {
        if (STORAGE_TYPE === 'supabase') {
            return await uploadToSupabaseStorage(fileContent, fileName, contentType);
        } else if (STORAGE_TYPE === 's3') {
            // TODO: Implement S3 upload if needed
            console.warn('[WARN] S3 storage not yet implemented');
            return null;
        } else {
            console.warn('[WARN] Unknown storage type:', STORAGE_TYPE);
            return null;
        }
    } catch (error) {
        console.error('[ERROR] File upload error:', error.message);
        return null; // Don't fail report generation if upload fails
    }
}

/**
 * Get signed URL for private files (if needed)
 */
async function getSignedUrl(fileName, expiresIn = 3600) {
    try {
        if (STORAGE_TYPE === 'supabase' && SUPABASE_URL && SUPABASE_KEY) {
            // Supabase signed URLs (if bucket is private)
            const response = await axios.post(
                `${SUPABASE_URL}/storage/v1/object/sign/${SUPABASE_BUCKET}/${fileName}`,
                { expiresIn },
                {
                    headers: {
                        'Authorization': `Bearer ${SUPABASE_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            if (response.data.signedURL) {
                return `${SUPABASE_URL}${response.data.signedURL}`;
            }
        }
        
        return null;
    } catch (error) {
        console.error('[ERROR] Failed to get signed URL:', error.message);
        return null;
    }
}

module.exports = {
    uploadFile,
    getSignedUrl
};

