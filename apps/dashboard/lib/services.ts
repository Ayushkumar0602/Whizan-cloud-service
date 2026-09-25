export type CloudService = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  href?: string;
  available: boolean;
  eta?: string;
};

export const CLOUD_SERVICES: CloudService[] = [
  {
    id: "frontend-hosting",
    name: "Frontend Hosting",
    tagline: "Ship sites in minutes",
    description:
      "Connect a GitHub repo, preview every step of the build, and go live on a dedicated URL.",
    href: "/dashboard/projects/new",
    available: true,
  }
];

export const DEPLOY_GUIDE = [
  {
    n: "01",
    title: "Pick a service",
    body: "Start with Frontend Hosting to deploy your app.",
  },
  {
    n: "02",
    title: "Connect your repo",
    body: "Paste a GitHub URL and branch. We clone it on a worker — you never upload a zip.",
  },
  {
    n: "03",
    title: "Confirm build settings",
    body: "Framework presets fill install, build, and output. Change them if your app is custom.",
  },
  {
    n: "04",
    title: "Watch the pipeline",
    body: "Queued → clone → install → build → publish. You always see which step is running.",
  },
];
