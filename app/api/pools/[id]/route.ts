import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const pool = await prisma.pool.findUnique({
    where: { id },
    include: {
      reviews: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          content: true,
          rating: true,
          visitedAt: true,
          tags: true,
          createdAt: true,
        },
      },
      infoUpdates: {
        where: { status: "approved" },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!pool) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(pool);
}
