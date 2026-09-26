import { useState, useEffect } from "react";
import { admin } from "@/lib/api";

export type VMStats = {
  timestamp: number;
  hostname: string;
  platform: string;
  uptime: number;
  cpu: { cores: number; model: string; usagePercent: number };
  memory: { totalMB: number; usedMB: number; freeMB: number; usagePercent: number };
  disk: { totalMB: number; usedMB: number; freeMB: number; usagePercent: number };
  docker: {
    containers: {
      id: string; name: string; image: string;
      state: string; status: string; created: number;
      ports: string[];
      deploymentId?: string | null;
    }[];
    totalContainers: number;
    runningContainers: number;
  };
  queue: { waiting: number; active: number; completed: number; failed: number };
  files?: { path: string; type: string; sizeMB: number }[];
};

export type AdminStats = {
  users: number;
  projects: number;
  deployments: number;
  allDeployments: any[];
  vmStats: VMStats | null;
};

export function useAdminStats(autoRefresh = true) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const data = await admin.stats();
      setStats(data as any);
    } catch (err) {
      console.error("Failed to load admin stats", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchStats, 15_000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  return { stats, loading, fetchStats };
}
