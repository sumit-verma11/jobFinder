import { db } from "../src/lib/db";

async function main() {
  const jobs = [
    {
      url: "https://example.com/jobs/fullstack-dev-1",
      title: "Full Stack Developer",
      company: "Example Corp",
      location: "Noida, India",
      salaryText: "₹8-12 LPA",
      description: "Seeking a full stack developer with React and Node.js experience.",
      source: "seed",
    },
    {
      url: "https://example.com/jobs/react-dev-2",
      title: "React Developer",
      company: "Sample Inc",
      location: "Remote (India)",
      salaryText: "₹10-15 LPA",
      description: "React and TypeScript developer for a growing product team.",
      source: "seed",
    },
    {
      url: "https://example.com/jobs/backend-dev-3",
      title: "Backend Engineer (Node.js)",
      company: "Test Systems",
      location: "Gurugram, India",
      salaryText: "₹9-13 LPA",
      description: "Node.js and Postgres backend engineer, 2-4 years experience.",
      source: "seed",
    },
  ];

  for (const job of jobs) {
    await db.job.upsert({
      where: { url: job.url },
      update: {},
      create: job,
    });
  }

  console.log(`Seeded ${jobs.length} jobs.`);

  const sources: {
    name: string;
    kind: "CAREERS_PAGE" | "ATS";
    url?: string;
    platform?: "GREENHOUSE" | "LEVER" | "ASHBY" | "WORKABLE";
    slug?: string;
  }[] = [
    { name: "Jellyfish Technologies", kind: "CAREERS_PAGE", url: "https://www.jellyfishtechnologies.com/career/" },
    { name: "Thrifty AI", kind: "CAREERS_PAGE", url: "https://www.thriftyai.com/" },
    { name: "GTF Technologies", kind: "CAREERS_PAGE", url: "https://www.gtf-technologies.com/careers" },
    { name: "Beebom", kind: "CAREERS_PAGE", url: "https://beebom.com/careers/" },
    { name: "WorldRef", kind: "CAREERS_PAGE", url: "https://www.talentd.worldref.co/" },
    // Verified live during Task 14 — real job data confirmed at each endpoint.
    { name: "Postman", kind: "ATS", platform: "GREENHOUSE", slug: "postman" },
    { name: "Groww", kind: "ATS", platform: "GREENHOUSE", slug: "groww" },
    { name: "Vercel", kind: "ATS", platform: "GREENHOUSE", slug: "vercel" },
    { name: "CRED", kind: "ATS", platform: "LEVER", slug: "cred" },
    { name: "Linear", kind: "ATS", platform: "ASHBY", slug: "linear" },
    // Not seeded, per Task 14's findings:
    // - Retool: no slug resolved on Greenhouse, Lever, Ashby, or Workable.
    // - Razorpay/Freshworks/BrowserStack/ChargeBee: real Workable accounts (name resolves
    //   correctly) but the public widget endpoint returns an empty jobs[] for every
    //   account tested, including large actively-hiring companies (Canva, Zapier,
    //   HelloFresh, Monzo) — these accounts currently have zero live Workable-sourced
    //   postings (likely no longer using Workable as their primary ATS), not a wrong
    //   slug. Revisit if any of these companies' Workable boards become active again.
  ];

  for (const source of sources) {
    const existing = await db.source.findFirst({ where: { name: source.name } });
    if (existing) continue;
    await db.source.create({ data: source });
  }

  console.log(`Seeded ${sources.length} source(s) (skipping any that already existed).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
