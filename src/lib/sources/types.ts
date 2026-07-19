export interface Source {
  name: string;
  type: "careersPage";
  url: string;
}

export interface ExtractedJob {
  title: string;
  url: string;
  location: string | null;
  salaryText: string | null;
  postedAt: string | null;
}
