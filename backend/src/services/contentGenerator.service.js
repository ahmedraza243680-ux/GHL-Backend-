import OpenAI from 'openai';
import { env } from '../config/env.js';
import prisma from '../database/client.js';

const SYSTEM_PROMPT =
  'You are a creative local business writer. Your job is to make every single post feel like a completely fresh moment. Never reuse openings, themes or structures from previous posts. If you catch yourself starting with a word you used before, stop and start differently. Be genuinely creative and surprising every time. Write in first person casual tone like a real business owner. No corporate words. No hashtags. No emojis. Under 80 words. Weave in the requested keyword and call to action naturally, never like an ad.';

const DRAFT_TEMPLATES = [
  (biz, keyword, city) =>
    `Had a pretty solid morning at ${biz} today. Got in early and knocked out a couple ${keyword} jobs before lunch. Days like this remind me why I got into this business in the first place. We are right here in ${city} same spot as always. The door is open if anyone needs anything, we are not going anywhere. Feels good to stay busy and do the kind of work people actually count on you for.`,

  (biz, keyword, city) =>
    `Kind of a slow start at ${biz} this morning but it picked up real quick after that. Did some ${keyword} work that turned out really good and the customers seemed happy about it which is all that matters at the end of the day. Still here in ${city} doing our thing every single day rain or shine. That consistency is what keeps people coming back I think.`,

  (biz, keyword, city) =>
    `Spent most of the morning at ${biz} organizing and getting everything ready for the rest of the week. The ${keyword} side of things has been keeping us busy lately and I am not complaining about that one bit. We are here in ${city} and honestly the local people around here have been really good to us since day one. Grateful for that more than they probably know.`,

  (biz, keyword, city) =>
    `Long day at ${biz} but honestly a really good one. Got through a bunch of ${keyword} work and even had a little time to clean up the shop and make it look right. Operating out of ${city} and it feels like things are finally picking up around here after a slow stretch. No complaints from me at all, just glad to be working.`,

  (biz, keyword, city) =>
    `Opened up ${biz} early this morning because I could not sleep anyway so I figured why not get a head start. Knocked out some ${keyword} projects before anyone else even showed up. ${city} mornings are real quiet and honestly that is when I get my best work done with no distractions. Already feeling productive and it is barely noon which is a nice change of pace.`,

  (biz, keyword, city) =>
    `Wrapping up the day here at ${biz} and it was a full one from start to finish. Multiple ${keyword} jobs back to back with barely any downtime in between. The kind of day where you do not even realize what time it is until you look up and it is dark outside. Love doing this work here in ${city}. Heading home tired but honestly pretty satisfied with how everything went.`,

  (biz, keyword, city) =>
    `Rainy day here in ${city} but ${biz} is still going strong inside. Weather like this actually gives us a chance to catch up on some ${keyword} stuff that we have been putting off for a while now. Got a lot accomplished today that I have been meaning to get around to for weeks. Sometimes a slow weather day turns into the most productive one you have had all month.`,

  (biz, keyword, city) =>
    `Had a customer come into ${biz} today who I had not seen in a really long time. That kind of thing always makes my day a little better. We talked about some ${keyword} they needed and got something set up for next week. Running a business in ${city} you really do get to know people on a personal level and that part of it never gets old for me.`,

  (biz, keyword, city) =>
    `${biz} was busy from the jump today and did not slow down. Phone ringing, people walking in, ${keyword} requests stacking up one after another. That is exactly the kind of problem I like having if I am being honest. Been building this thing up here in ${city} for a good while now and days like today make all the hard ones before it feel worth it.`,

  (biz, keyword, city) =>
    `Took a minute between jobs at ${biz} to just appreciate what we have going on here. Started from basically nothing and now we are handling ${keyword} steady every single week without a gap. ${city} has been good to us and the people here have really supported what we do. I try not to take any of that for granted because I know how quick things can change.`,

  (biz, keyword, city) =>
    `Ended up staying late at ${biz} tonight finishing up a ${keyword} project that I really wanted to get right. Could have easily left it for tomorrow morning but that is just not how I operate when it comes to this work. The people here in ${city} deserve that kind of effort and honestly I am happy to put it in every single time. Rather do it right than do it fast.`,

  (biz, keyword, city) =>
    `Midweek update from ${biz} and things are moving along nicely. Got a couple of ${keyword} jobs done ahead of schedule this week which honestly does not happen that often around here. Feeling really good about where we are at right now and the direction things are going. If you are anywhere in the ${city} area and need us for anything we are right here same as always.`,
];

/**
 * Maps a raw category string to a set of relevant marketing keywords and the
 * business type used to pick a call to action. New businesses automatically
 * get sensible keywords as long as their category matches one of these
 * patterns; anything unmatched falls back to using the category itself.
 */
const CATEGORY_FOCUS_MAP = [
  {
    match: /hvac|heating|cooling|air condition/i,
    keywords: [
      'AC repair',
      'furnace repair',
      'HVAC service',
      'air conditioning installation',
      'heating repair',
    ],
    type: 'service',
  },
  {
    match: /car|auto|vehicle|dealer/i,
    keywords: ['used cars', 'auto sales', 'vehicle financing', 'car dealership', 'test drive'],
    type: 'retail',
  },
  {
    match: /marketing|seo|digital|media/i,
    keywords: [
      'digital marketing',
      'SEO services',
      'lead generation',
      'social media management',
      'business growth',
    ],
    type: 'service',
  },
  {
    match: /consulting|business service|solutions/i,
    keywords: [
      'business consulting',
      'process optimization',
      'growth strategy',
      'client solutions',
    ],
    type: 'consulting',
  },
];

function getCategoryEntry(category) {
  const cat = String(category ?? '').trim();
  if (!cat) return null;
  return CATEGORY_FOCUS_MAP.find((entry) => entry.match.test(cat)) ?? null;
}

function getBusinessFocus(category) {
  const entry = getCategoryEntry(category);
  if (entry) return entry.keywords.join(', ');
  return String(category ?? '').trim() || 'local business services';
}

function getPrimaryKeyword(category) {
  const entry = getCategoryEntry(category);
  if (entry) return entry.keywords[0];
  return String(category ?? '').trim() || 'our services';
}

function getBusinessType(category) {
  const entry = getCategoryEntry(category);
  return entry ? entry.type : 'service';
}

function getCTA(businessType, primaryKeyword, city) {
  if (businessType === 'retail') return 'Visit us today.';
  if (businessType === 'consulting') return 'Contact us for a free consultation.';
  return `Call us today for ${primaryKeyword} in ${city}.`;
}

function pickTemplate(recentContents, businessName, keyword, city, cta) {
  const drafts = DRAFT_TEMPLATES.map((fn) => `${fn(businessName, keyword, city)} ${cta}`);
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

async function getOtherBusinessNames(excludeName) {
  try {
    const rows = await prisma.business.findMany({
      where: { status: 'ACTIVE' },
      select: { name: true },
    });
    return rows.map((r) => r.name).filter((n) => n !== excludeName);
  } catch {
    return [];
  }
}

function contentMentionsOtherBusiness(content, businessName, otherNames) {
  const lower = content.toLowerCase();
  const self = businessName.trim().toLowerCase();
  for (const other of otherNames) {
    const o = other.trim().toLowerCase();
    if (!o || o === self) continue;
    if (lower.includes(o)) return other;
  }
  return null;
}

function contentIncludesBusinessName(content, businessName) {
  const name = businessName.trim();
  if (!name) return true;
  return content.toLowerCase().includes(name.toLowerCase());
}

/**
 * @param {string} locationId - DB location id (used for recent-post context)
 * @param {string} businessName - exact business name that must appear in the post
 */
export async function generatePostContent(
  locationId,
  businessName,
  category,
  city,
  postType,
  dayOfYear,
) {
  const apiKey = env.OPENAI_API_KEY?.trim();
  const name = String(businessName ?? '').trim() || 'Business';
  const locationCity = String(city ?? '').trim() || 'this area';
  const categoryLabel = String(category ?? '').trim() || 'local business';

  const recentPosts = locationId
    ? await prisma.post.findMany({
        where: { locationId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { content: true },
      })
    : [];

  const recentPostsSummary =
    recentPosts.length > 0
      ? recentPosts.map((p) => p.content.slice(0, 80)).join(' | ')
      : '(none yet)';

  const recentContents = recentPosts.map((p) => p.content);
  const otherBusinessNames = await getOtherBusinessNames(name);

  const businessType = getBusinessType(categoryLabel);
  const businessFocus = getBusinessFocus(categoryLabel);
  const primaryKeyword = getPrimaryKeyword(categoryLabel);
  const cta = getCTA(businessType, primaryKeyword, locationCity);

  const draft = pickTemplate(recentContents, name, primaryKeyword, locationCity, cta);

  const currentDayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long' });
  const variationSeed = Math.floor(Math.random() * 100);

  if (!apiKey) {
    console.warn(
      JSON.stringify({ event: 'openai_skipped', reason: 'OPENAI_API_KEY not configured' }),
    );
    return draft;
  }

  const keywordStyle = variationSeed % 2 === 0 ? 'local' : 'service';
  const keywordStyleInstruction =
    keywordStyle === 'local'
      ? `Naturally include a local keyword phrase such as "${primaryKeyword} ${locationCity}" or "${primaryKeyword} in ${locationCity}" somewhere in the post.`
      : `Naturally include a service or brand style keyword phrase such as "certified ${categoryLabel} specialist" or "professional ${primaryKeyword} service" somewhere in the post.`;

  const userPrompt = `You are writing a Google Business Profile post for ${name}, a ${categoryLabel} business in ${locationCity}.

Today is ${currentDayOfWeek} in ${currentMonth}. Post number ${dayOfYear}. Variation seed ${variationSeed}.

Business focus for this post: ${businessFocus}

RECENT POSTS ALREADY WRITTEN — DO NOT REPEAT ANY OF THESE OPENINGS, THEMES, STRUCTURES OR IDEAS:
${recentPostsSummary}

You must write something completely different from all of the above. Different opening word. Different scenario. Different angle. Different sentence structure. Pretend something genuinely new happened today at this business.

Local SEO requirement: ${keywordStyleInstruction}

Call to action requirement: End the post with a call to action that matches this meaning: "${cta}" (you may rephrase it slightly but keep the same intent and keep it at the very end).

Rules:
- First person casual tone like a real business owner texting a neighbor
- Must relate specifically to ${businessFocus} with real industry scenarios
- Feel like a different moment and situation every time
- Under 80 words
- Mention ${name} naturally once
- Include the local keyword and the call to action naturally, never like an ad
- Sound human not AI
- Current day: ${currentDayOfWeek}, Current month: ${currentMonth}

Be creative. Surprise me with a fresh angle every single time.`;

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.8,
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

    const cleaned = content.replace(/^["']|["']$/g, '');

    const wrongBusiness = contentMentionsOtherBusiness(cleaned, name, otherBusinessNames);
    if (wrongBusiness) {
      console.warn(
        JSON.stringify({
          event: 'openai_wrong_business_name',
          expected: name,
          found: wrongBusiness,
          locationId,
        }),
      );
      return draft;
    }

    if (!contentIncludesBusinessName(cleaned, name)) {
      console.warn(
        JSON.stringify({
          event: 'openai_missing_business_name',
          businessName: name,
          locationId,
        }),
      );
      return draft;
    }

    return cleaned;
  } catch (e) {
    console.error(
      JSON.stringify({
        event: 'openai_generate_failed',
        error: e?.message ?? String(e),
        businessName: name,
        locationId,
        postType,
      }),
    );
    return draft;
  }
}
