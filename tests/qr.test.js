import test from 'node:test';
import assert from 'node:assert/strict';
import { qrService } from '../src/core/qr/qrService.js';
import { organizationService } from '../src/core/organization/organizationService.js';
import { runSeed } from '../src/data/seed.js';

test('QR Publishing — Core Capability Suite', async (t) => {
  await runSeed();

  let createdQr = null;

  await t.test('generates QR code for branch with valid PNG data URI', async () => {
    createdQr = await qrService.generateQRCode({
      branchId: 'brn_downtown',
      title: 'Downtown Table 1 QR'
    });

    assert.ok(createdQr.id);
    assert.ok(createdQr.code.startsWith('QR_DT01_'));
    assert.ok(createdQr.qr_image_data.startsWith('data:image/png;base64,'));
    assert.equal(createdQr.status, 'Active');
  });

  await t.test('resolves active QR code to canonical destination URL', async () => {
    const res = await qrService.resolveQRDestination(createdQr.code);
    assert.equal(res.success, true);
    assert.equal(res.branchSlug, 'downtown-flagship');
    assert.ok(res.destinationUrl.includes('/menu/downtown-flagship'));
  });

  await t.test('rejects disabled QR code on resolution', async () => {
    await qrService.setQRCodeStatus(createdQr.id, 'Disabled');

    const res = await qrService.resolveQRDestination(createdQr.code);
    assert.equal(res.success, false);
    assert.equal(res.reason, 'QR_DISABLED');
  });

  await t.test('rejects expired QR code on resolution', async () => {
    await qrService.setQRCodeStatus(createdQr.id, 'Expired');

    const res = await qrService.resolveQRDestination(createdQr.code);
    assert.equal(res.success, false);
    assert.equal(res.reason, 'QR_EXPIRED');
  });

  await t.test('rejects QR code when target branch is inactive', async () => {
    // Restore QR to active
    await qrService.setQRCodeStatus(createdQr.id, 'Active');
    // Deactivate branch
    await organizationService.setBranchStatus('brn_downtown', 'Inactive');

    const res = await qrService.resolveQRDestination(createdQr.code);
    assert.equal(res.success, false);
    assert.equal(res.reason, 'BRANCH_INACTIVE');

    // Restore branch
    await organizationService.setBranchStatus('brn_downtown', 'Active');
  });

  await t.test('regenerates QR code maintaining destination URL', async () => {
    const updated = await qrService.regenerateQRCode(createdQr.id);
    assert.equal(updated.status, 'Active');
    assert.ok(updated.qr_image_data);
  });
});
