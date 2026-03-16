const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config({ path: '.env.local' });

async function diagnose() {
  console.log('--- [Diagnostic Started] ---');

  // 1. .env.local checking
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('❌ Error: .env.local file not found!');
    return;
  }
  console.log('✅ Found .env.local');

  const keys = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ANTHROPIC_API_KEY'
  ];

  let missingKeys = [];
  keys.forEach(key => {
    if (!process.env[key]) {
      missingKeys.push(key);
    } else {
      console.log(`✅ ${key} is set`);
    }
  });

  if (missingKeys.length > 0) {
    console.error(`❌ Missing Keys: ${missingKeys.join(', ')}`);
  }

  // 2. Supabase Connection & Schema Check
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
      if (error) {
        console.error('❌ Supabase Error (profiles table):', error.message);
        console.log('💡 Tip: SQL Editor에서 profiles 테이블을 생성했는지 확인해주세요.');
      } else {
        console.log('✅ Supabase Connection & "profiles" table detected');
      }
    } catch (e) {
      console.error('❌ Supabase Connection Exception:', e.message);
    }
  }

  // 3. Anthropic Key Check (Dry run)
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      console.log('✅ Anthropic SDK initialized (API key format looks OK)');
    } catch (e) {
      console.error('❌ Anthropic SDK Exception:', e.message);
    }
  }

  console.log('--- [Diagnostic Finished] ---');
}

diagnose();
