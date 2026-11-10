import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user)
    return NextResponse.json(
      { authenticated: false },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  const roles = await prisma.userRole.findMany({
    where: { userId: user.id },
    select: { role: true },
  });
  return NextResponse.json(
    { authenticated: true, user, roles: roles.map(({ role }) => role) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
