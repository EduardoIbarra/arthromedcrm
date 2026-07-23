const { Client } = require('pg');

const dev1 = 'postgresql://postgres:B9124853d8.90@db.zdvkatyzqgbeewtbuyfu.supabase.co:5432/postgres';
const dev2 = 'postgresql://postgres:Rapido221196.@db.ibcevxzxfzszrmejekqd.supabase.co:5432/postgres';

async function updateSuperAdmin(url, dbName) {
  const client = new Client({ connectionString: url });
  await client.connect();
  console.log(`=== Updating ${dbName} ===`);

  const superAdminRoleId = 'b3f4f408-699d-4e1d-bd82-1df492c08855';
  const targetEmail = 'eduardo.delacruz@arthromed.com.mx';
  const userId = '5268a36c-dff6-4330-a312-401dbce422e1';

  // 1. Check if auth.users row exists
  const existingUser = await client.query(`SELECT * FROM auth.users WHERE id = $1 OR email = $2 OR email = 'eduardo@arthromed.com.mx'`, [userId, targetEmail]);

  if (existingUser.rows.length > 0) {
    await client.query(`
      UPDATE auth.users
      SET email = $1,
          is_super_admin = true,
          updated_at = NOW()
      WHERE id = $2 OR email = $1 OR email = 'eduardo@arthromed.com.mx';
    `, [targetEmail, userId]);
  } else {
    await client.query(`
      INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, is_sso_user, is_anonymous)
      VALUES (
        $1,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        $2,
        '$2a$06$/XWp1SsUkiaXRkPH45tEzulnnBrPQjeNVMem5vKse4TfV7xcoAUqu',
        NOW(),
        '{"provider": "google", "providers": ["google"]}'::jsonb,
        '{"name": "Eduardo De la Cruz", "email": "eduardo.delacruz@arthromed.com.mx", "full_name": "Eduardo De la Cruz"}'::jsonb,
        true,
        NOW(),
        NOW(),
        false,
        false
      );
    `, [userId, targetEmail]);
  }

  // 2. Upsert public.user_profiles with full superadmin privileges
  await client.query(`
    INSERT INTO public.user_profiles (id, email, role, role_id, permissions, permission_overrides, first_name, last_name, position, updated_at)
    VALUES (
      $1,
      $2,
      'superadmin',
      $3,
      '{"*": ["*"]}'::jsonb,
      '{"*": ["*"]}'::jsonb,
      'Eduardo',
      'de la Cruz',
      'Arquitecto de Transformación Digital e IA',
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      role = 'superadmin',
      role_id = EXCLUDED.role_id,
      permissions = '{"*": ["*"]}'::jsonb,
      permission_overrides = '{"*": ["*"]}'::jsonb,
      updated_at = NOW();
  `, [userId, targetEmail, superAdminRoleId]);

  // Verification
  const verifyAuth = await client.query(`SELECT id, email, is_super_admin, role FROM auth.users WHERE email ILIKE '%eduardo%'`);
  const verifyProfile = await client.query(`SELECT id, email, role, role_id, permissions, permission_overrides FROM public.user_profiles WHERE email ILIKE '%eduardo%'`);
  
  console.log('Updated auth.users:', verifyAuth.rows);
  console.log('Updated user_profiles:', verifyProfile.rows);

  await client.end();
}

async function run() {
  await updateSuperAdmin(dev1, 'Dev DB 1 (zdvkatyzqgbeewtbuyfu)');
  await updateSuperAdmin(dev2, 'Dev DB 2 (ibcevxzxfzszrmejekqd)');
}

run().catch(console.error);
