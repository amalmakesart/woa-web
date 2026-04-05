import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

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

function containsBannedWords(text: string): boolean {
  const lower = text.toLowerCase();
  const cleaned = lower.replace(/[^a-z0-9\s]/g, '');
  return BANNED_WORDS.some((word) => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(cleaned) || regex.test(lower);
  });
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { texts } = await req.json() as { texts: string[] };

    if (!Array.isArray(texts)) {
      return new Response(
        JSON.stringify({ error: 'texts must be an array of strings' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const flagged = texts.some((t) => typeof t === 'string' && containsBannedWords(t));

    return new Response(
      JSON.stringify({ flagged }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Invalid request body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
