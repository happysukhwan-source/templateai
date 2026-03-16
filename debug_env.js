const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

console.log('--- [Debug: .env.local Content] ---');
try {
    const rawContent = fs.readFileSync('.env.local', 'utf8');
    console.log('Raw File Length:', rawContent.length);
    console.log('Raw Content (First 100 chars):', rawContent.substring(0, 100));
    
    // Check for specific keys in raw string
    console.log('Contains ANTHROPIC_API_KEY?:', rawContent.includes('ANTHROPIC_API_KEY'));
    console.log('Contains SUPABASE_SERVICE_ROLE_KEY?:', rawContent.includes('SUPABASE_SERVICE_ROLE_KEY'));
    
    // Check process.env
    console.log('process.env.ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? 'EXISTS (length: ' + process.env.ANTHROPIC_API_KEY.length + ')' : 'MISSING');
} catch (e) {
    console.error('Error reading file:', e);
}
console.log('--- [Debug Finished] ---');
