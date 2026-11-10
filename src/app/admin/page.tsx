import { notFound, redirect } from "next/navigation";
import { getAdminActor } from "@/lib/admin-auth";
import AdminConsole from "./admin-console";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const actor = await getAdminActor();
  if (!actor) redirect("/login");
  if (!actor.roles.length) notFound();
  return <AdminConsole roles={actor.roles} currentUserId={actor.id} />;
}
