const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../public/flow.js');
const { validateLead, sendTelegram } = require('../server.js');

test('phone validation and formatting', () => {
  assert.equal(F.normalizePhone('518-555-0147'), '(518) 555-0147');
  assert.equal(F.normalizePhone('+1 (518) 555 0147'), '(518) 555-0147');
  assert.equal(F.normalizePhone('555-0147'), null);
  assert.equal(F.normalizePhone('call me'), null);
  assert.equal(F.normalizePhone('118-555-0147'), null);
});

test('quick replies and free text both match', () => {
  assert.equal(F.matchJob('AC not cooling').short, 'AC repair');
  assert.equal(F.matchJob('my furnace is dead').short, 'No heat');
  assert.equal(F.matchJob('banana'), null);
  assert.equal(F.matchUrgency("It's urgent"), 'urgent');
  assert.equal(F.matchUrgency('it can wait'), 'wait');
  assert.equal(F.matchDay('tomorrow please').value, 'Tomorrow');
  assert.equal(F.matchTime('Evening').value, 'evening');
  assert.equal(F.matchConfirm("That's right"), 'ok');
  assert.equal(F.matchConfirm('Let me fix it'), 'fix');
});

test('deflection detectors', () => {
  assert.ok(F.isPrice('How much does it cost?'));
  assert.ok(F.isRobot('are you a robot?'));
  assert.ok(!F.isPrice('blowing warm air'));
});

test('alert format matches the approved script', () => {
  const text = F.formatAlert({ name: 'Maria T.', phone: '(518) 555-0147', job: 'AC repair', detail: 'blowing warm air', urgent: false, day: 'Tomorrow', time: 'morning' });
  assert.equal(text, [
    'NEW LEAD — Your Town Heating & Air (Demo)',
    'Name: Maria T.',
    'Phone: (518) 555-0147',
    'Job: AC repair — blowing warm air',
    'Urgency: Can wait',
    'When: Tomorrow, morning',
  ].join('\n'));
});

test('urgent alert and closing carry the safety line', () => {
  const text = F.formatAlert({ name: 'Sam', phone: '(518) 555-0147', job: 'No heat', detail: '', urgent: true });
  assert.match(text, /Urgency: Urgent — today/);
  assert.match(text, /Job: No heat\n/);
  assert.match(F.closingUrgent('(518) 555-0147'), /call 911 or your gas company first/);
});

test('standard closing names the window and number', () => {
  assert.equal(F.closing('(518) 555-0147', 'Tomorrow', 'morning'),
    "You're set. Your Town Heating & Air (Demo) will call or text (518) 555-0147 to confirm your tomorrow, morning window. Anything else, or are we good?");
});

test('visitor copy contains no prices', () => {
  const copy = Object.entries(F.COPY).filter(([k]) => k !== 'price').map(([, v]) => v).join(' ');
  assert.doesNotMatch(copy, /\$|\d+\s?dollars/i);
});

test('server rejects incomplete leads and accepts complete ones', () => {
  const base = { id: 'x1', name: 'Maria', phone: '518-555-0147', job: 'AC repair', detail: 'warm air', urgent: false, day: 'Today', time: 'evening' };
  assert.ok(validateLead(base));
  assert.equal(validateLead({ ...base, phone: '123' }), null);
  assert.equal(validateLead({ ...base, time: '' }), null);
  assert.ok(validateLead({ ...base, urgent: true, detail: '', day: '', time: '' }));
});

test('Telegram rejection includes its reason for server logs', async (t) => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(JSON.stringify({
    ok: false,
    description: 'Bad Request: chat not found',
  }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  t.after(() => { global.fetch = originalFetch; });

  await assert.rejects(sendTelegram('test'), /Telegram HTTP 400: Bad Request: chat not found/);
});
