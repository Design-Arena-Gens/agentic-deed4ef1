export const dynamic = "force-dynamic";
export const revalidate = 0;

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ManualLeadForm } from "@/components/ManualLeadForm";
import { SyncLeadsButton } from "@/components/SyncLeadsButton";
import { OutboundCallButton } from "@/components/OutboundCallButton";

const statusLabels: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  DEMO_SCHEDULED: "Demo Scheduled",
  DEMO_COMPLETED: "Demo Completed",
  ENROLLED: "Enrolled",
  CLOSED_LOST: "Closed - Lost",
};

const statusColors: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  CONTACTED: "bg-sky-100 text-sky-700",
  QUALIFIED: "bg-emerald-100 text-emerald-700",
  DEMO_SCHEDULED: "bg-amber-100 text-amber-700",
  DEMO_COMPLETED: "bg-amber-100 text-amber-800",
  ENROLLED: "bg-green-200 text-green-800",
  CLOSED_LOST: "bg-rose-100 text-rose-700",
};

type LeadWithRelations = Prisma.LeadGetPayload<{ include: { calls: true; tasks: true } }>;

const getDashboardData = async () => {
  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      calls: { orderBy: { createdAt: "desc" }, take: 1 },
      tasks: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const totals = await prisma.lead.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  const recentCalls = await prisma.callSession.count({
    where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });

  const demoScheduled = leads.filter((lead) => lead.status === "DEMO_SCHEDULED").length;
  const enrolled = leads.filter((lead) => lead.status === "ENROLLED").length;

  return {
    leads,
    totals,
    metrics: {
      totalLeads: leads.length,
      recentCalls,
      demoScheduled,
      enrolled,
    },
  } satisfies {
    leads: LeadWithRelations[];
    totals: { status: string; _count: { _all: number } }[];
    metrics: {
      totalLeads: number;
      recentCalls: number;
      demoScheduled: number;
      enrolled: number;
    };
  };
};

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);

export default async function HomePage() {
  const { leads, totals, metrics } = await getDashboardData();

  return (
    <div className="min-h-screen bg-slate-100 pb-16">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-6">
          <h1 className="text-2xl font-semibold text-slate-900">Strategic Scholars AI Sales Desk</h1>
          <p className="text-sm text-slate-600">
            Automate outreach for Sainik School, RMS, and Navodaya aspirants. Leads sync from Facebook & Google Ads, and the
            agent handles demo bookings automatically.
          </p>
        </div>
      </header>

      <main className="mx-auto mt-8 flex max-w-6xl flex-col gap-8 px-6">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-slate-500">Total Leads</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{metrics.totalLeads}</p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-slate-500">Calls (24h)</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{metrics.recentCalls}</p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-slate-500">Demo Scheduled</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{metrics.demoScheduled}</p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-slate-500">Enrolled</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{metrics.enrolled}</p>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Lead Pipeline</h2>
              <SyncLeadsButton />
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {totals.map((item) => (
                <span
                  className={`rounded-full px-3 py-1 font-medium ${statusColors[item.status] ?? "bg-slate-200 text-slate-700"}`}
                  key={item.status}
                >
                  {statusLabels[item.status] ?? item.status}: {item._count._all}
                </span>
              ))}
            </div>
            <div className="mt-6 overflow-hidden rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Lead</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Last Touch</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {leads.map((lead) => {
                    const lastCall = lead.calls?.[0];
                    const lastTask = lead.tasks?.[0];
                    const lastTouch =
                      lastCall?.updatedAt ??
                      lastTask?.completedAt ??
                      lastTask?.dueAt ??
                      lastTask?.createdAt ??
                      lead.updatedAt;
                    return (
                      <tr key={lead.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{lead.fullName ?? "Unnamed lead"}</div>
                          <div className="text-xs text-slate-500">{lead.targetExam ?? "Exam TBD"}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          <div>{lead.phone}</div>
                          {lead.email ? <div>{lead.email}</div> : null}
                          {lead.city ? <div>{lead.city}</div> : null}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span
                            className={`rounded-full px-2 py-1 font-medium ${statusColors[lead.status] ?? "bg-slate-200 text-slate-700"}`}
                          >
                            {statusLabels[lead.status] ?? lead.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {lastTouch ? formatDate(lastTouch) : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <OutboundCallButton leadId={lead.id} phone={lead.phone} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {leads.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-600">
                  No leads yet. Sync Facebook & Google or add manually.
                </div>
              ) : null}
            </div>
          </div>
          <aside className="flex flex-col gap-6">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Add Lead</h2>
              <p className="mb-4 text-xs text-slate-500">Capture walk-in or referral details instantly.</p>
              <ManualLeadForm />
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Export to Excel</h2>
              <p className="text-xs text-slate-500">Download an Excel workbook with the latest CRM snapshot.</p>
              <a
                className="mt-4 inline-flex items-center justify-center rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                href="/api/export/excel"
              >
                Download Leads (.xlsx)
              </a>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
