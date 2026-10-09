import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

const FIRST_ROLLOVER_AT = Date.UTC(2027, 8, 1);

export async function runAnnualClassRolloverIfDue() {
  if (Date.now() < FIRST_ROLLOVER_AT) return;

  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc('run_annual_class_rollover');
    if (error) throw error;
  } catch (error) {
    console.error('Could not run annual class rollover:', error);
  }
}