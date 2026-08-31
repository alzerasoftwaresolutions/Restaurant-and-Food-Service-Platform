import test from 'node:test';
import assert from 'node:assert/strict';
import { auditService } from '../src/platform/audit/auditService.js';
import { runSeed } from '../src/data/seed.js';

test('Audit Logging — Platform Service Suite', async (t) => {
  await runSeed();

  await t.test('creates structured audit log record with actor and target', async () => {
    const entry = await auditService.logAction({
      actorUserId: 'usr_admin',
      actorUsername: 'admin',
      action: 'MENU_ITEM_PRICE_UPDATE',
      targetType: 'MENU_ITEM',
      targetId: 'item_ribeye',
      details: { oldPrice: 45.0, newPrice: 48.0 },
      result: 'SUCCESS',
      ipAddress: '192.168.1.50'
    });

    assert.ok(entry.id);
    assert.equal(entry.actor_username, 'admin');
    assert.equal(entry.action, 'MENU_ITEM_PRICE_UPDATE');
    assert.equal(entry.target_type, 'MENU_ITEM');
    assert.equal(entry.target_id, 'item_ribeye');
    assert.equal(entry.result, 'SUCCESS');
  });

  await t.test('lists and filters audit logs by target type', async () => {
    const logs = await auditService.listAuditLogs({ targetType: 'MENU_ITEM' });
    assert.ok(logs.records.length > 0);
    assert.ok(logs.records.every(r => r.target_type === 'MENU_ITEM'));
  });

  await t.test('paginates audit logs', async () => {
    const page1 = await auditService.listAuditLogs({ limit: 2, page: 1 });
    assert.equal(page1.records.length, 2);
    assert.equal(page1.pagination.page, 1);
    assert.equal(page1.pagination.limit, 2);
  });
});
