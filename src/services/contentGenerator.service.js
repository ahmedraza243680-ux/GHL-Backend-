import OpenAI from 'openai';
import { env } from '../config/env.js';
import prisma from '../database/client.js';

const SYSTEM_PROMPT = `You are proofreading a Google Business Profile post for a friend who owns a small business.

Rules:
- Change NO MORE than 8 to 12 words in the entire draft. Everything else stays exactly as written.
- Do not rewrite sentences. Do not restructure. Do not add new sentences.
- Only swap a few words for slightly different words with the same meaning.
- Keep the exact same sentence order, the exact same tone, the exact same length.
- Do not make it sound more professional or polished. Keep it raw.
- Do not add emojis, hashtags, or calls to action.
- If recent posts are shown, make sure the few words you change make this draft feel different from those.
- Output ONLY the edited draft. Nothing else.`;

const DRAFT_TEMPLATES = [
  (biz, cat, city) =>
    `Had a pretty solid morning at ${biz} today. Got in early and knocked out a couple ${cat} jobs before lunch. Days like this remind me why I got into this business in the first place. We are right here in ${city} same spot as always. The door is open if anyone needs anything, we are not going anywhere. Feels good to stay busy and do the kind of work people actually count on you for.`,

  (biz, cat, city) =>
    `Kind of a slow start at ${biz} this morning but it picked up real quick after that. Did some ${cat} work that turned out really good and the customers seemed happy about it which is all that matters at the end of the day. Still here in ${city} doing our thing every single day rain or shine. That consistency is what keeps people coming back I think.`,

  (biz, cat, city) =>
    `Spent most of the morning at ${biz} organizing and getting everything ready for the rest of the week. The ${cat} side of things has been keeping us busy lately and I am not complaining about that one bit. We are here in ${city} and honestly the local people around here have been really good to us since day one. Grateful for that more than they probably know.`,

  (biz, cat, city) =>
    `Long day at ${biz} but honestly a really good one. Got through a bunch of ${cat} work and even had a little time to clean up the shop and make it look right. Operating out of ${city} and it feels like things are finally picking up around here after a slow stretch. No complaints from me at all, just glad to be working.`,

  (biz, cat, city) =>
    `Opened up ${biz} early this morning because I could not sleep anyway so I figured why not get a head start. Knocked out some ${cat} projects before anyone else even showed up. ${city} mornings are real quiet and honestly that is when I get my best work done with no distractions. Already feeling productive and it is barely noon which is a nice change of pace.`,

  (biz, cat, city) =>
    `Wrapping up the day here at ${biz} and it was a full one from start to finish. Multiple ${cat} jobs back to back with barely any downtime in between. The kind of day where you do not even realize what time it is until you look up and it is dark outside. Love doing this work here in ${city}. Heading home tired but honestly pretty satisfied with how everything went.`,

  (biz, cat, city) =>
    `Rainy day here in ${city} but ${biz} is still going strong inside. Weather like this actually gives us a chance to catch up on some ${cat} stuff that we have been putting off for a while now. Got a lot accomplished today that I have been meaning to get around to for weeks. Sometimes a slow weather day turns into the most productive one you have had all month.`,

  (biz, cat, city) =>
    `Had a customer come into ${biz} today who I had not seen in a really long time. That kind of thing always makes my day a little better. We talked about some ${cat} work they needed done and got something set up for next week. Running a business in ${city} you really do get to know people on a personal level and that part of it never gets old for me.`,

  (biz, cat, city) =>
    `${biz} was busy from the jump today and did not slow down. Phone ringing, people walking in, ${cat} jobs stacking up one after another. That is exactly the kind of problem I like having if I am being honest. Been building this thing up here in ${city} for a good while now and days like today make all the hard ones before it feel worth it.`,

  (biz, cat, city) =>
    `Took a minute between jobs at ${biz} to just appreciate what we have going on here. Started from basically nothing and now we are handling ${cat} work steady every single week without a gap. ${city} has been good to us and the people here have really supported what we do. I try not to take any of that for granted because I know how quick things can change.`,

  (biz, cat, city) =>
    `Ended up staying late at ${biz} tonight finishing up a ${cat} project that I really wanted to get right. Could have easily left it for tomorrow morning but that is just not how I operate when it comes to this work. The people here in ${city} deserve that kind of effort and honestly I am happy to put it in every single time. Rather do it right than do it fast.`,

  (biz, cat, city) =>
    `Midweek update from ${biz} and things are moving along nicely. Got a couple of ${cat} jobs done ahead of schedule this week which honestly does not happen that often around here. Feeling really good about where we are at right now and the direction things are going. If you are anywhere in the ${city} area and need us for anything we are right here same as always.`,
];

async function getRecentPosts(locationId, limit = 5) {
  try {
    const posts = await prisma.post.findMany({
      where: { locationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { content: true },
    });
    return posts.map((p) => p.content);
  } catch {
    return [];
  }
}

function pickTemplate(recentContents, businessName, category, city) {
  const drafts = DRAFT_TEMPLATES.map((fn) => fn(businessName, category, city));
  const recentText = recentContents.join(' ').toLowerCase();

  let bestIdx = 0;
  let bestScore = -1;

  for (let i = 0; i < drafts.length; i++) {
    const words = drafts[i].toLowerCase().split(/\s+/);
    let uniqueWords = 0;
    for (const w of words) {
      if (w.length > 4 && !recentText.includes(w)) {
        uniqueWords += 1;
      }
    }
    if (uniqueWords > bestScore) {
      bestScore = uniqueWords;
      bestIdx = i;
    }
  }

  return drafts[bestIdx];
}

export async function generatePostContent(businessName, category, city, postType, dayOfYear) {
  const apiKey = env.OPENAI_API_KEY?.trim();

  const locationRow = await prisma.location.findFirst({
    where: {
      business: { name: businessName },
    },
    select: { id: true },
  });

  const recentContents = locationRow
    ? await getRecentPosts(locationRow.id)
    : [];

  const draft = pickTemplate(recentContents, businessName, category, city);

  if (!apiKey) {
    console.warn(
      JSON.stringify({ event: 'openai_skipped', reason: 'OPENAI_API_KEY not configured' }),
    );
    return draft;
  }

  const recentSection = recentContents.length > 0
    ? `\n\nRecent posts already published (DO NOT repeat these topics or openings):\n${recentContents.map((c, i) => `${i + 1}. "${c}"`).join('\n')}`
    : '';

  const userPrompt = `Here is the owner's draft for ${businessName}:\n\n"${draft}"${recentSection}\n\nChange only 8 to 12 words max. Keep everything else exactly the same. Do not rewrite or restructure. Do not shorten it or remove any sentences. Just swap a few words for similar ones.`;

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 200,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('OpenAI returned empty content');
    }

    return content.replace(/^["']|["']$/g, '');
  } catch (e) {
    console.error(
      JSON.stringify({
        event: 'openai_generate_failed',
        error: e?.message ?? String(e),
        businessName,
        postType,
      }),
    );
    return draft;
  }
}
