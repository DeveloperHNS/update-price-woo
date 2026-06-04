const fs = require('fs');
const lines = fs.readFileSync('.env', 'utf8').split('\n');
let url = '', key = '';
for(let line of lines) {
  line = line.trim();
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim().replace(/['"]/g, '');
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].trim().replace(/['"]/g, '');
}
url = url.trim();
key = key.trim();
console.log('URL:', url);
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);
async function run() {
  const { error: error1 } = await supabase.from('profiles').update({ role: 'product_staff', pic_category: null }).eq('email', 'abengkumla99@gmail.com');
  console.log('UPDATE 1 ERROR:', error1);
  const { error: error2 } = await supabase.from('profiles').update({ pic_category: 'komponen,aksesoris' }).eq('email', 'abengkumla99@gmail.com');
  console.log('UPDATE 2 ERROR:', error2);
}
run();
