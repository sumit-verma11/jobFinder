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
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
