import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function clearGrants() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  console.log('Clearing all grants from database...');
  
  const { error } = await supabase
    .from('grants')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (error) {
    console.error('Error clearing grants:', error);
  } else {
    console.log('All grants cleared successfully!');
  }
}

clearGrants();
