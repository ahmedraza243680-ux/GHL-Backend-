import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const DEFAULT_SYSTEM_PROMPT =
  'You are a professional website content writer for local businesses. Write in natural human tone. No corporate buzzwords like exceptional, leverage, seamless, innovative, utilize. Content must be specific to the business name, city and services. Generate comprehensive service lists of 6 to 8 services that are highly relevant and specific to this industry. Sound like a real local business owner wrote it.';

function buildHomePageSchema(
  serviceTitles = [
    'Service One',
    'Service Two',
    'Service Three',
    'Service Four',
    'Service Five',
    'Service Six',
  ],
) {
  return {
    hero: {
      heading: 'max 8 words powerful headline with business name',
      subheading: 'max 20 words supporting statement mentioning city',
      ctaButton: 'max 4 words',
    },
    about: {
      heading: 'max 6 words',
      paragraph1: '60-80 words introduce the business',
      paragraph2: '60-80 words what makes them different',
    },
    services: serviceTitles.slice(0, 8).map((title) => ({
      title: `max 4 words — use "${title}" as theme`,
      description: '25-35 words',
      icon: 'lucide icon name',
    })),
    whyChooseUs: [
      { point: 'max 6 words', detail: '15-20 words' },
      { point: 'max 6 words', detail: '15-20 words' },
      { point: 'max 6 words', detail: '15-20 words' },
      { point: 'max 6 words', detail: '15-20 words' },
    ],
    cta: { heading: 'max 10 words', subtext: 'max 20 words', buttonText: 'max 4 words' },
    seo: { title: 'max 60 characters', metaDescription: 'max 155 characters' },
  };
}

function buildAboutPageSchema() {
  return {
    hero: { heading: 'max 8 words', subheading: 'max 20 words' },
    story: {
      heading: 'max 6 words',
      paragraph1: '80-100 words company history',
      paragraph2: '80-100 words mission and values',
    },
    team: { heading: 'max 6 words', description: '40-60 words about the team' },
    mission: { heading: 'max 6 words', statement: '30-40 words' },
    values: [
      { title: 'max 3 words', description: '15-20 words' },
      { title: 'max 3 words', description: '15-20 words' },
      { title: 'max 3 words', description: '15-20 words' },
    ],
    seo: { title: 'max 60 characters', metaDescription: 'max 155 characters' },
  };
}

function buildServicesPageSchema(
  serviceTitles = [
    'Service One',
    'Service Two',
    'Service Three',
    'Service Four',
    'Service Five',
    'Service Six',
    'Service Seven',
    'Service Eight',
  ],
) {
  return {
    hero: { heading: 'max 8 words', subheading: 'max 20 words' },
    intro: '60-80 words overview of all services offered',
    services: serviceTitles.slice(0, 8).map((title) => ({
      title: `max 5 words — use "${title}" as theme`,
      shortDescription: '20-30 words',
      fullDescription: '60-80 words',
      icon: 'lucide icon name',
    })),
    cta: { heading: 'max 10 words', buttonText: 'max 4 words' },
    seo: { title: 'max 60 characters', metaDescription: 'max 155 characters' },
  };
}

function buildContactPageSchema() {
  return {
    hero: { heading: 'max 8 words', subheading: 'max 20 words' },
    intro: '40-60 words inviting customers to get in touch',
    formHeading: 'max 6 words',
    addressSection: { heading: 'max 4 words' },
    hoursSection: { heading: 'max 4 words', description: '20-30 words about availability' },
    seo: { title: 'max 60 characters', metaDescription: 'max 155 characters' },
  };
}

function buildLocationPageSchema() {
  return {
    hero: { heading: 'max 10 words mentioning city name', subheading: 'max 20 words' },
    localIntro: '60-80 words specific to that city mentioning local landmarks or community',
    whyLocal: '40-60 words why local customers should choose this business',
    serviceArea: '30-40 words about serving that specific area',
    cta: { heading: 'max 10 words', buttonText: 'max 4 words' },
    seo: {
      title: 'max 60 characters include city name',
      metaDescription: 'max 155 characters include city name',
    },
  };
}

function buildBlogPageSchema() {
  // A single detailed, well-structured article template. Reused for each of the
  // three posts so every blog entry is long-form (intro + headed sections +
  // conclusion + real FAQs) instead of a thin, structureless blob.
  const post = {
    title: 'specific, compelling blog post title, max 12 words',
    excerpt: '40-60 word summary that makes the reader want to open the article',
    category: 'single word topic category',
    readTime: 'X min read',
    introduction:
      '70-100 word opening paragraph that hooks the reader and introduces the topic in a relatable, specific way',
    sections: [
      {
        heading: 'clear, specific H2 subheading, max 8 words',
        paragraphs: [
          '110-150 words of genuinely useful, specific detail',
          '110-150 words continuing the point with concrete examples or practical advice',
        ],
      },
      {
        heading: 'clear, specific H2 subheading, max 8 words',
        paragraphs: [
          '110-150 words of genuinely useful, specific detail',
          '110-150 words continuing the point with concrete examples or practical advice',
        ],
      },
      {
        heading: 'clear, specific H2 subheading, max 8 words',
        paragraphs: ['110-150 words of genuinely useful, specific detail'],
      },
    ],
    conclusion:
      '60-90 word closing paragraph that summarizes the key takeaway and ends with a natural, non-pushy call to action',
    faqs: [
      {
        question: 'a real question customers ask about this topic',
        answer: '40-70 word helpful, specific answer',
      },
      {
        question: 'a different real question customers ask about this topic',
        answer: '40-70 word helpful, specific answer',
      },
      {
        question: 'a third real question customers ask about this topic',
        answer: '40-70 word helpful, specific answer',
      },
    ],
  };

  return {
    posts: [post, post, post],
    seo: { title: 'max 60 characters', metaDescription: 'max 155 characters' },
  };
}

function buildSchemaRecord({
  industry,
  displayName,
  systemPrompt,
  isDefault = false,
  homeServices,
  servicesPageServices,
}) {
  return {
    industry,
    displayName,
    systemPrompt,
    isDefault,
    homePageSchema: JSON.stringify(buildHomePageSchema(homeServices)),
    aboutPageSchema: JSON.stringify(buildAboutPageSchema()),
    servicesPageSchema: JSON.stringify(buildServicesPageSchema(servicesPageServices)),
    contactPageSchema: JSON.stringify(buildContactPageSchema()),
    locationPageSchema: JSON.stringify(buildLocationPageSchema()),
    blogPageSchema: JSON.stringify(buildBlogPageSchema()),
  };
}

const SEED_SCHEMAS = [
  buildSchemaRecord({
    industry: 'general',
    displayName: 'General Business',
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    isDefault: true,
    homeServices: [
      'Primary Service',
      'Secondary Service',
      'Additional Service',
      'Consultation',
      'Maintenance',
      'Support Service',
      'Specialty Work',
      'Emergency Service',
    ],
    servicesPageServices: [
      'Core Service',
      'Specialty Service',
      'Maintenance Service',
      'Consultation',
      'Support Service',
      'Installation',
      'Repair Service',
      'Emergency Response',
    ],
  }),
  buildSchemaRecord({
    industry: 'automotive',
    displayName: 'Automotive',
    systemPrompt:
      'You are writing for a car dealership. Focus on vehicle selection, financing options, test drives, service department, certified vehicles, trade-ins. Generate a comprehensive list of 6 to 8 services specific to automotive dealerships and auto service. Mention specific city. Friendly approachable tone.',
    homeServices: [
      'Vehicle Sales',
      'Auto Financing',
      'Service and Repair',
      'Trade-In Appraisal',
      'Vehicle Inspection',
      'Test Drives',
      'Parts Department',
      'Certified Pre-Owned',
    ],
    servicesPageServices: [
      'Vehicle Sales',
      'Auto Financing',
      'Service and Repair',
      'Trade-In Appraisal',
      'Vehicle Inspection',
      'Test Drives',
      'Parts Department',
      'Certified Pre-Owned',
    ],
  }),
  buildSchemaRecord({
    industry: 'hvac',
    displayName: 'HVAC',
    systemPrompt:
      'You are writing for an HVAC company. Focus on heating, cooling, emergency service, seasonal maintenance, energy efficiency, fast response time, licensed technicians. Generate a comprehensive list of 6 to 8 services specific to HVAC and climate control. Mention specific city and nearby areas.',
    homeServices: [
      'AC Repair',
      'Heating Service',
      'Emergency Calls',
      'Preventive Maintenance',
      'System Installation',
      'Duct Cleaning',
      'Indoor Air Quality',
      'Thermostat Upgrades',
    ],
    servicesPageServices: [
      'AC Repair',
      'Heating Service',
      'Emergency Calls',
      'Preventive Maintenance',
      'System Installation',
      'Duct Cleaning',
      'Indoor Air Quality',
      'Thermostat Upgrades',
    ],
  }),
  buildSchemaRecord({
    industry: 'business',
    displayName: 'Business Services',
    systemPrompt:
      'You are writing for a professional business services company. Focus on consulting, client results, expertise, reliability, professional advice, business growth. Generate a comprehensive list of 6 to 8 services specific to professional business consulting and support.',
    homeServices: [
      'Business Consulting',
      'Strategic Planning',
      'Growth Strategy',
      'Financial Advisory',
      'Operations Support',
      'Market Research',
      'Process Improvement',
      'Leadership Coaching',
    ],
    servicesPageServices: [
      'Business Consulting',
      'Strategic Planning',
      'Financial Advisory',
      'Operations Support',
      'Growth Strategy',
      'Market Research',
      'Process Improvement',
      'Leadership Coaching',
    ],
  }),
];

async function main() {
  console.info(JSON.stringify({ event: 'seed_industry_schemas_start', count: SEED_SCHEMAS.length }));

  for (const schema of SEED_SCHEMAS) {
    await prisma.industrySchema.upsert({
      where: { industry: schema.industry },
      create: schema,
      update: schema,
    });
    console.info(JSON.stringify({ event: 'seed_industry_schema_upserted', industry: schema.industry }));
  }

  if (SEED_SCHEMAS.some((s) => s.isDefault)) {
    await prisma.industrySchema.updateMany({
      where: {
        isDefault: true,
        industry: { not: 'general' },
      },
      data: { isDefault: false },
    });
  }

  console.info(JSON.stringify({ event: 'seed_industry_schemas_complete' }));
}

main()
  .catch((e) => {
    console.error(JSON.stringify({ event: 'seed_industry_schemas_failed', error: e?.message ?? String(e) }));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
