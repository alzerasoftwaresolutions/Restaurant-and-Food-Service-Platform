import test from 'node:test';
import assert from 'node:assert/strict';
import { identityService } from '../src/platform/identity/identityService.js';
import { runSeed } from '../src/data/seed.js';

test('Identity & Access — Platform Service Suite', async (t) => {
  await runSeed();

  await t.test('authenticates valid admin credentials', async () => {
    const result = await identityService.authenticate('admin', 'AdminPass123!');
    assert.ok(result.token, 'Should return a JWT token');
    assert.equal(result.user.username, 'admin');
    assert.ok(result.user.roles.includes('admin'), 'User should have admin role');
  });

  await t.test('rejects invalid password', async () => {
    await assert.rejects(
      async () => {
        await identityService.authenticate('admin', 'WrongPassword!');
      },
      { message: 'Invalid credentials' }
    );
  });

  await t.test('verifies valid JWT token', async () => {
    const auth = await identityService.authenticate('admin', 'AdminPass123!');
    const decoded = await identityService.verifyToken(auth.token);
    assert.equal(decoded.username, 'admin');
  });

  await t.test('changes user password and allows login with new password', async () => {
    const unique = Date.now();
    const user = await identityService.createUser({
      username: `temp_user_${unique}`,
      email: `temp_${unique}@rfsp.local`,
      password: 'OldPassword123!',
      fullName: 'Temp User'
    });

    assert.ok(user.id);

    // Change password
    await identityService.changePassword(user.id, 'OldPassword123!', 'NewSecretPassword123!');

    // Old password should fail
    await assert.rejects(
      async () => {
        await identityService.authenticate(`temp_user_${unique}`, 'OldPassword123!');
      },
      { message: 'Invalid credentials' }
    );

    // New password should succeed
    const newAuth = await identityService.authenticate(`temp_user_${unique}`, 'NewSecretPassword123!');
    assert.ok(newAuth.token);
  });
});
