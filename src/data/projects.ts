export interface Project {
  slug: string;
  name: string;
  headline: string;
  category: string;
  description: string;
  tags: string[];
  repo: string;
  problem: string;
  approach: string[];
  takeaway: string;
}

export const projects: Project[] = [
  {
    slug: "homelab-ops",
    name: "Homelab Ops",
    headline: "A homelab with a source of truth.",
    category: "GITOPS / PLATFORM ENGINEERING",
    description:
      "My self-hosted Kubernetes environment, managed declaratively through Git and reconciled by Argo CD. From networking and storage to the applications on top.",
    tags: ["Kubernetes", "Argo CD", "Helm", "Kustomize"],
    repo: "https://github.com/harish2k01/homelab-ops",
    problem:
      "A growing collection of self-hosted services needs configuration that can be reviewed, reproduced, and understood. Manual changes make it harder to know what the cluster should be running.",
    approach: [
      "Keep Argo CD Applications, Helm values, local charts, and Kustomize resources together in a version-controlled source of truth.",
      "Use multi-source Argo CD applications to combine upstream charts with repository-managed values.",
      "Manage shared infrastructure including certificates, network access, distributed storage, and observability alongside the applications.",
      "Preview affected applications in pull requests, then use an approval-gated apply workflow that waits for sync and health.",
      "Use encrypted Sealed Secrets where possible, while keeping application configuration declarative.",
    ],
    takeaway:
      "This is where I connect the entire operational picture: configuration, delivery, storage, networking, and observability. It gives me a practical environment to explore reliability and recovery.",
  },
  {
    slug: "helm-charts",
    name: "Helm Charts",
    headline: "Reusable by design. Portable by default.",
    category: "KUBERNETES / RELEASE ENGINEERING",
    description:
      "A library of versioned Helm charts for self-hosted applications, distributed through both a traditional Helm repository and the GHCR OCI registry.",
    tags: ["Helm", "GitHub Actions", "GHCR", "OCI"],
    repo: "https://github.com/harish2k01/helm-charts",
    problem:
      "A chart that works only in my cluster is difficult for anyone else to use. Reusable packaging needs configurable values, clear versioning, and distribution that fits established Helm workflows.",
    approach: [
      "Keep personal domains, namespaces, storage classes, and cluster-specific controllers out of chart defaults.",
      "Publish each chart through a GitHub Pages index and as an OCI artifact in GHCR.",
      "Attach chart packages to versioned GitHub Releases and publish Helm provenance files for signed packages.",
      "Cover practical self-hosted workloads across networking, storage, media, monitoring, finance, and security.",
      "Allow independent releases and multiple installations of a chart through release names and values files.",
    ],
    takeaway:
      "The useful engineering work is in the boundaries: separating a reusable chart from the assumptions of the environment that runs it.",
  },
  {
    slug: "k8s-debug-pod",
    name: "Kubernetes Debug Pod",
    headline: "The right tools. Inside the cluster.",
    category: "OPERATIONS / TROUBLESHOOTING",
    description:
      "An Ubuntu-based troubleshooting image with networking, process, database, and Kubernetes utilities—packaged for the place where the problem happens.",
    tags: ["Docker", "Linux", "kubectl", "Multi-arch"],
    repo: "https://github.com/harish2k01/k8s-debug-pod",
    problem:
      "Minimal application containers often do not include the tools needed to investigate a problem. A dedicated debug image keeps the diagnostic toolbox separate from the application.",
    approach: [
      "Bundle HTTP, TLS, DNS, networking, and process tools such as curl, openssl, dig, tcpdump, and strace.",
      "Include kubectl, Python, jq, yq, and PostgreSQL, MySQL, and Redis clients for common investigations.",
      "Build linux/amd64 and linux/arm64 images and publish versioned tags to GHCR.",
      "Provide a corresponding chart in the Helm library so the image can be deployed as a troubleshooting pod.",
    ],
    takeaway:
      "A predictable diagnostic environment helps me focus on the behavior of a system rather than rebuilding a toolbox during an investigation.",
  },
  {
    slug: "grafana-dashboards",
    name: "Grafana Dashboards",
    headline: "Visibility, kept in version control.",
    category: "OBSERVABILITY / DASHBOARDS",
    description:
      "A curated collection of dashboards for applications, Kubernetes platform services, Proxmox, and Raspberry Pi infrastructure, maintained as reviewable JSON.",
    tags: ["Grafana", "Prometheus", "Git Sync"],
    repo: "https://github.com/harish2k01/grafana-dashboards",
    problem:
      "Dashboards are operational assets too. Keeping them only in a UI makes it easy to lose changes and hard to review or reuse them across environments.",
    approach: [
      "Organize dashboard JSON into application and server categories, separate from deployment configuration.",
      "Cover Argo CD, cert-manager, qBittorrent, Uptime Kuma, Proxmox, and Raspberry Pi metrics.",
      "Keep dashboard UIDs stable and use a folder structure suited to Grafana Git Sync.",
      "Support manual imports and other provisioning workflows, with datasource mapping adjusted for the target instance.",
    ],
    takeaway:
      "Putting observability configuration through the same review process as code makes operational knowledge easier to maintain and share.",
  },
];

export const otherProjects = [
  {
    name: "PaperVault",
    category: "Self-hosted applications",
    description:
      "Document management with OCR, keyword and semantic search, and evidence-backed answers.",
    tags: ["FastAPI", "React", "PostgreSQL", "OpenSearch"],
    repo: "https://github.com/harish2k01/papervault",
  },
  {
    name: "IRCTC Travel Planner",
    category: "Self-hosted applications",
    description:
      "A calendar-first railway travel planner with booking windows, reminders, and PNR tracking. Independent of IRCTC.",
    tags: ["Next.js", "PostgreSQL", "Docker"],
    repo: "https://github.com/harish2k01/irctc-travel-planner",
  },
  {
    name: "Net Worth Tracker",
    category: "Self-hosted applications",
    description:
      "An authenticated tracker for Indian investments and personal assets, with trade imports and consolidated views.",
    tags: ["Next.js", "Prisma", "PostgreSQL"],
    repo: "https://github.com/harish2k01/portfolio-tracker",
  },
  {
    name: "Portfolio Platform",
    category: "Earlier work",
    description:
      "My original Astro portfolio, with Docker builds, SonarQube checks, semantic releases, and GitOps deployment updates.",
    tags: ["Astro", "Docker", "GitHub Actions"],
    repo: "https://github.com/harish2k01/Portfolio",
  },
  {
    name: "Smart Switch",
    category: "Earlier work",
    description: "A home automation project using IoT and a Raspberry Pi.",
    tags: ["IoT", "Raspberry Pi"],
    repo: "https://github.com/harish2k01/Smart-Switch",
  },
  {
    name: "Hospital Management System",
    category: "Earlier work",
    description: "A simple hospital management web application.",
    tags: ["Python", "Flask", "SQLite"],
    repo: "https://github.com/harish2k01/Hospital-Management-System-Flask",
  },
  {
    name: "Tic Tac Toe",
    category: "Earlier work",
    description: "A two-player Android implementation of the classic game.",
    tags: ["Android", "Java"],
    repo: "https://github.com/harish2k01/Tic-Tac-Toe",
  },
];
