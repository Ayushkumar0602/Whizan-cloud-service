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
  },
  {
    id: "backend-apis",
    name: "Backend APIs",
    tagline: "Coming soon",
    description: "Deploy Node and container APIs with health checks and rolling updates.",
    available: false,
    eta: "Next",
  },
  {
    id: "managed-databases",
    name: "Managed Databases",
    tagline: "Coming soon",
    description: "Provision Postgres with backups, credentials, and one-click attach to apps.",
    available: false,
    eta: "Soon",
  },
  {
    id: "object-storage",
    name: "Object Storage",
    tagline: "Coming soon",
    description: "Store build artifacts, uploads, and static assets next to your deploys.",
    available: false,
    eta: "Soon",
  },
];

export const DEPLOY_GUIDE = [
  {
    n: "01",
    title: "Pick a service",
    body: "Start with Frontend Hosting. More Whizan services will appear here as they launch.",
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
