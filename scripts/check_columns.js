const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkColumns() {
    const { data, error } = await supabase
        .from('clients')
        .select('letter_created_at, letter_expires_at')
        .limit(1);
    
    if (error) {
        console.log('Columns likely do not exist:', error.message);
    } else {
        console.log('Columns exist!');
    }
}

checkColumns();
