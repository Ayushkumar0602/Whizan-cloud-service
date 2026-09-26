import { redisClient } from "./redis.js";
import { prisma } from "./prisma.js";

interface AnalyticsEvent {
  projectId: string;
  date: string;
  path: string;
  bytesSent: number;
  ip: string;
}

export function startAnalyticsProcessor() {
  console.log("[Analytics] Starting background processor...");
  
  // Process events every 30 seconds
  setInterval(async () => {
    try {
      const batchSize = 1000;
      const eventsRaw = await redisClient.lrange("analytics:buffer", 0, batchSize - 1);
      if (eventsRaw.length === 0) return;

      const events: AnalyticsEvent[] = eventsRaw.map(e => JSON.parse(e));

      // Group by Project + Date
      const aggregated = new Map<string, { pageViews: number; bytesSent: number; uniqueIps: Set<string> }>();

      for (const event of events) {
        if (!event.projectId || !event.date) continue;
        const key = `${event.projectId}|${event.date}`;
        if (!aggregated.has(key)) {
          aggregated.set(key, { pageViews: 0, bytesSent: 0, uniqueIps: new Set() });
        }
        const stat = aggregated.get(key)!;
        
        // Count as page view if it's an HTML request (heuristic: no extension or .html)
        const isPageView = !event.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|map)$/i);
        if (isPageView) {
          stat.pageViews += 1;
        }
        
        stat.bytesSent += event.bytesSent;
        if (event.ip && isPageView) {
          stat.uniqueIps.add(event.ip);
        }
      }

      // Upsert into Postgres
      for (const [key, stat] of aggregated.entries()) {
        const [projectId, dateStr] = key.split("|");
        const date = new Date(dateStr);
        
        if (isNaN(date.getTime())) continue;

        await prisma.projectAnalytics.upsert({
          where: {
            projectId_date: { projectId, date }
          },
          update: {
            pageViews: { increment: stat.pageViews },
            bandwidth: { increment: stat.bytesSent },
            visitors: { increment: stat.uniqueIps.size }
          },
          create: {
            projectId,
            date,
            pageViews: stat.pageViews,
            bandwidth: stat.bytesSent,
            visitors: stat.uniqueIps.size,
          }
        });
      }

      // Remove processed events from the list
      await redisClient.ltrim("analytics:buffer", eventsRaw.length, -1);
      
    } catch (err) {
      console.error("[Analytics] Error processing batch:", err);
    }
  }, 30_000);
}
