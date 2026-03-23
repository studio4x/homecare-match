import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rkjvtnadqkbwomgzyswr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJranZ0bmFkcWtid29tZ3p5c3dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNjI3NTAsImV4cCI6MjA4NTYzODc1MH0.Xc1l3rYeR3zs-9ZRsAtvYDrhnXHvyydf6VmpCoLNeFI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
  console.log('Testing general public coupons query...');
  const { data, error } = await supabase
    .from('coupons')
    .select('id, code, show_publicly, is_active, eligible_audience')
    .eq('show_publicly', true)
    .eq('is_active', true);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Data:', JSON.stringify(data, null, 2));
  }
}

testQuery();
