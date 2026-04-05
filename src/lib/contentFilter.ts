const BANNED_WORDS = [
  'fuck', 'shit', 'ass', 'bitch', 'bastard', 'damn', 'crap',
  'piss', 'cock', 'dick', 'pussy', 'cunt', 'whore', 'slut',
  'nigger', 'nigga', 'faggot', 'retard', 'chink', 'spic',
  'kike', 'wetback', 'tranny', 'dyke',
  'asshole', 'motherfucker', 'bullshit', 'jackass', 'dumbass',
  'shithead', 'fuckhead', 'dipshit', 'douchebag', 'scumbag',
  'fucking', 'fucker', 'fucked', 'shitting', 'bitchy',
  'hell',
];

export function containsBannedWords(text: string): boolean {
  const lower = text.toLowerCase();
  const cleaned = lower.replace(/[^a-z0-9\s]/g, '');
  return BANNED_WORDS.some((word) => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(cleaned) || regex.test(lower);
  });
}

export function filterText(text: string): string {
  let filtered = text;
  BANNED_WORDS.forEach((word) => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    filtered = filtered.replace(regex, '*'.repeat(word.length));
  });
  return filtered;
}

export function getBannedWordError(): string {
  return 'YOUR MESSAGE CONTAINS INAPPROPRIATE LANGUAGE. PLEASE REVISE.';
}

export function validateUsername(username: string): string | null {
  if (/\s/.test(username)) {
    return 'USERNAME CANNOT CONTAIN SPACES';
  }
  if (username.length < 3 || username.length > 20) {
    return 'USERNAME MUST BE 3–20 CHARACTERS';
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return 'USERNAME CAN ONLY CONTAIN LETTERS, NUMBERS AND UNDERSCORES';
  }
  if (containsBannedWords(username)) {
    return 'USERNAME CONTAINS INAPPROPRIATE LANGUAGE';
  }
  return null;
}
