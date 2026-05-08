const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkCustomFields() {
    const { data, error } = await supabase
        .from('client_custom_fields')
        .select('*')
        .limit(5);
    
    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log('Custom fields:', data);
    }
}

checkCustomFields();
