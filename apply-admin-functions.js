const { Client } = require('pg');

const SQL = `
-- Admin function to set any user's profile total_points (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION admin_set_profile_points(
  p_user_id uuid,
  p_total_points integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles SET total_points = p_total_points, updated_at = now()
  WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    INSERT INTO profiles (id, username, display_name, total_points)
    VALUES (p_user_id, 'user_' || substr(p_user_id::text, 1, 8), 'Seed Player', p_total_points)
    ON CONFLICT (id) DO UPDATE SET total_points = p_total_points, updated_at = now();
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_set_profile_points TO authenticated;

-- Admin function to upsert prediction scores for any user (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION admin_upsert_prediction_score(
  p_user_id uuid,
  p_race_id text,
  p_points_earned integer,
  p_sprint_points_earned integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_username text;
  profile_display_name text;
BEGIN
  SELECT p.username, p.display_name
    INTO profile_username, profile_display_name
  FROM public.profiles p
  WHERE p.id = p_user_id;

  UPDATE user_predictions 
  SET points_earned = p_points_earned,
      sprint_points_earned = p_sprint_points_earned,
      updated_at = now()
  WHERE user_id = p_user_id AND race_id = p_race_id;
  
  IF NOT FOUND THEN
    -- Create a placeholder prediction row so scores are tracked
    INSERT INTO user_predictions (
      user_id, race_id, username, display_name,
      predicted_top10, predicted_fastest_lap, predicted_dnf,
      points_earned, predicted_sprint_top8, sprint_points_earned
    ) VALUES (
      p_user_id, p_race_id,
      coalesce(profile_username, 'user_' || substr(p_user_id::text, 1, 8)),
      coalesce(profile_display_name, 'Seed Player'),
      '{}', null, null,
      p_points_earned,
      '{}', p_sprint_points_earned
    )
    ON CONFLICT (user_id, race_id) DO UPDATE SET
      points_earned = excluded.points_earned,
      sprint_points_earned = excluded.sprint_points_earned,
      updated_at = now();
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_upsert_prediction_score TO authenticated;

-- Refresh ALL profile total_points by summing their user_predictions rows
CREATE OR REPLACE FUNCTION admin_refresh_all_profile_points()
RETURNS SETOF text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT user_id, COALESCE(SUM(points_earned), 0) + COALESCE(SUM(sprint_points_earned), 0) AS total
    FROM user_predictions
    GROUP BY user_id
  LOOP
    UPDATE profiles 
    SET total_points = rec.total, updated_at = now()
    WHERE id = rec.user_id;
    
    RETURN NEXT 'Updated ' || rec.user_id || ': ' || rec.total || ' points';
  END LOOP;
  
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_refresh_all_profile_points TO authenticated;
`;

const HOST = 'db.fxwgbpassouaddakgyus.supabase.co';
const DB_USER = 'postgres';
const DB_PASSWORD = 'Dkivail3025!';
const DB_NAME = 'postgres';
const DB_PORT = 5432;

async function main() {
  console.log(`Connecting to ${DB_USER}@${HOST}:${DB_PORT}/${DB_NAME}...`);
  const client = new Client({
    host: HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  
  try {
    await client.connect();
    const res = await client.query('SELECT current_user, current_database(), version()');
    console.log('Connected!', res.rows[0]);
    
    console.log('Applying admin functions...');
    await client.query(SQL);
    console.log('Admin functions created successfully!');
    
    // Verify
    const funcs = await client.query(`
      SELECT routine_name FROM information_schema.routines 
      WHERE routine_schema = 'public' AND routine_name LIKE 'admin_%'
      ORDER BY routine_name
    `);
    console.log('\nAdmin functions:', funcs.rows.map(r => r.routine_name).join(', '));
    
    await client.end();
    console.log('Done.');
  } catch(e) {
    console.error('Error:', e.message);
    if (client) await client.end();
    process.exit(1);
  }
}

main();
