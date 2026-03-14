import { createClient } from '@supabase/supabase-js';

const SUPA_URL = 'https://qzfedqpbjuowtudmdmrf.supabase.co';
const SUPA_KEY = 'sb_publishable_2nsP3-KPrHGIbzLh786gTQ_YoAWv7Mc';

export const sb = createClient(SUPA_URL, SUPA_KEY);
