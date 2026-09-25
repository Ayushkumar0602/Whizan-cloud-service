"use client";

import { useEffect, useState } from "react";
import { admin, type ProjectWithLatestDeploy } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, Database, Server, Trash2, PowerOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function AdminPage() {
  const [stats, setStats] = useState<{
    users: number;
    projects: number;
    deployments: number;
    activeDeployments: ProjectWithLatestDeploy[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await admin.stats();
      setStats(data as any);
    } catch (err) {
      toast.error("Failed to load admin stats");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleStop = async (id: string) => {
    try {
      await admin.stopContainer(id);
      toast.success("Stop command sent to Azure worker");
      fetchStats();
    } catch (err) {
      toast.error("Failed to stop container");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? This will delete the deployment and wipe its container/files.")) return;
    try {
      await admin.deleteDeployment(id);
      toast.success("Delete command sent to Azure worker");
      fetchStats();
    } catch (err) {
      toast.error("Failed to delete deployment");
    }
  };

  if (loading && !stats) {
    return <div className="p-8 text-center text-muted-foreground">Loading Azure metrics...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Console</h1>
          <p className="text-muted-foreground mt-1">
            Real-time control over Azure Worker containers and deployments.
          </p>
        </div>
        <Button onClick={fetchStats} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.users ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.projects ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deployments</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.deployments ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Active Azure Containers</h2>
        <div className="border rounded-lg bg-card text-card-foreground shadow-sm overflow-hidden">
          {stats?.activeDeployments?.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No active containers running on Azure.
            </div>
          ) : (
            <div className="divide-y">
              {stats?.activeDeployments?.map((deploy: any) => (
                <div key={deploy.id} className="p-6 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-lg">{deploy.project?.name}</span>
                      <Badge variant="default" className="bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25">
                        {deploy.status}
                      </Badge>
                      <Badge variant="outline">{deploy.deploymentType}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <span>ID: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{deploy.id.slice(0, 8)}</code></span>
                      <span>•</span>
                      <span>URL: <a href={deploy.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{deploy.url}</a></span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="secondary" 
                      size="sm"
                      onClick={() => handleStop(deploy.id)}
                      className="gap-2"
                    >
                      <PowerOff className="h-4 w-4" />
                      Pause Container
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => handleDelete(deploy.id)}
                      className="gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
