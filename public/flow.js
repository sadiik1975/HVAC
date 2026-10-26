/* Pure conversation helpers shared by the browser page and the tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Flow = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const BUSINESS = 'Your Town Heating & Air (Demo)';

  const JOBS = [
    { label: 'AC not cooling', short: 'AC repair', re: /\b(ac|a\/c|air ?con|cooling|not cool|warm air)\b/i },
    { label: 'No heat', short: 'No heat', re: /\b(heat|furnace|boiler|heating)\b/i },
    { label: 'New system quote', short: 'New system quote', re: /\b(new system|quote|replace|replacement|install)\b/i },
    { label: 'Tune-up / something else', short: 'Tune-up / something else', re: /\b(tune|maintenance|else|other|check ?up)\b/i },
  ];
  const DAYS = [
    { label: 'Today', value: 'Today', re: /\btoday\b/i },
    { label: 'Tomorrow', value: 'Tomorrow', re: /\btomorrow\b/i },
    { label: 'Later this week', value: 'Later this week', re: /\b(later|week)\b/i },
  ];
  const TIMES = [
    { label: 'Morning', value: 'morning', re: /\b(morning|am)\b/i },
    { label: 'Afternoon', value: 'afternoon', re: /\bafternoon\b/i },
    { label: 'Evening', value: 'evening', re: /\b(evening|night|pm)\b/i },
  ];

  const norm = (s) => String(s || '').trim().toLowerCase().replace(/[’‘]/g, "'");

  function pick(list, text) {
    const t = norm(text);
    const exact = list.find((o) => norm(o.label) === t);
    if (exact) return exact;
    const hits = list.filter((o) => o.re.test(text));
    return hits.length === 1 ? hits[0] : null;
  }

  function matchJob(text) { return pick(JOBS, text); }
  function matchDay(text) { return pick(DAYS, text); }
  function matchTime(text) { return pick(TIMES, text); }

  function matchUrgency(text) {
    const t = norm(text);
    if (t === "it's urgent" || t === 'its urgent') return 'urgent';
    if (t === 'it can wait') return 'wait';
    if (/\b(not urgent|can wait|no rush|whenever|later)\b/.test(t)) return 'wait';
    if (/\b(urgent|asap|emergency|right now|immediately)\b/.test(t)) return 'urgent';
    return null;
  }

  function matchConfirm(text) {
    const t = norm(text);
    if (t === "that's right" || t === 'thats right') return 'ok';
    if (t === 'let me fix it') return 'fix';
    if (/^(yes|yep|yeah|yup|correct|right|ok|okay|sure)\b/.test(t)) return 'ok';
    if (/^(no|nope|wrong|fix|change)\b/.test(t) || /\bfix\b/.test(t)) return 'fix';
    return null;
  }

  function matchMore(text) {
    const t = norm(text);
    if (t === "we're good" || t === 'were good') return 'good';
    if (t === 'one more thing') return 'more';
    if (/\b(good|done|thanks|thank you|nope|no)\b/.test(t)) return 'good';
    if (/\b(more|yes|yeah|yep|actually)\b/.test(t)) return 'more';
    return null;
  }

  const isPrice = (text) => /\b(cost|costs|price|prices|pricing|how much|estimate|charge|charges|fee|fees|rate|rates|cheap|expensive|afford)\b|\$/i.test(text);
  const isRobot = (text) => /\b(robot|bot|ai|human|real person|automated|machine)\b/i.test(text);
  const isAffirm = (text) => /^(yes|yep|yeah|yup|sure|ok|okay|please|y)\b/i.test(norm(text));

  // Returns "(518) 555-0147" or null.
  function normalizePhone(text) {
    const raw = String(text || '').trim();
    if (!raw || !/^[\d\s().+-]+$/.test(raw)) return null;
    let d = raw.replace(/\D/g, '');
    if (d.length === 11 && d[0] === '1') d = d.slice(1);
    if (d.length !== 10 || !/[2-9]/.test(d[0]) || !/[2-9]/.test(d[3])) return null;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }

  const COPY = {
    greeting: 'Hey there 👋 Sorry you\'re dealing with this — let\'s get you sorted fast. What\'s going on?',
    urgency: 'Got it. Is this urgent — like, no cooling or no heat at all right now — or can it wait a little?',
    detail: 'Quick one so the tech shows up ready: what\'s it doing — or not doing?',
    when: 'When works best for a visit?',
    name: 'Who am I booking this for?',
    namePhone: 'And the best number for the tech to reach you?',
    emergencyName: 'Then let\'s move. Who am I booking this for?',
    emergencyPhone: 'Best number for the tech to reach you?',
    phoneRetry: 'Please enter a valid phone number.',
    price: 'Depends on the job — the tech confirms the price before any work starts, never after. Want me to get you that callback window?',
    robot: 'I\'m the shop\'s assistant — I grab the details and get you booked fast. A real person confirms every job.',
    fallback: 'I can help fastest by getting you booked — the tech answers the rest on the call. Want to grab a time window?',
    goodbye: 'Perfect. Talk soon — stay comfortable out there.',
  };
  const confirmPhone = (num) => `Just to confirm — ${num}. That's the one?`;
  const closing = (num, day, time) =>
    `You're set. ${BUSINESS} will call or text ${num} to confirm your ${day.toLowerCase()}, ${time} window. Anything else, or are we good?`;
  const closingUrgent = (num) =>
    `Done — this is flagged **urgent** for today. ${BUSINESS} will reach out to ${num} as fast as they can. If anyone's unsafe — no heat in freezing weather, smell of gas — call 911 or your gas company first, okay?`;
  const acknowledge = (detail) => {
    const d = String(detail).trim().replace(/[.!?]+$/, '').slice(0, 80);
    return `Okay — ${d.charAt(0).toLowerCase()}${d.slice(1)}, noted.`;
  };

  function formatAlert(lead) {
    const urgent = lead.urgent === true;
    const job = lead.detail ? `${lead.job} — ${lead.detail}` : lead.job;
    return [
      `NEW LEAD — ${BUSINESS}`,
      `Name: ${lead.name}`,
      `Phone: ${lead.phone}`,
      `Job: ${job}`,
      `Urgency: ${urgent ? 'Urgent — today' : 'Can wait'}`,
      `When: ${urgent ? 'Today, as soon as possible' : `${lead.day}, ${lead.time}`}`,
    ].join('\n');
  }

  return {
    BUSINESS, JOBS, DAYS, TIMES, COPY,
    matchJob, matchDay, matchTime, matchUrgency, matchConfirm, matchMore,
    isPrice, isRobot, isAffirm, normalizePhone,
    confirmPhone, closing, closingUrgent, acknowledge, formatAlert,
  };
});
