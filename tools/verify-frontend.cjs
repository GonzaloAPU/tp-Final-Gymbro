/** Ejecuta las verificaciones de la interfaz desde cualquier workspace, sin API ni base real. */
const {spawnSync} = require('node:child_process');
const {resolve} = require('node:path');
const root = resolve(__dirname, '..');
const checks = [
  'verify-mobile.cjs',
  'verify-profile-photo.cjs',
  'verify-profile-flow.cjs',
  'verify-routine-builder.cjs',
  'verify-schedule-form.cjs',
  'verify-workout.cjs',
  'verify-workout-navigation.cjs',
  'verify-workout-recovery.cjs',
  'verify-alarms.cjs',
  'frontend-boundaries.test.cjs',
  'frontend-forms.test.cjs',
  'frontend-password-recovery.test.cjs',
  'frontend-photo-errors.test.cjs',
  'frontend-profile-photo.test.cjs',
  'frontend-welcome.test.cjs',
  'frontend-legal.test.cjs',
  'frontend-navigation-cache.test.cjs',
  'frontend-local-persistence.test.cjs',
  'frontend-session-isolation.test.cjs',
];
for (const check of checks) {
  const args = check.endsWith('.test.cjs') ? ['--test', resolve(__dirname, check)] : [resolve(__dirname, check)];
  const result = spawnSync(process.execPath, args, {cwd: root, stdio: 'inherit'});
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
