# Borough Build — HVAC Demo Chat

Re-skin of the FettiBands chat agent as "Your Town Heating & Air (Demo)". A visitor is
walked through job → urgency → detail → day/time → name → phone, and the confirmed lead
is sent to a Telegram chat as one alert. Nothing is sent for abandoned conversations.

```bash
cp .env.example .env   # set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID
npm start              # http://localhost:3100
npm test
```

For a prospect demo, set `TELEGRAM_CHAT_ID` to the prospect's own chat so the lead lands
on their phone. Visitor copy lives in `public/flow.js` (`COPY` and the quick-reply
labels) and comes from the approved script.
