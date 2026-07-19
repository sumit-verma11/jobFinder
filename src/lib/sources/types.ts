export interface Source {
  name: string;
  type: "careersPage";
  url: string;
}

export interface ScrapedJob {
  title: string;
  url: string;
  location: string | null;
  salaryText: string | null;
  postedAt: string | null;
}

export interface ExtractedJob extends ScrapedJob {
  company: string;
}
