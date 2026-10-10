// Motivational quotes, shown only when the ✨ button is pressed.
const QUOTES = [
  'Small steps still count.',
  "You're doing better than you think.",
  'One focused session at a time.',
  'Progress, not perfection.',
  'Be gentle with yourself. Keep going.',
  "You've already started, and that's the hardest part.",
  'Slow is still moving forward.',
  "It's okay to take it one minute at a time.",
  "Future you will be glad you showed up today.",
  "Rest when you need to, then come back. You've got this.",
  'A little each day adds up to a lot.',
  "You don't have to do it all today.",
  'Breathe. Then take the next small step.',
  'Every minute you focus is a gift to yourself.',
  'Showing up matters more than being perfect.',
  'Being tired is okay. Rest, then keep going.',
  'You are building something, one session at a time.',
  "Keep going. You're closer than you were an hour ago.",
  'Mistakes mean you are learning.',
  "Your effort matters, even when it doesn't feel like it.",
  'Take your time. Just keep moving.',
  'Hard things get easier when you keep at them.',
  'Be proud of every step, even the small ones.',
  'Calm mind, steady pace.',
  'You can do hard things, softly.',
  'Every finished session is a little win.',
  'Trust the process. Trust yourself.',
  "Today's effort is tomorrow's ease.",
  'Stay curious. Stay kind to yourself. Keep going.',
  "You've got this, one tomato at a time. 🍅",
];
const QUOTE_MS = 7000;
let quoteBag = [];
let quoteTimer = null;

const hideQuote = () => $('quote').classList.remove('show');

$('motivate').onclick = () => {
  // Shuffle once everything has been shown, so quotes don't repeat until the bag is empty.
  if (!quoteBag.length) quoteBag = [...QUOTES].sort(() => Math.random() - 0.5);
  $('quote').textContent = quoteBag.pop();
  $('quote').classList.add('show');
  clearTimeout(quoteTimer);
  quoteTimer = setTimeout(hideQuote, QUOTE_MS);
};

$('quote').onclick = hideQuote;
